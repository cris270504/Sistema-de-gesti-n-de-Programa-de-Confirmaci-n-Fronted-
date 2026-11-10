-- =====================================================================
-- Historial de acciones del proveedor
-- =====================================================================
-- Registro de lo que hace el proveedor sobre la plataforma: crear, editar,
-- activar/desactivar, plantilla y eliminar parroquias, mantenimiento y
-- restablecer contraseñas. Sirve de respaldo ante reclamos de una parroquia.
--
-- - parroquia_id SIN FK y con el nombre copiado: el registro sobrevive a la
--   eliminación de la parroquia.
-- - Solo el proveedor lo lee (RLS). Nadie escribe por la API: entran filas
--   desde triggers y funciones SECURITY DEFINER.
-- =====================================================================

create table if not exists public.proveedor_auditoria (
    id               bigint generated always as identity primary key,
    created_at       timestamptz not null default now(),
    actor_auth       uuid,
    actor_nombre     text,
    accion           text not null check (accion in (
                        'crear', 'editar', 'renombrar', 'activar', 'desactivar', 'plantilla',
                        'eliminar', 'mantenimiento_on', 'mantenimiento_off', 'restablecer_contrasena')),
    parroquia_id     bigint,
    parroquia_nombre text,
    detalle          jsonb not null default '{}'::jsonb
);

create index if not exists proveedor_auditoria_created_at_idx on public.proveedor_auditoria (created_at desc);

alter table public.proveedor_auditoria enable row level security;
-- Por defecto nada; solo lectura para el proveedor.
drop policy if exists proveedor_auditoria_select on public.proveedor_auditoria;
create policy proveedor_auditoria_select on public.proveedor_auditoria
    for select to authenticated
    using (public.app_es_proveedor());

revoke all on public.proveedor_auditoria from anon, authenticated;
grant select on public.proveedor_auditoria to authenticated;

-- ---------------------------------------------------------------------
-- Inserción común: resuelve el nombre del actor y de la parroquia.
-- ---------------------------------------------------------------------
create or replace function public._auditoria_insertar(
    p_actor_auth uuid, p_accion text, p_parroquia_id bigint, p_parroquia_nombre text, p_detalle jsonb
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
BEGIN
    INSERT INTO public.proveedor_auditoria
        (actor_auth, actor_nombre, accion, parroquia_id, parroquia_nombre, detalle)
    VALUES (
        p_actor_auth,
        (SELECT u.name FROM public.users u WHERE u.auth_id = p_actor_auth LIMIT 1),
        p_accion,
        p_parroquia_id,
        coalesce(p_parroquia_nombre, (SELECT p.nombre FROM public.parroquias p WHERE p.id = p_parroquia_id)),
        coalesce(p_detalle, '{}'::jsonb)
    );
END;
$function$;
revoke execute on function public._auditoria_insertar(uuid, text, bigint, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Registro desde Edge Functions (service_role): crear parroquia y
-- restablecer contraseña. Solo registra si el actor es proveedor.
-- ---------------------------------------------------------------------
create or replace function public.fn_auditoria_registrar(
    p_actor_auth uuid, p_accion text, p_parroquia_id bigint default null,
    p_detalle jsonb default '{}'::jsonb, p_usuario_id bigint default null
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
    _act record;
    _pid bigint := p_parroquia_id;
BEGIN
    SELECT * INTO _act FROM public.app_actor_ctx(p_actor_auth);
    IF _act.id IS NULL OR NOT _act.proveedor THEN
        RETURN;
    END IF;
    IF _pid IS NULL AND p_usuario_id IS NOT NULL THEN
        SELECT parroquia_id INTO _pid FROM public.users WHERE id = p_usuario_id;
    END IF;
    PERFORM public._auditoria_insertar(p_actor_auth, p_accion, _pid, NULL, p_detalle);
END;
$function$;
revoke execute on function public.fn_auditoria_registrar(uuid, text, bigint, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.fn_auditoria_registrar(uuid, text, bigint, jsonb, bigint) to service_role;

-- ---------------------------------------------------------------------
-- Cambios hechos por la API con la sesión del proveedor (auth.uid()).
-- ---------------------------------------------------------------------
create or replace function public.trg_parroquias_auditoria()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
    _actor uuid := auth.uid();
BEGIN
    IF NEW.activa IS DISTINCT FROM OLD.activa THEN
        PERFORM public._auditoria_insertar(_actor, CASE WHEN NEW.activa THEN 'activar' ELSE 'desactivar' END,
            NEW.id, NEW.nombre, '{}'::jsonb);
    END IF;
    IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
        PERFORM public._auditoria_insertar(_actor, 'renombrar', NEW.id, NEW.nombre,
            jsonb_build_object('antes', OLD.nombre, 'despues', NEW.nombre));
    END IF;
    IF NEW.es_plantilla AND NOT coalesce(OLD.es_plantilla, false) THEN
        PERFORM public._auditoria_insertar(_actor, 'plantilla', NEW.id, NEW.nombre, '{}'::jsonb);
    END IF;
    IF NEW.slug IS DISTINCT FROM OLD.slug OR NEW.zona_horaria IS DISTINCT FROM OLD.zona_horaria THEN
        PERFORM public._auditoria_insertar(_actor, 'editar', NEW.id, NEW.nombre,
            jsonb_strip_nulls(jsonb_build_object(
                'slug', CASE WHEN NEW.slug IS DISTINCT FROM OLD.slug THEN NEW.slug END,
                'zona_horaria', CASE WHEN NEW.zona_horaria IS DISTINCT FROM OLD.zona_horaria THEN NEW.zona_horaria END)));
    END IF;
    RETURN NULL;
END;
$function$;
revoke execute on function public.trg_parroquias_auditoria() from public, anon, authenticated;

drop trigger if exists parroquias_auditoria on public.parroquias;
create trigger parroquias_auditoria
    after update on public.parroquias
    for each row execute function public.trg_parroquias_auditoria();

create or replace function public.trg_system_status_auditoria()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
BEGIN
    IF NEW.mantenimiento IS DISTINCT FROM OLD.mantenimiento THEN
        PERFORM public._auditoria_insertar(auth.uid(),
            CASE WHEN NEW.mantenimiento THEN 'mantenimiento_on' ELSE 'mantenimiento_off' END,
            NULL, NULL,
            CASE WHEN NEW.mantenimiento THEN jsonb_strip_nulls(jsonb_build_object(
                'alcance', NEW.alcance, 'parroquia_ids', to_jsonb(NEW.parroquia_ids), 'mensaje', NEW.mensaje))
            ELSE '{}'::jsonb END);
    END IF;
    RETURN NULL;
END;
$function$;
revoke execute on function public.trg_system_status_auditoria() from public, anon, authenticated;

drop trigger if exists system_status_auditoria on public.system_status;
create trigger system_status_auditoria
    after update on public.system_status
    for each row execute function public.trg_system_status_auditoria();

-- ---------------------------------------------------------------------
-- Eliminar parroquia: misma función, ahora deja constancia (con el resumen
-- de lo borrado) antes de devolver el resultado.
-- ---------------------------------------------------------------------
create or replace function public.fn_proveedor_eliminar_parroquia(
    p_actor_auth uuid, p_id bigint, p_confirmacion text
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
    _act      record;
    _par      public.parroquias%ROWTYPE;
    _users    bigint[];
    _auth_ids uuid[];
    _conf     bigint[];
    _apod     bigint[];
    _reun     bigint[];
    _n_conf   int;
    _n_users  int;
    _n_grupos int;
    _n_reun   int;
BEGIN
    SELECT * INTO _act FROM public.app_actor_ctx(p_actor_auth);
    IF _act.id IS NULL OR NOT _act.proveedor THEN
        RAISE EXCEPTION 'Solo el proveedor de la plataforma puede eliminar parroquias.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO _par FROM public.parroquias WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La parroquia no existe.' USING ERRCODE = 'no_data_found';
    END IF;
    IF _par.activa THEN
        RAISE EXCEPTION 'Primero desactiva la parroquia; solo se puede eliminar una parroquia desactivada.'
            USING ERRCODE = 'check_violation';
    END IF;
    IF _par.es_plantilla THEN
        RAISE EXCEPTION 'Es la plantilla de las parroquias nuevas. Marca otra como plantilla antes de eliminarla.'
            USING ERRCODE = 'check_violation';
    END IF;
    IF lower(btrim(coalesce(p_confirmacion, ''))) <> lower(btrim(_par.nombre)) THEN
        RAISE EXCEPTION 'El nombre escrito no coincide con el de la parroquia.'
            USING ERRCODE = 'check_violation';
    END IF;
    IF _act.parroquia_id = p_id THEN
        RAISE EXCEPTION 'No puedes eliminar la parroquia de tu propia cuenta.' USING ERRCODE = 'check_violation';
    END IF;

    SELECT coalesce(array_agg(id), '{}'), coalesce(array_agg(auth_id) FILTER (WHERE auth_id IS NOT NULL), '{}')
      INTO _users, _auth_ids
      FROM public.users WHERE parroquia_id = p_id;
    -- Nunca borrar una cuenta de proveedor por arrastre.
    IF EXISTS (
        SELECT 1 FROM public.model_has_roles m JOIN public.roles r ON r.id = m.role_id
         WHERE m.model_type = 'App\Models\User' AND m.model_id = ANY(_users) AND r.name = 'proveedor'
    ) THEN
        RAISE EXCEPTION 'La parroquia tiene una cuenta de proveedor; muévela antes de eliminarla.'
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT coalesce(array_agg(id), '{}') INTO _conf FROM public.confirmandos WHERE parroquia_id = p_id;
    SELECT coalesce(array_agg(id), '{}') INTO _apod FROM public.apoderados   WHERE parroquia_id = p_id;
    SELECT coalesce(array_agg(id), '{}') INTO _reun FROM public.reunions     WHERE parroquia_id = p_id;
    _n_conf  := cardinality(_conf);
    _n_users := cardinality(_users);
    _n_reun  := cardinality(_reun);
    SELECT count(*) INTO _n_grupos FROM public.grupos WHERE parroquia_id = p_id;

    -- 1) Asistencia (y justificaciones por cascada): de sus reuniones y de sus personas.
    DELETE FROM public.asistencia
     WHERE reunion_id = ANY(_reun)
        OR (asistente_type = 'App\Models\Confirmando' AND asistente_id = ANY(_conf))
        OR (asistente_type = 'App\Models\Apoderado'   AND asistente_id = ANY(_apod))
        OR (asistente_type = 'App\Models\User'        AND asistente_id = ANY(_users));

    -- 2) Celebraciones de sacramentos (detalle por cascada).
    DELETE FROM public.programaciones_sacramento WHERE parroquia_id = p_id;

    -- 3) Reuniones (momentos, responsables y reunion_user por cascada).
    DELETE FROM public.reunion_momentos WHERE reunion_id = ANY(_reun);
    DELETE FROM public.reunions WHERE id = ANY(_reun);

    -- 4) Jóvenes (sacramentos, requisitos y apoderados vinculados por cascada) y apoderados.
    DELETE FROM public.confirmandos WHERE id = ANY(_conf);
    DELETE FROM public.apoderados WHERE id = ANY(_apod);

    -- 5) Usuarios: roles/permisos polimórficos y la fila (catequista_grupo por cascada).
    DELETE FROM public.model_has_roles
     WHERE model_type = 'App\Models\User' AND model_id = ANY(_users);
    DELETE FROM public.model_has_permissions
     WHERE model_type = 'App\Models\User' AND model_id = ANY(_users);
    DELETE FROM public.frontend_error_logs WHERE parroquia_id = p_id OR user_id = ANY(_users);
    DELETE FROM public.users WHERE id = ANY(_users);

    -- 6) Catálogos de la parroquia.
    DELETE FROM public.grupos WHERE parroquia_id = p_id;
    DELETE FROM public.sacramentos WHERE parroquia_id = p_id;      -- sacramento_requisito por cascada
    DELETE FROM public.requisitos WHERE parroquia_id = p_id;
    DELETE FROM public.tipo_apoderados WHERE parroquia_id = p_id;
    DELETE FROM public.reunion_categorias WHERE parroquia_id = p_id;
    DELETE FROM public.roles WHERE parroquia_id = p_id;            -- role_has_permissions por cascada
    DELETE FROM public.parroquia_configuraciones WHERE parroquia_id = p_id;

    -- 7) Mantenimiento dirigido a esta parroquia.
    UPDATE public.system_status
       SET parroquia_ids = array_remove(parroquia_ids, p_id)
     WHERE p_id = ANY(parroquia_ids);

    DELETE FROM public.parroquias WHERE id = p_id;

    PERFORM public._auditoria_insertar(p_actor_auth, 'eliminar', p_id, _par.nombre,
        jsonb_build_object('usuarios', _n_users, 'confirmandos', _n_conf, 'grupos', _n_grupos, 'reuniones', _n_reun));

    RETURN jsonb_build_object(
        'nombre', _par.nombre,
        'auth_ids', to_jsonb(_auth_ids),
        'resumen', jsonb_build_object(
            'usuarios', _n_users, 'confirmandos', _n_conf, 'grupos', _n_grupos, 'reuniones', _n_reun
        )
    );
END;
$function$;

revoke execute on function public.fn_proveedor_eliminar_parroquia(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.fn_proveedor_eliminar_parroquia(uuid, bigint, text) to service_role;
