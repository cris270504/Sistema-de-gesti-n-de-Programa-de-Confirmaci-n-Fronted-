-- =====================================================================
-- Al REGISTRAR asistencias, solo coordinador o super-admin pueden marcar
-- "falta justificada". El catequista marca "falta injustificada" y la falta
-- se justifica por el proceso del módulo Justificaciones (acuerdo → validar
-- cumplimiento). Ese proceso (fn_justificacion_completar) NO cambia: es la
-- vía oficial y escribe asistencia directamente, sin pasar por aquí.
--
-- Se reemplaza fn_guardar_asistencias con el mismo cuerpo y una sola regla
-- nueva: si una fila pide 'falta justificada' y en la base no lo estaba ya,
-- exige rol coordinador o super-admin (roles del JWT).
-- Llamadas sin sesión de usuario (service_role / postgres) no se restringen.
-- Mantiene SECURITY INVOKER y los GRANT existentes (CREATE OR REPLACE).
-- =====================================================================

create or replace function public.fn_guardar_asistencias(p_reunion_id bigint, p_filas jsonb)
returns jsonb
language plpgsql
as $function$
declare
    _rec          record;
    _was_insert   boolean;
    _n_upd        int := 0;
    _n_ins        int := 0;
    _puede_justif boolean;
    _actual       text;
begin
    perform pg_advisory_xact_lock(hashtext('asistencia:' || p_reunion_id));

    if not exists (select 1 from public.reunions r where r.id = p_reunion_id) then
        raise exception 'Reunión % no encontrada', p_reunion_id using errcode = 'no_data_found';
    end if;

    _puede_justif :=
        (public.app_jwt() ->> 'role') is distinct from 'authenticated'
        or coalesce(
            array(select jsonb_array_elements_text(public.app_jwt() -> 'roles'))
                && array['coordinador', 'super-admin']::text[],
            false
        );

    for _rec in
        select * from jsonb_to_recordset(p_filas)
            as x(asistente_id bigint, asistente_type text, estado text, nota text)
    loop
        if _rec.estado = 'falta justificada' and not _puede_justif then
            select a.estado into _actual
              from public.asistencia a
             where a.reunion_id = p_reunion_id
               and a.asistente_id = _rec.asistente_id
               and a.asistente_type = _rec.asistente_type;
            if _actual is distinct from 'falta justificada' then
                raise exception 'Para justificar una falta realiza el proceso acordado. Por favor selecciona "Injustificado".'
                    using errcode = 'insufficient_privilege';
            end if;
        end if;

        with up as (
            insert into public.asistencia
                (reunion_id, asistente_id, asistente_type, estado, nota, created_at, updated_at)
            values
                (p_reunion_id, _rec.asistente_id, _rec.asistente_type, _rec.estado, _rec.nota, now(), now())
            on conflict (reunion_id, asistente_id, asistente_type)
            do update set estado = excluded.estado, nota = excluded.nota, updated_at = now()
            returning (xmax = 0) as ins
        )
        select ins into _was_insert from up;

        if _was_insert then _n_ins := _n_ins + 1; else _n_upd := _n_upd + 1; end if;
    end loop;

    return jsonb_build_object('actualizadas', _n_upd, 'creadas', _n_ins);
end;
$function$;
