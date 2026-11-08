-- Restablecer contraseña por el admin de la parroquia (decisión 2026-11-08).
--
-- La Edge Function `admin-usuarios` (action 'reset_password') llama a esta
-- función con service_role para validar y obtener el auth_id del usuario.
--
-- Reglas:
--   - Quien resetea: super-admin de la parroquia o el proveedor. NO el
--     coordinador (si no, podría tomar la cuenta de su super-admin).
--   - A quién: un usuario activo de SU parroquia (el proveedor: cualquiera).
--   - Nunca a sí mismo (para eso está "Mi perfil") ni a un proveedor.

create or replace function public.fn_admin_reset_target(p_actor_auth uuid, p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    _act_id   bigint;
    _act_parr bigint;
    _act_prov boolean;
    _act_sa   boolean;
    _t        record;
begin
    select u.id, u.parroquia_id,
           exists(select 1 from model_has_roles m join roles r on r.id = m.role_id
                   where m.model_type = 'App\Models\User' and m.model_id = u.id and r.name = 'proveedor'),
           exists(select 1 from model_has_roles m join roles r on r.id = m.role_id
                   where m.model_type = 'App\Models\User' and m.model_id = u.id and r.name = 'super-admin')
      into _act_id, _act_parr, _act_prov, _act_sa
      from users u
     where u.auth_id = p_actor_auth and u.activo;

    if _act_id is null or not (_act_prov or _act_sa) then
        raise exception 'Solo el administrador de la parroquia puede restablecer contraseñas.'
            using errcode = 'insufficient_privilege';
    end if;

    select u.id, u.auth_id, u.name, u.parroquia_id, u.activo,
           exists(select 1 from model_has_roles m join roles r on r.id = m.role_id
                   where m.model_type = 'App\Models\User' and m.model_id = u.id and r.name = 'proveedor') as es_prov
      into _t
      from users u where u.id = p_id;

    if _t.id is null or (not _act_prov and _t.parroquia_id is distinct from _act_parr) then
        raise exception 'Usuario % no encontrado', p_id using errcode = 'no_data_found';
    end if;
    if _t.id = _act_id then
        raise exception 'Para cambiar tu propia contraseña usa "Mi perfil".' using errcode = 'check_violation';
    end if;
    if _t.es_prov then
        raise exception 'No se puede restablecer la contraseña del proveedor.' using errcode = 'insufficient_privilege';
    end if;
    if not _t.activo then
        raise exception 'El usuario está desactivado. Actívalo antes de restablecer su contraseña.'
            using errcode = 'check_violation';
    end if;
    if _t.auth_id is null then
        raise exception 'El usuario no tiene cuenta de acceso.' using errcode = 'check_violation';
    end if;

    return jsonb_build_object('auth_id', _t.auth_id, 'name', _t.name);
end
$$;

revoke all on function public.fn_admin_reset_target(uuid, bigint) from public, anon, authenticated;
grant execute on function public.fn_admin_reset_target(uuid, bigint) to service_role;
