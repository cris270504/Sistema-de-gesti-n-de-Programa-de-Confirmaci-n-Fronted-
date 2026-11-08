-- "Mi perfil" para cualquier usuario.
--
-- Antes: el perfil guardaba nombre/correo con admin-usuarios → update, que
-- exige ser coordinador/super-admin. Un catequista recibía "No autorizado".
--
-- Ahora: admin-usuarios → update_self llama a esta función (solo service_role)
-- con el auth.uid() real; cada uno edita SOLO su nombre y correo. DNI, roles,
-- grupos y estado siguen siendo cosa del admin.

create or replace function public.fn_actualizar_mi_perfil(p_actor_auth uuid, p_name text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    _u      record;
    _nombre text := btrim(coalesce(p_name, ''));
    _email  text := lower(btrim(coalesce(p_email, '')));
begin
    select id, email into _u from users where auth_id = p_actor_auth and activo;
    if _u.id is null then
        raise exception 'Tu cuenta no está activa.' using errcode = 'insufficient_privilege';
    end if;

    if _nombre = '' then
        raise exception 'El nombre es obligatorio.' using errcode = 'check_violation';
    end if;
    if length(_nombre) > 255 then
        raise exception 'El nombre es demasiado largo.' using errcode = 'check_violation';
    end if;
    -- Sin correo solo si la cuenta nunca tuvo (catequistas que entran con DNI).
    if _email = '' then
        if _u.email is not null and btrim(_u.email) <> '' then
            raise exception 'El correo es obligatorio.' using errcode = 'check_violation';
        end if;
        update users set name = _nombre, updated_at = now() where id = _u.id;
        return jsonb_build_object(
            'user', jsonb_build_object('id', _u.id, 'name', _nombre, 'email', null),
            'email_anterior', _u.email
        );
    end if;
    if length(_email) > 255 or _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'El correo no tiene un formato válido.' using errcode = 'check_violation';
    end if;
    if exists (select 1 from users where lower(email) = _email and id <> _u.id) then
        raise exception 'Ese correo ya lo usa otra cuenta.' using errcode = 'check_violation';
    end if;

    update users set name = _nombre, email = _email, updated_at = now() where id = _u.id;

    return jsonb_build_object(
        'user', jsonb_build_object('id', _u.id, 'name', _nombre, 'email', _email),
        'email_anterior', _u.email
    );
end
$$;

revoke all on function public.fn_actualizar_mi_perfil(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fn_actualizar_mi_perfil(uuid, text, text) to service_role;
