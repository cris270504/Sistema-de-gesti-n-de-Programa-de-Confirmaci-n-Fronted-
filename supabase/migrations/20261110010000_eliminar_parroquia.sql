-- =====================================================================
-- Eliminar una parroquia (solo el proveedor de la plataforma)
-- =====================================================================
-- Borra en cascada TODO lo de la parroquia. Irreversible: solo un backup lo
-- recupera. Requisitos:
--   - quien llama es proveedor (se verifica contra la BD, no solo el JWT),
--   - la parroquia está DESACTIVADA (paso previo obligatorio),
--   - no es la plantilla de parroquias nuevas,
--   - p_confirmacion coincide con el nombre de la parroquia.
--
-- La ejecuta solo service_role, desde la Edge Function `eliminar-parroquia`,
-- que además borra los auth.users devueltos y los logos del bucket branding.
-- Los triggers *_bloquea_borrado (asistencia, grupos con jóvenes) se respetan:
-- se borra en el orden que los deja satisfechos.
-- =====================================================================

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
