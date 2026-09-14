-- =====================================================================
-- Justificaciones: tipo de acción reparadora (Lectura/Colecta/Otros) con
-- cupo por fecha_acuerdo, y bloqueo de "validar cumplimiento" antes de la
-- fecha pactada.
-- =====================================================================
-- 1) Nueva columna tipo_accion en justificaciones + índice de soporte para
--    el conteo de cupo.
-- 2) fn_justificacion_acuerdo: valida tipo_accion, exige detalle si es
--    'otros', y aplica el cupo (3 lectura / 6 colecta) por fecha_acuerdo.
--    Usa un advisory lock POR FECHA+TIPO (no solo por asistencia_id como
--    antes) para que dos registros concurrentes para el mismo cupo no se
--    pisen y lo dejen pasar de largo.
-- 3) fn_justificacion_completar: ya no permite marcar cumplido antes de
--    fecha_acuerdo.
-- 4) fn_justificaciones_pendientes: expone tipo_accion en el resultado.
-- =====================================================================

alter table public.justificaciones
    add column if not exists tipo_accion text;

alter table public.justificaciones
    drop constraint if exists justificaciones_tipo_accion_check;

alter table public.justificaciones
    add constraint justificaciones_tipo_accion_check
    check (tipo_accion is null or tipo_accion in ('lectura', 'colecta', 'otros'));

create index if not exists idx_justificaciones_cupo
    on public.justificaciones (fecha_acuerdo, tipo_accion)
    where estado <> 'no_cumplido';


-- ---------------------------------------------------------------------
-- fn_justificacion_acuerdo: agrega p_tipo_accion (cambia la firma, hay que
-- dropear la versión vieja primero).
-- ---------------------------------------------------------------------

drop function if exists public.fn_justificacion_acuerdo(bigint, text, text, date);

create function public.fn_justificacion_acuerdo(
    p_asistencia_id bigint,
    p_motivo text,
    p_descripcion text,
    p_fecha_acuerdo date,
    p_tipo_accion text default null
)
returns void
language plpgsql
as $function$
declare
    _estado text;
    _tipo text;
    _cupo_actual bigint;
    _cupo_max int;
begin
    perform pg_advisory_xact_lock(hashtext('justif:' || p_asistencia_id));

    if not public._justif_puede(p_asistencia_id) then
        raise exception 'No autorizado para justificar esta asistencia' using errcode = 'insufficient_privilege';
    end if;

    select estado into _estado from public.asistencia where id = p_asistencia_id;
    if _estado is null then
        raise exception 'Asistencia % no encontrada', p_asistencia_id using errcode = 'no_data_found';
    end if;
    if _estado not in ('falta justificada', 'falta injustificada') then
        raise exception 'Solo se registran acuerdos de justificación sobre faltas (estado actual: %)', _estado
            using errcode = 'check_violation';
    end if;

    if p_fecha_acuerdo is null
       or p_fecha_acuerdo < date '2020-01-01'
       or p_fecha_acuerdo > (current_date + interval '1 year') then
        raise exception 'La fecha del acuerdo no es válida' using errcode = 'check_violation';
    end if;

    _tipo := lower(trim(coalesce(p_tipo_accion, '')));
    if _tipo not in ('lectura', 'colecta', 'otros') then
        raise exception 'Debes elegir un tipo de acción reparadora (Lectura, Colecta u Otros)' using errcode = 'check_violation';
    end if;

    if _tipo = 'otros' and length(trim(coalesce(p_descripcion, ''))) = 0 then
        raise exception 'Especifica el detalle de la acción reparadora' using errcode = 'check_violation';
    end if;

    if _tipo in ('lectura', 'colecta') then
        -- Lock por fecha+tipo (no por asistencia_id): sin esto, dos registros
        -- concurrentes para el mismo cupo podrían leer el mismo conteo antes
        -- de que ninguno haga commit, y las dos pasarían el chequeo.
        perform pg_advisory_xact_lock(hashtext('justif_cupo:' || p_fecha_acuerdo::text || ':' || _tipo));

        _cupo_max := case _tipo when 'lectura' then 3 when 'colecta' then 6 end;

        select count(*) into _cupo_actual
        from public.justificaciones
        where fecha_acuerdo = p_fecha_acuerdo
          and tipo_accion = _tipo
          and estado <> 'no_cumplido'
          and asistencia_id <> p_asistencia_id;

        if _cupo_actual >= _cupo_max then
            raise exception 'Ya se han escogido a % % para % del %',
                _cupo_max,
                (case _tipo when 'lectura' then 'lectores' else 'personas para la colecta' end),
                (case _tipo when 'lectura' then 'la misa' else 'la colecta' end),
                to_char(p_fecha_acuerdo, 'DD/MM/YYYY')
                using errcode = 'check_violation';
        end if;
    end if;

    insert into public.justificaciones
        (asistencia_id, motivo, descripcion, fecha_acuerdo, tipo_accion, estado, created_at, updated_at)
    values
        (p_asistencia_id, left(coalesce(p_motivo, ''), 300),
         case when _tipo = 'otros' then left(trim(p_descripcion), 1000) else null end,
         p_fecha_acuerdo, _tipo, 'pendiente', now(), now())
    on conflict (asistencia_id) do update set
        motivo        = excluded.motivo,
        descripcion   = excluded.descripcion,
        fecha_acuerdo = excluded.fecha_acuerdo,
        tipo_accion   = excluded.tipo_accion,
        estado        = 'pendiente',
        updated_at    = now();
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_justificacion_completar: misma firma, solo agrega el gate de fecha.
-- ---------------------------------------------------------------------

create or replace function public.fn_justificacion_completar(p_asistencia_id bigint)
 returns void
 language plpgsql
as $function$
declare _motivo text; _estado text; _fecha_acuerdo date;
begin
    perform pg_advisory_xact_lock(hashtext('justif:' || p_asistencia_id));

    if not public._justif_puede(p_asistencia_id) then
        raise exception 'No autorizado para gestionar esta justificación' using errcode = 'insufficient_privilege';
    end if;

    select estado into _estado from public.asistencia where id = p_asistencia_id;
    if _estado not in ('falta justificada', 'falta injustificada') then
        raise exception 'La asistencia ya no es una falta (estado: %)', _estado using errcode = 'check_violation';
    end if;

    select fecha_acuerdo into _fecha_acuerdo from public.justificaciones where asistencia_id = p_asistencia_id;
    if _fecha_acuerdo is null then
        raise exception 'No hay acuerdo para la asistencia %', p_asistencia_id using errcode = 'no_data_found';
    end if;
    if _fecha_acuerdo > current_date then
        raise exception 'Todavía no se puede validar: la acción reparadora está pactada para el %', to_char(_fecha_acuerdo, 'DD/MM/YYYY')
            using errcode = 'check_violation';
    end if;

    update public.justificaciones set estado = 'justificado', updated_at = now()
     where asistencia_id = p_asistencia_id
    returning motivo into _motivo;
    if not found then
        raise exception 'No hay acuerdo para la asistencia %', p_asistencia_id using errcode = 'no_data_found';
    end if;

    update public.asistencia
       set estado = 'falta justificada', nota = 'Justificado: ' || coalesce(_motivo, '')
     where id = p_asistencia_id;
    if not found then
        raise exception 'No se pudo actualizar la asistencia %', p_asistencia_id using errcode = 'no_data_found';
    end if;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_justificaciones_pendientes: agrega tipo_accion a la salida (cambia el
-- rowtype -> hay que dropear primero, igual que la vez pasada).
-- ---------------------------------------------------------------------

drop function if exists public.fn_justificaciones_pendientes(integer);

create function public.fn_justificaciones_pendientes(p_limit integer default 500)
returns table (
    asistencia_id bigint,
    fecha_falta timestamp,
    tema_reunion text,
    confirmando_id bigint,
    confirmando text,
    grupo text,
    apoderado_nombre text,
    apoderado_celular text,
    justificacion_id bigint,
    motivo text,
    descripcion text,
    tipo_accion text,
    fecha_acuerdo text,
    estado_justificacion text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
    v_privileged   boolean := app_is_privileged();
    v_es_proveedor boolean := app_es_proveedor();
    v_parroquia_id bigint  := app_current_parroquia_id();
    v_grupo_ids    bigint[] := array(select app_user_grupo_ids());
    v_dias         integer;
begin
    select coalesce(pc.dias_ventana_justificacion::integer, 21)
      into v_dias
    from public.parroquia_configuraciones pc
    where v_es_proveedor
       or (v_parroquia_id is not null and pc.parroquia_id = v_parroquia_id)
    limit 1;

    v_dias := coalesce(v_dias, 21);

    return query
    select
        a.id,
        r.fecha,
        r.nombre_tema::text,
        c.id,
        (c.apellidos::text || ', ' || c.nombres::text),
        coalesce(g.nombre::text, 'Sin Grupo'),
        coalesce((ap.apellidos::text || ', ' || ap.nombres::text), 'No registrado'),
        coalesce(ap.celular::text, 'Sin celular'),
        j.id,
        coalesce(j.motivo::text, ''),
        coalesce(j.descripcion::text, ''),
        coalesce(j.tipo_accion::text, ''),
        coalesce(j.fecha_acuerdo::text, ''),
        coalesce(j.estado::text, 'injustificado')
    from asistencia a
    join confirmandos c
        on c.id = a.asistente_id
       and a.asistente_type = 'App\Models\Confirmando'
       and (v_privileged or c.grupo_id = any (v_grupo_ids))
       and (v_parroquia_id is null or v_es_proveedor or c.parroquia_id = v_parroquia_id)
    join reunions r
        on r.id = a.reunion_id
       and (v_es_proveedor or (v_parroquia_id is not null and r.parroquia_id = v_parroquia_id))
    left join grupos g
        on g.id = c.grupo_id
       and (v_privileged or g.id = any (v_grupo_ids))
       and (v_parroquia_id is null or v_es_proveedor or g.parroquia_id = v_parroquia_id)
    left join justificaciones j
        on j.asistencia_id = a.id
    left join lateral (
        select ap_1.apellidos, ap_1.nombres, ap_1.celular
        from confirmando_apoderado ca
        join apoderados ap_1
            on ap_1.id = ca.apoderado_id
           and (v_parroquia_id is null or v_es_proveedor or ap_1.parroquia_id = v_parroquia_id)
        where ca.confirmando_id = c.id
        order by ca.id
        limit 1
    ) ap on true
    where c.estado <> 'retirado'
      and (
            a.estado = 'falta injustificada'
            or (j.id is not null and j.estado <> 'no_cumplido')
          )
      and (
            (j.id is not null and j.estado in ('pendiente', 'justificado'))
            or (
                 a.estado = 'falta injustificada'
                 and r.fecha >= (now() - make_interval(days => v_dias))
                 and r.fecha <= now()
               )
          )
    order by r.fecha desc
    limit p_limit;
end;
$function$;

revoke all on function public.fn_justificaciones_pendientes(integer) from public;
grant execute on function public.fn_justificaciones_pendientes(integer) to authenticated;
