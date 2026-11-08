-- Roles por parroquia.
--
-- Antes: `roles` era global. Un rol personalizado creado por una parroquia lo
-- veían, editaban y borraban todas las demás, y el nombre quedaba tomado para
-- todo el sistema.
--
-- Ahora (decisión 2026-11-08: "sistema global + propios"):
--   - roles.parroquia_id NULL  → rol global (los 4 del sistema, o uno que cree
--     el proveedor). Lo ven todas las parroquias; solo el proveedor lo edita.
--   - roles.parroquia_id = X   → rol propio de la parroquia X. Solo X lo ve,
--     edita, borra y asigna.
--   - Nombre único por parroquia (dos parroquias pueden tener "secretaria").
--
-- `roles` no tiene políticas para authenticated (FORCE RLS, sin GRANT útil):
-- todo acceso pasa por estas funciones SECURITY DEFINER.

-- 1) Esquema ---------------------------------------------------------------
alter table public.roles
    add column if not exists parroquia_id bigint
        references public.parroquias(id) on delete cascade;

create index if not exists idx_roles_parroquia_id on public.roles (parroquia_id);

alter table public.roles drop constraint if exists roles_name_guard_name_unique;
alter table public.roles drop constraint if exists roles_parroquia_name_guard_uq;
alter table public.roles add constraint roles_parroquia_name_guard_uq
    unique nulls not distinct (parroquia_id, name, guard_name);

-- 2) Listado: globales + los de mi parroquia (el proveedor ve todos) ---------
create or replace function public.fn_roles_lista()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
BEGIN
    IF NOT ('ver roles' = ANY(public.app_current_permisos()) OR public.app_es_proveedor()) THEN
        RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', r.id, 'name', r.name, 'guard_name', r.guard_name,
            'parroquia_id', r.parroquia_id,
            'es_global', r.parroquia_id IS NULL,
            'permissions', coalesce((
                SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) ORDER BY p.name)
                  FROM public.role_has_permissions rhp
                  JOIN public.permissions p ON p.id = rhp.permission_id
                 WHERE rhp.role_id = r.id
            ), '[]'::jsonb)
        ) ORDER BY r.id)
        FROM public.roles r
        WHERE r.guard_name = 'api'
          AND (r.name <> 'proveedor' OR public.app_es_proveedor())
          AND (public.app_es_proveedor()
               OR r.parroquia_id IS NULL
               OR r.parroquia_id = public.app_current_parroquia_id())
    ), '[]'::jsonb);
END;
$$;

-- 3) Crear / editar ---------------------------------------------------------
create or replace function public.fn_guardar_rol(p_id bigint, p_name text, p_permissions text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
DECLARE
    _perms   text[]  := public.app_current_permisos();
    _es_prov boolean := public.app_es_proveedor();
    _mi_parr bigint  := public.app_current_parroquia_id();
    _sistema text[]  := ARRAY['proveedor', 'super-admin', 'coordinador', 'catequista'];
    _tname   text;
    _tparr   bigint;
    _rid     bigint  := p_id;
BEGIN
    IF p_id IS NULL THEN
        IF NOT ('crear roles' = ANY(_perms) OR _es_prov) THEN
            RAISE EXCEPTION 'No autorizado para crear roles' USING ERRCODE = 'insufficient_privilege';
        END IF;
        IF NOT _es_prov AND _mi_parr IS NULL THEN
            RAISE EXCEPTION 'Tu usuario no pertenece a una parroquia' USING ERRCODE = 'insufficient_privilege';
        END IF;
    ELSE
        IF NOT ('editar roles' = ANY(_perms) OR _es_prov) THEN
            RAISE EXCEPTION 'No autorizado para editar roles' USING ERRCODE = 'insufficient_privilege';
        END IF;
        SELECT name, parroquia_id INTO _tname, _tparr
          FROM public.roles WHERE id = p_id AND guard_name = 'api';
        IF _tname IS NULL THEN
            RAISE EXCEPTION 'Rol % no encontrado', p_id USING ERRCODE = 'no_data_found';
        END IF;
        IF NOT _es_prov AND _tname = ANY(_sistema) THEN
            RAISE EXCEPTION 'Los roles del sistema solo los administra el proveedor de la plataforma.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
        -- Un rol global o de otra parroquia no se toca (se responde "no encontrado"
        -- para no revelar roles ajenos).
        IF NOT _es_prov AND _tparr IS DISTINCT FROM _mi_parr THEN
            IF _tparr IS NULL THEN
                RAISE EXCEPTION 'Los roles globales solo los administra el proveedor de la plataforma.'
                    USING ERRCODE = 'insufficient_privilege';
            END IF;
            RAISE EXCEPTION 'Rol % no encontrado', p_id USING ERRCODE = 'no_data_found';
        END IF;
    END IF;

    IF p_name IS NOT NULL THEN
        IF btrim(p_name) = '' THEN
            RAISE EXCEPTION 'El nombre del rol es obligatorio' USING ERRCODE = 'check_violation';
        END IF;
        IF btrim(p_name) = ANY(_sistema) THEN
            RAISE EXCEPTION 'Ese nombre está reservado para un rol del sistema' USING ERRCODE = 'check_violation';
        END IF;
    ELSIF p_id IS NULL THEN
        RAISE EXCEPTION 'El nombre del rol es obligatorio' USING ERRCODE = 'check_violation';
    END IF;

    IF p_permissions IS NOT NULL THEN
        IF (NOT _es_prov) AND EXISTS (SELECT 1 FROM unnest(p_permissions) x WHERE x <> ALL(_perms)) THEN
            RAISE EXCEPTION 'No puedes asignar un permiso que no tienes' USING ERRCODE = 'insufficient_privilege';
        END IF;
        IF EXISTS (SELECT 1 FROM unnest(p_permissions) x
                    WHERE x NOT IN (SELECT name FROM public.permissions WHERE guard_name = 'api')) THEN
            RAISE EXCEPTION 'Permiso no válido' USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    IF p_id IS NULL THEN
        -- Proveedor: _mi_parr es NULL → rol global.
        INSERT INTO public.roles (name, guard_name, parroquia_id, created_at, updated_at)
        VALUES (btrim(p_name), 'api', _mi_parr, now(), now())
        RETURNING id INTO _rid;
    ELSIF p_name IS NOT NULL THEN
        UPDATE public.roles SET name = btrim(p_name), updated_at = now() WHERE id = _rid;
    END IF;

    IF p_permissions IS NOT NULL THEN
        DELETE FROM public.role_has_permissions WHERE role_id = _rid;
        INSERT INTO public.role_has_permissions (permission_id, role_id)
        SELECT p.id, _rid FROM public.permissions p
         WHERE p.guard_name = 'api' AND p.name = ANY(p_permissions);
    END IF;

    RETURN (
        SELECT jsonb_build_object(
            'id', r.id, 'name', r.name, 'guard_name', r.guard_name,
            'parroquia_id', r.parroquia_id,
            'es_global', r.parroquia_id IS NULL,
            'permissions', coalesce((
                SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) ORDER BY p.name)
                  FROM public.role_has_permissions rhp
                  JOIN public.permissions p ON p.id = rhp.permission_id
                 WHERE rhp.role_id = r.id
            ), '[]'::jsonb)
        )
        FROM public.roles r WHERE r.id = _rid
    );
END;
$$;

-- 4) Eliminar ---------------------------------------------------------------
create or replace function public.fn_eliminar_rol(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
DECLARE
    _perms   text[]  := public.app_current_permisos();
    _es_prov boolean := public.app_es_proveedor();
    _sistema text[]  := ARRAY['proveedor', 'super-admin', 'coordinador', 'catequista'];
    _tname   text;
    _tparr   bigint;
BEGIN
    IF NOT ('eliminar roles' = ANY(_perms) OR _es_prov) THEN
        RAISE EXCEPTION 'No autorizado para eliminar roles' USING ERRCODE = 'insufficient_privilege';
    END IF;
    SELECT name, parroquia_id INTO _tname, _tparr
      FROM public.roles WHERE id = p_id AND guard_name = 'api';
    IF _tname IS NULL
       OR (NOT _es_prov AND _tparr IS NOT NULL AND _tparr IS DISTINCT FROM public.app_current_parroquia_id()) THEN
        RAISE EXCEPTION 'Rol % no encontrado', p_id USING ERRCODE = 'no_data_found';
    END IF;
    IF _tname = ANY(_sistema) THEN
        RAISE EXCEPTION 'No puedes eliminar roles del sistema' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NOT _es_prov AND _tparr IS NULL THEN
        RAISE EXCEPTION 'Los roles globales solo los administra el proveedor de la plataforma.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    DELETE FROM public.roles WHERE id = p_id;  -- role_has_permissions / model_has_roles: FK CASCADE
    RETURN jsonb_build_object('id', p_id);
END;
$$;

-- 5) Asignar roles a un usuario: solo globales o de SU parroquia -------------
do $$
declare
    f   regprocedure := 'public.fn_admin_guardar_usuario(uuid,bigint,uuid,jsonb,text[],bigint[],text)'::regprocedure;
    def text := pg_get_functiondef(f);
    viejo text := 'FROM public.roles r WHERE r.guard_name = ''api'' AND r.name = ANY(p_roles);';
    nuevo text := 'FROM public.roles r WHERE r.guard_name = ''api'' AND r.name = ANY(p_roles)
           AND (r.parroquia_id IS NULL
                OR r.parroquia_id = (SELECT u2.parroquia_id FROM public.users u2 WHERE u2.id = p_id));';
begin
    if position(viejo in def) = 0 then
        raise exception 'fn_admin_guardar_usuario cambió: no se encontró el INSERT de roles a parchear';
    end if;
    execute replace(def, viejo, nuevo);
end
$$;
