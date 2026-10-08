-- =====================================================================
-- Programar sacramentos + módulo "Sacramentos programados".
--
-- Una celebración (programaciones_sacramento) tiene UN sacramento principal
-- (Bautismo / Primera Comunión / Confirmación), fecha y hora. Cada joven
-- programado queda en programacion_sacramento_detalle con el principal y,
-- opcionalmente, los sacramentos anteriores que le falten ("Incluir también
-- Bautismo"), para el caso extraordinario de recibir varios el mismo día.
--
-- Estados de confirmando_sacramento.estado:
--   pendiente  → se puede programar
--   programado → está en una celebración aún no registrada
--   recibido   → lo recibió (registrado desde "Sacramentos programados")
--
-- Todas las escrituras van por RPC SECURITY INVOKER: la RLS sigue actuando y,
-- además, cada función exige app_is_privileged() de entrada.
--
-- ANTES DE CORRER (no hay staging): ejecutar las consultas de solo lectura
-- del bloque "VERIFICACIÓN PREVIA" al final de este archivo y confirmar que
-- el esquema de permisos y el tipo de confirmando_sacramento.estado coinciden
-- con lo que asumen los pasos 1 y 6.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) confirmando_sacramento.estado admite 'programado'.
--    El CREATE TABLE original vive solo en producción: si el estado es un
--    enum se le agrega el valor; si es texto, se reemplaza cualquier CHECK
--    previo sobre la columna. NOT VALID: no re-valida filas históricas.
-- ---------------------------------------------------------------------
do $$
declare
    _tipo  regtype;
    _check record;
begin
    select a.atttypid::regtype into _tipo
      from pg_attribute a
     where a.attrelid = 'public.confirmando_sacramento'::regclass
       and a.attname = 'estado' and not a.attisdropped;

    if exists (select 1 from pg_type t where t.oid = _tipo and t.typtype = 'e') then
        execute format('alter type %s add value if not exists %L', _tipo, 'programado');
    else
        for _check in
            select c.conname
              from pg_constraint c
             where c.conrelid = 'public.confirmando_sacramento'::regclass
               and c.contype = 'c'
               and pg_get_constraintdef(c.oid) ilike '%estado%'
        loop
            execute format('alter table public.confirmando_sacramento drop constraint %I', _check.conname);
        end loop;

        alter table public.confirmando_sacramento
            add constraint confirmando_sacramento_estado_check
            check (estado in ('pendiente', 'programado', 'recibido')) not valid;
    end if;
end
$$;


-- ---------------------------------------------------------------------
-- 2) Tablas
-- ---------------------------------------------------------------------
create table if not exists public.programaciones_sacramento (
    id             bigint generated always as identity primary key,
    parroquia_id   bigint not null references public.parroquias(id),
    sacramento_id  bigint not null references public.sacramentos(id),
    -- Hora local de la parroquia, igual que reunions.fecha.
    fecha          timestamp without time zone not null,
    estado         text not null default 'programada',
    registrada_at  timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    constraint programaciones_sacramento_estado_check
        check (estado in ('programada', 'realizada', 'cancelada'))
);

create index if not exists idx_programaciones_sacramento_parroquia_fecha
    on public.programaciones_sacramento (parroquia_id, fecha);

create table if not exists public.programacion_sacramento_detalle (
    programacion_id  bigint not null references public.programaciones_sacramento(id) on delete cascade,
    confirmando_id   bigint not null references public.confirmandos(id) on delete cascade,
    sacramento_id    bigint not null references public.sacramentos(id),
    -- null = aún sin registrar; true/false = lo recibió / no lo recibió.
    recibio          boolean,
    primary key (programacion_id, confirmando_id, sacramento_id)
);

create index if not exists idx_prog_sac_detalle_confirmando
    on public.programacion_sacramento_detalle (confirmando_id);


-- ---------------------------------------------------------------------
-- 3) RLS: deny-all por defecto; mismas reglas que reunions.
--    Lectura: cualquier usuario con parroquia. Escritura: privilegiados.
--    RESTRICTIVE de parroquia: la cabecera por su columna; el detalle por
--    EXISTS correlacionado contra la cabecera (patrón de 20260913000000).
-- ---------------------------------------------------------------------
alter table public.programaciones_sacramento enable row level security;
alter table public.programaciones_sacramento force row level security;
alter table public.programacion_sacramento_detalle enable row level security;
alter table public.programacion_sacramento_detalle force row level security;

revoke all on public.programaciones_sacramento from anon, public;
revoke all on public.programacion_sacramento_detalle from anon, public;
grant select, insert, update, delete on public.programaciones_sacramento to authenticated;
grant select, insert, update, delete on public.programacion_sacramento_detalle to authenticated;

drop policy if exists programaciones_sacramento_select on public.programaciones_sacramento;
create policy programaciones_sacramento_select on public.programaciones_sacramento
    for select to authenticated
    using ((select app_current_parroquia_id()) is not null);

drop policy if exists programaciones_sacramento_write on public.programaciones_sacramento;
create policy programaciones_sacramento_write on public.programaciones_sacramento
    for all to authenticated
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

drop policy if exists programaciones_sacramento_parroquia on public.programaciones_sacramento;
create policy programaciones_sacramento_parroquia on public.programaciones_sacramento
    as restrictive for all to authenticated
    using ((select app_parroquia_ok(parroquia_id)))
    with check ((select app_parroquia_ok(parroquia_id)));

drop policy if exists programacion_sacramento_detalle_select on public.programacion_sacramento_detalle;
create policy programacion_sacramento_detalle_select on public.programacion_sacramento_detalle
    for select to authenticated
    using ((select app_current_parroquia_id()) is not null);

drop policy if exists programacion_sacramento_detalle_write on public.programacion_sacramento_detalle;
create policy programacion_sacramento_detalle_write on public.programacion_sacramento_detalle
    for all to authenticated
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

drop policy if exists programacion_sacramento_detalle_parroquia on public.programacion_sacramento_detalle;
create policy programacion_sacramento_detalle_parroquia on public.programacion_sacramento_detalle
    as restrictive for all to authenticated
    using (exists (
        select 1 from public.programaciones_sacramento p
         where p.id = programacion_sacramento_detalle.programacion_id
    ))
    with check (exists (
        select 1 from public.programaciones_sacramento p
         where p.id = programacion_sacramento_detalle.programacion_id
    ));


-- ---------------------------------------------------------------------
-- 4) Protección del estado 'programado'.
--    fn_guardar_confirmando (edición del joven) no conoce este estado; si
--    intenta bajarlo a 'pendiente' mientras la celebración sigue activa, se
--    conserva. Solo las RPC de este archivo (que marcan la transacción con
--    app.sacramentos_rpc) pueden sacar un sacramento de 'programado'.
-- ---------------------------------------------------------------------
create or replace function public.trg_confirmando_sacramento_proteger_programado()
 returns trigger
 language plpgsql
as $function$
BEGIN
    IF OLD.estado = 'programado'
       AND NEW.estado IS DISTINCT FROM 'programado'
       AND coalesce(current_setting('app.sacramentos_rpc', true), '') <> 'on' THEN
        NEW.estado := 'programado';
    END IF;
    RETURN NEW;
END;
$function$;

drop trigger if exists confirmando_sacramento_proteger_programado on public.confirmando_sacramento;
create trigger confirmando_sacramento_proteger_programado
    before update of estado on public.confirmando_sacramento
    for each row execute function public.trg_confirmando_sacramento_proteger_programado();


-- ---------------------------------------------------------------------
-- 5) RPCs
-- ---------------------------------------------------------------------

-- Orden canónico de la ruta sacramental (igual que RutaSacramental.vue).
create or replace function public._orden_sacramento(p_clave text)
 returns int
 language sql
 immutable
as $$
    select case p_clave when 'bautismo' then 1 when 'comunion' then 2 when 'confirmacion' then 3 end
$$;

-- "Ahora" en la hora local de la parroquia (fecha es timestamp sin zona).
create or replace function public._ahora_parroquia(p_parroquia_id bigint)
 returns timestamp
 language sql
 stable
as $$
    select now() at time zone coalesce(
        (select p.zona_horaria from public.parroquias p where p.id = p_parroquia_id),
        'America/Lima')
$$;


-- Cuántos jóvenes activos tienen pendiente cada sacramento (fichas del paso 1).
create or replace function public.fn_conteo_elegibles_sacramento()
 returns table (sacramento_id bigint, total bigint)
 language sql
 stable
as $$
    select s.id::bigint, count(cs.confirmando_id)
      from public.sacramentos s
      left join public.confirmando_sacramento cs
             on cs.sacramento_id = s.id and cs.estado = 'pendiente'
             and exists (select 1 from public.confirmandos c
                          where c.id = cs.confirmando_id and c.estado <> 'retirado')
     where s.clave in ('bautismo', 'comunion', 'confirmacion')
     group by s.id
$$;


-- Jóvenes que pueden recibir p_sacramento_id: activos con ese sacramento
-- pendiente, más los que ya están en p_programacion_id (al editar). Incluye
-- los sacramentos anteriores que tienen pendientes (o ya en esta programación).
create or replace function public.fn_elegibles_sacramento(
    p_sacramento_id   bigint,
    p_programacion_id bigint default null
)
 returns table (
    confirmando_id  bigint,
    nombres         text,
    apellidos       text,
    nombre_busqueda text,
    grupo_id        bigint,
    grupo_nombre    text,
    seleccionado    boolean,
    anteriores      jsonb
 )
 language sql
 stable
as $$
    with principal as (
        select s.id, public._orden_sacramento(s.clave) as orden
          from public.sacramentos s
         where s.id = p_sacramento_id
    ),
    en_prog as (
        select d.confirmando_id, d.sacramento_id
          from public.programacion_sacramento_detalle d
         where p_programacion_id is not null and d.programacion_id = p_programacion_id
    )
    -- Casts explícitos: el tipo real de las columnas heredadas (int/varchar)
    -- debe coincidir con RETURNS TABLE o la función falla en tiempo de ejecución.
    select c.id::bigint, c.nombres::text, c.apellidos::text, c.nombre_busqueda::text,
           c.grupo_id::bigint, g.nombre::text,
           exists (select 1 from en_prog e where e.confirmando_id = c.id) as seleccionado,
           coalesce((
               select jsonb_agg(jsonb_build_object(
                          'id', s2.id, 'nombre', s2.nombre, 'clave', s2.clave,
                          'incluido', exists (select 1 from en_prog e
                                               where e.confirmando_id = c.id and e.sacramento_id = s2.id))
                      order by public._orden_sacramento(s2.clave))
                 from public.confirmando_sacramento cs2
                 join public.sacramentos s2 on s2.id = cs2.sacramento_id
                where cs2.confirmando_id = c.id
                  and public._orden_sacramento(s2.clave) < (select orden from principal)
                  and (cs2.estado = 'pendiente'
                       or exists (select 1 from en_prog e
                                   where e.confirmando_id = c.id and e.sacramento_id = s2.id))
           ), '[]'::jsonb) as anteriores
      from public.confirmandos c
      join public.confirmando_sacramento cs
        on cs.confirmando_id = c.id and cs.sacramento_id = p_sacramento_id
      left join public.grupos g on g.id = c.grupo_id
     where c.estado <> 'retirado'
       and (cs.estado = 'pendiente'
            or exists (select 1 from en_prog e
                        where e.confirmando_id = c.id and e.sacramento_id = p_sacramento_id))
     order by c.apellidos, c.nombres
$$;


-- Crea (p_id null) o edita una celebración.
-- p_items = [{ "confirmando_id": 1, "sacramento_ids": [3, 1] }, ...]
create or replace function public.fn_programar_sacramento(
    p_id            bigint,
    p_sacramento_id bigint,
    p_fecha         timestamp,
    p_items         jsonb
)
 returns bigint
 language plpgsql
as $function$
DECLARE
    _pid          bigint := public.app_current_parroquia_id();
    _orden        int;
    _prog         public.programaciones_sacramento%ROWTYPE;
    _id           bigint;
    _n            int;
BEGIN
    IF NOT public.app_is_privileged() THEN
        RAISE EXCEPTION 'No tienes permiso para programar sacramentos'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF _pid IS NULL THEN
        RAISE EXCEPTION 'Sin parroquia en el contexto' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Serializa programaciones concurrentes de la parroquia: dos personas no
    -- pueden tomar al mismo joven a la vez.
    PERFORM pg_advisory_xact_lock(hashtext('prog_sacramento:' || _pid));
    PERFORM set_config('app.sacramentos_rpc', 'on', true);

    SELECT public._orden_sacramento(s.clave) INTO _orden
      FROM public.sacramentos s WHERE s.id = p_sacramento_id;
    IF _orden IS NULL THEN
        RAISE EXCEPTION 'Elige Bautismo, Primera Comunión o Confirmación' USING ERRCODE = 'check_violation';
    END IF;
    IF p_fecha IS NULL THEN
        RAISE EXCEPTION 'Indica la fecha y la hora' USING ERRCODE = 'check_violation';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Selecciona al menos un joven' USING ERRCODE = 'check_violation';
    END IF;

    IF p_id IS NOT NULL THEN
        SELECT * INTO _prog FROM public.programaciones_sacramento WHERE id = p_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La celebración no existe' USING ERRCODE = 'no_data_found';
        END IF;
        IF _prog.estado <> 'programada' THEN
            RAISE EXCEPTION 'Solo se puede editar una celebración que aún no se registra' USING ERRCODE = 'check_violation';
        END IF;
        IF _prog.sacramento_id <> p_sacramento_id THEN
            RAISE EXCEPTION 'No se puede cambiar el sacramento de una celebración; cancélala y programa otra'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    IF (p_id IS NULL OR p_fecha <> _prog.fecha) AND p_fecha <= public._ahora_parroquia(_pid) THEN
        RAISE EXCEPTION 'La fecha y la hora deben ser posteriores a este momento' USING ERRCODE = 'check_violation';
    END IF;

    -- Pares (joven, sacramento) pedidos; el principal siempre se agrega.
    CREATE TEMP TABLE IF NOT EXISTS _ps_items (
        confirmando_id bigint, sacramento_id bigint, primary key (confirmando_id, sacramento_id)
    ) ON COMMIT DROP;
    TRUNCATE _ps_items;

    BEGIN
        INSERT INTO _ps_items
        SELECT DISTINCT x.cid, x.sid FROM (
            SELECT (e->>'confirmando_id')::bigint AS cid, (s.v)::bigint AS sid
              FROM jsonb_array_elements(p_items) e
              CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(e->'sacramento_ids', '[]'::jsonb)) s(v)
            UNION
            SELECT (e->>'confirmando_id')::bigint, p_sacramento_id
              FROM jsonb_array_elements(p_items) e
        ) x;
    EXCEPTION WHEN invalid_text_representation OR null_value_not_allowed OR not_null_violation THEN
        RAISE EXCEPTION 'La lista de jóvenes no tiene un formato válido' USING ERRCODE = 'check_violation';
    END;

    -- Solo el principal o sacramentos ANTERIORES a él.
    IF EXISTS (
        SELECT 1 FROM _ps_items i
          LEFT JOIN public.sacramentos s ON s.id = i.sacramento_id
         WHERE public._orden_sacramento(s.clave) IS NULL
            OR public._orden_sacramento(s.clave) > _orden
    ) THEN
        RAISE EXCEPTION 'Solo se pueden incluir sacramentos anteriores al principal' USING ERRCODE = 'check_violation';
    END IF;

    -- Jóvenes visibles (RLS = misma parroquia) y activos.
    SELECT count(*) INTO _n
      FROM (SELECT DISTINCT confirmando_id FROM _ps_items) i
      LEFT JOIN public.confirmandos c ON c.id = i.confirmando_id AND c.estado <> 'retirado'
     WHERE c.id IS NULL;
    IF _n > 0 THEN
        RAISE EXCEPTION 'Hay % joven(es) que no existen o están retirados', _n USING ERRCODE = 'check_violation';
    END IF;

    -- Cada par debe estar pendiente, o ya en esta misma celebración.
    PERFORM 1 FROM public.confirmando_sacramento cs
      JOIN _ps_items i ON i.confirmando_id = cs.confirmando_id AND i.sacramento_id = cs.sacramento_id
       FOR UPDATE OF cs;

    SELECT count(*) INTO _n
      FROM _ps_items i
      LEFT JOIN public.confirmando_sacramento cs
             ON cs.confirmando_id = i.confirmando_id AND cs.sacramento_id = i.sacramento_id
     WHERE NOT (
            cs.estado = 'pendiente'
            OR (p_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.programacion_sacramento_detalle d
                     WHERE d.programacion_id = p_id
                       AND d.confirmando_id = i.confirmando_id
                       AND d.sacramento_id = i.sacramento_id))
           )
        OR cs.confirmando_id IS NULL;
    IF _n > 0 THEN
        RAISE EXCEPTION 'Hay % sacramento(s) que ya se recibieron o están en otra celebración. Actualiza la lista e inténtalo de nuevo', _n
            USING ERRCODE = 'check_violation';
    END IF;

    IF p_id IS NULL THEN
        INSERT INTO public.programaciones_sacramento (parroquia_id, sacramento_id, fecha)
        VALUES (_pid, p_sacramento_id, p_fecha)
        RETURNING id INTO _id;
    ELSE
        _id := p_id;
        UPDATE public.programaciones_sacramento
           SET fecha = p_fecha, updated_at = now()
         WHERE id = _id;

        -- Los que se quitaron vuelven a pendiente.
        UPDATE public.confirmando_sacramento cs
           SET estado = 'pendiente'
          FROM public.programacion_sacramento_detalle d
         WHERE d.programacion_id = _id
           AND cs.confirmando_id = d.confirmando_id AND cs.sacramento_id = d.sacramento_id
           AND NOT EXISTS (SELECT 1 FROM _ps_items i
                            WHERE i.confirmando_id = d.confirmando_id AND i.sacramento_id = d.sacramento_id);

        DELETE FROM public.programacion_sacramento_detalle d
         WHERE d.programacion_id = _id
           AND NOT EXISTS (SELECT 1 FROM _ps_items i
                            WHERE i.confirmando_id = d.confirmando_id AND i.sacramento_id = d.sacramento_id);
    END IF;

    INSERT INTO public.programacion_sacramento_detalle (programacion_id, confirmando_id, sacramento_id)
    SELECT _id, i.confirmando_id, i.sacramento_id FROM _ps_items i
    ON CONFLICT DO NOTHING;

    UPDATE public.confirmando_sacramento cs
       SET estado = 'programado'
      FROM _ps_items i
     WHERE cs.confirmando_id = i.confirmando_id AND cs.sacramento_id = i.sacramento_id
       AND cs.estado = 'pendiente';

    RETURN _id;
END;
$function$;


-- Cancela una celebración aún no registrada: todo su detalle vuelve a pendiente.
create or replace function public.fn_cancelar_programacion_sacramento(p_id bigint)
 returns void
 language plpgsql
as $function$
DECLARE
    _estado text;
BEGIN
    IF NOT public.app_is_privileged() THEN
        RAISE EXCEPTION 'No tienes permiso para cancelar celebraciones'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    PERFORM set_config('app.sacramentos_rpc', 'on', true);

    SELECT estado INTO _estado FROM public.programaciones_sacramento WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La celebración no existe' USING ERRCODE = 'no_data_found';
    END IF;
    IF _estado <> 'programada' THEN
        RAISE EXCEPTION 'Solo se puede cancelar una celebración que aún no se registra' USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.confirmando_sacramento cs
       SET estado = 'pendiente'
      FROM public.programacion_sacramento_detalle d
     WHERE d.programacion_id = p_id
       AND cs.confirmando_id = d.confirmando_id AND cs.sacramento_id = d.sacramento_id
       AND cs.estado = 'programado';

    UPDATE public.programaciones_sacramento
       SET estado = 'cancelada', updated_at = now()
     WHERE id = p_id;
END;
$function$;


-- Registra quién recibió cada sacramento de la celebración (se puede volver
-- a llamar para corregir). p_items = [{ confirmando_id, sacramento_id, recibio }]
-- Recibió → 'recibido'; no recibió → 'pendiente' (vuelve a ser elegible).
-- Confirmación recibida → confirmandos.estado = 'confirmado' (y al revés).
create or replace function public.fn_registrar_sacramentos(p_id bigint, p_items jsonb)
 returns void
 language plpgsql
as $function$
DECLARE
    _prog  public.programaciones_sacramento%ROWTYPE;
    _n     int;
BEGIN
    IF NOT public.app_is_privileged() THEN
        RAISE EXCEPTION 'No tienes permiso para registrar sacramentos'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    PERFORM set_config('app.sacramentos_rpc', 'on', true);

    SELECT * INTO _prog FROM public.programaciones_sacramento WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La celebración no existe' USING ERRCODE = 'no_data_found';
    END IF;
    IF _prog.estado = 'cancelada' THEN
        RAISE EXCEPTION 'La celebración está cancelada' USING ERRCODE = 'check_violation';
    END IF;
    IF _prog.fecha::date > public._ahora_parroquia(_prog.parroquia_id)::date THEN
        RAISE EXCEPTION 'Podrás registrar desde el día de la celebración' USING ERRCODE = 'check_violation';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'La lista de jóvenes no tiene un formato válido' USING ERRCODE = 'check_violation';
    END IF;

    CREATE TEMP TABLE IF NOT EXISTS _ps_registro (
        confirmando_id bigint, sacramento_id bigint, recibio boolean not null,
        primary key (confirmando_id, sacramento_id)
    ) ON COMMIT DROP;
    TRUNCATE _ps_registro;

    BEGIN
        INSERT INTO _ps_registro
        SELECT (e->>'confirmando_id')::bigint, (e->>'sacramento_id')::bigint, (e->>'recibio')::boolean
          FROM jsonb_array_elements(p_items) e;
    EXCEPTION WHEN invalid_text_representation OR not_null_violation OR unique_violation THEN
        RAISE EXCEPTION 'La lista de jóvenes no tiene un formato válido' USING ERRCODE = 'check_violation';
    END;

    -- Debe cubrir exactamente el detalle de la celebración.
    IF EXISTS (
        SELECT 1 FROM public.programacion_sacramento_detalle d
         WHERE d.programacion_id = p_id
           AND NOT EXISTS (SELECT 1 FROM _ps_registro r
                            WHERE r.confirmando_id = d.confirmando_id AND r.sacramento_id = d.sacramento_id)
    ) OR EXISTS (
        SELECT 1 FROM _ps_registro r
         WHERE NOT EXISTS (SELECT 1 FROM public.programacion_sacramento_detalle d
                            WHERE d.programacion_id = p_id
                              AND d.confirmando_id = r.confirmando_id AND d.sacramento_id = r.sacramento_id)
    ) THEN
        RAISE EXCEPTION 'Marca a todos los jóvenes de la celebración (recibió o no)' USING ERRCODE = 'check_violation';
    END IF;

    -- Al corregir una celebración ya registrada: si alguien que no lo recibió
    -- ya fue tomado por otra celebración, no se pisa ese estado.
    IF _prog.estado = 'realizada' THEN
        SELECT count(*) INTO _n
          FROM _ps_registro r
          JOIN public.confirmando_sacramento cs
            ON cs.confirmando_id = r.confirmando_id AND cs.sacramento_id = r.sacramento_id
         WHERE cs.estado = 'programado';
        IF _n > 0 THEN
            RAISE EXCEPTION 'Hay % joven(es) que ya están en otra celebración de este sacramento; quítalos de allí antes de corregir', _n
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    UPDATE public.programacion_sacramento_detalle d
       SET recibio = r.recibio
      FROM _ps_registro r
     WHERE d.programacion_id = p_id
       AND d.confirmando_id = r.confirmando_id AND d.sacramento_id = r.sacramento_id;

    UPDATE public.confirmando_sacramento cs
       SET estado = CASE WHEN r.recibio THEN 'recibido' ELSE 'pendiente' END
      FROM _ps_registro r
     WHERE cs.confirmando_id = r.confirmando_id AND cs.sacramento_id = r.sacramento_id;

    UPDATE public.confirmandos c
       SET estado = CASE WHEN r.recibio THEN 'confirmado' ELSE 'en_preparacion' END
      FROM _ps_registro r
      JOIN public.sacramentos s ON s.id = r.sacramento_id AND s.clave = 'confirmacion'
     WHERE c.id = r.confirmando_id
       AND c.estado <> 'retirado';

    UPDATE public.programaciones_sacramento
       SET estado = 'realizada', registrada_at = now(), updated_at = now()
     WHERE id = p_id;
END;
$function$;

revoke all on function public.fn_conteo_elegibles_sacramento() from anon, public;
revoke all on function public.fn_elegibles_sacramento(bigint, bigint) from anon, public;
revoke all on function public.fn_programar_sacramento(bigint, bigint, timestamp, jsonb) from anon, public;
revoke all on function public.fn_cancelar_programacion_sacramento(bigint) from anon, public;
revoke all on function public.fn_registrar_sacramentos(bigint, jsonb) from anon, public;
grant execute on function public.fn_conteo_elegibles_sacramento() to authenticated;
grant execute on function public.fn_elegibles_sacramento(bigint, bigint) to authenticated;
grant execute on function public.fn_programar_sacramento(bigint, bigint, timestamp, jsonb) to authenticated;
grant execute on function public.fn_cancelar_programacion_sacramento(bigint) to authenticated;
grant execute on function public.fn_registrar_sacramentos(bigint, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 6) Permisos de la app (gating de UI; la BD exige app_is_privileged()).
--    Asume el esquema heredado de Laravel/spatie (permissions +
--    role_has_permissions). Se asignan a los roles que ya pueden crear en el
--    cronograma; el resto se ajusta desde la pantalla de Roles.
-- ---------------------------------------------------------------------
do $$
declare
    _perm text;
begin
    if to_regclass('public.permissions') is null or to_regclass('public.role_has_permissions') is null then
        raise notice 'Tablas permissions/role_has_permissions no encontradas: crear los permisos a mano';
        return;
    end if;

    foreach _perm in array array['ver sacramentos programados', 'programar sacramentos', 'registrar sacramentos']
    loop
        insert into public.permissions (name, guard_name, created_at, updated_at)
        select _perm, 'web', now(), now()
         where not exists (select 1 from public.permissions where name = _perm);

        insert into public.role_has_permissions (permission_id, role_id)
        select p_new.id, rhp.role_id
          from public.permissions p_new
          join public.permissions p_ref on p_ref.name = 'crear cronograma'
          join public.role_has_permissions rhp on rhp.permission_id = p_ref.id
         where p_new.name = _perm
           and not exists (select 1 from public.role_has_permissions x
                            where x.permission_id = p_new.id and x.role_id = rhp.role_id);
    end loop;
end
$$;


-- =====================================================================
-- VERIFICACIÓN PREVIA (solo lectura; correr cada SELECT por separado
-- ANTES de aplicar el archivo)
-- =====================================================================
-- a) Tipo y CHECK actual de confirmando_sacramento.estado:
--    select a.atttypid::regtype from pg_attribute a
--     where a.attrelid = 'public.confirmando_sacramento'::regclass and a.attname = 'estado';
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.confirmando_sacramento'::regclass and contype = 'c';
--    select estado, count(*) from public.confirmando_sacramento group by 1;
--
-- b) Esquema de permisos (debe existir permissions(name, guard_name, ...)
--    y role_has_permissions(permission_id, role_id)):
--    select table_name, column_name from information_schema.columns
--     where table_schema = 'public' and table_name in ('permissions', 'role_has_permissions')
--     order by table_name, ordinal_position;
--
-- c) Que fn_guardar_confirmando actualice (y no borre/reinserte) las filas de
--    confirmando_sacramento; si las borra, el trigger del paso 4 no alcanza:
--    select pg_get_functiondef('public.fn_guardar_confirmando'::regproc);
--
-- VERIFICACIÓN POSTERIOR
-- d) supabase/tests/audit_rls_schema.sql (bloques 1–5): las 2 tablas nuevas
--    no deben aparecer en ningún bloque.
-- e) Con un usuario NO privilegiado:
--    select public.fn_programar_sacramento(null, 1, now()::timestamp + interval '1 day', '[{"confirmando_id":1}]');
--    → debe fallar con "No tienes permiso para programar sacramentos".
