-- Aislamiento por parroquia: denegar por defecto (fail-closed).
--
-- Antes:
--   app_parroquia_ok(x)    → true si el JWT no trae parroquia_id (cualquier
--                            usuario mal creado veía TODAS las parroquias).
--   app_parroquia_activa() → true si la parroquia del JWT no existe.
-- Ahora:
--   - Sin parroquia_id solo pasa el proveedor (claim es_proveedor).
--   - Parroquia inexistente = inactiva.
--   - users.parroquia_id es obligatorio salvo para el rol proveedor
--     (constraint trigger diferido: el rol se inserta en model_has_roles
--     DESPUÉS del usuario, dentro de la misma transacción).
--
-- No afecta a las RPC que llaman las Edge Functions con service_role
-- (fn_admin_*, fn_crear_parroquia, fn_importar/export_confirmandos): son
-- SECURITY DEFINER de `postgres` (BYPASSRLS) y resuelven al actor por
-- p_actor_auth, no por los claims.

create or replace function public.app_parroquia_ok(p_parroquia_id bigint)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
    select public.app_es_proveedor()
        or (public.app_current_parroquia_id() is not null
            and p_parroquia_id = public.app_current_parroquia_id())
$$;

create or replace function public.app_parroquia_activa()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.app_es_proveedor()
        or coalesce(
            (select p.activa from public.parroquias p
              where p.id = public.app_current_parroquia_id()),
            false
        )
$$;

-- users.parroquia_id obligatorio (salvo proveedor) -------------------------
create or replace function public.trg_users_requiere_parroquia()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    -- La fila pudo borrarse en la misma transacción.
    if not exists (select 1 from public.users where id = new.id) then
        return null;
    end if;
    if new.parroquia_id is null and not exists (
        select 1
          from public.model_has_roles mr
          join public.roles r on r.id = mr.role_id
         where mr.model_type = 'App\Models\User'
           and mr.model_id = new.id
           and r.name = 'proveedor'
    ) then
        raise exception 'El usuario debe pertenecer a una parroquia.'
            using errcode = 'check_violation';
    end if;
    return null;
end
$$;

drop trigger if exists users_requiere_parroquia on public.users;
create constraint trigger users_requiere_parroquia
    after insert or update of parroquia_id on public.users
    deferrable initially deferred
    for each row execute function public.trg_users_requiere_parroquia();
