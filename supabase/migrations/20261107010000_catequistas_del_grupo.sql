-- =====================================================================
-- "Mi grupo": el catequista ve a TODOS los catequistas de su grupo.
--
-- Antes el panel embebía catequista_grupo → users, pero la RLS de ambas
-- tablas solo deja al catequista verse a sí mismo, así que salía solo él.
-- No se abre la RLS de users (tiene columnas sensibles): esta función
-- SECURITY DEFINER devuelve únicamente id, nombre y correo de los
-- catequistas del grupo, y solo si quien llama pertenece a ese grupo o es
-- privilegiado de la misma parroquia.
-- =====================================================================

create or replace function public.fn_grupo_catequistas(p_grupo_id bigint)
returns table (id bigint, name text, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not exists (
        select 1 from public.grupos g
         where g.id = p_grupo_id
           and public.app_parroquia_ok(g.parroquia_id)
           and (
                public.app_is_privileged()
                or exists (
                    select 1 from public.catequista_grupo cg
                     where cg.grupo_id = g.id
                       and cg.user_id = public.app_current_user_id()
                )
           )
    ) then
        return; -- sin acceso: lista vacía, no se revela nada
    end if;

    return query
        select u.id, u.name::text, u.email::text
          from public.catequista_grupo cg
          join public.users u on u.id = cg.user_id
         where cg.grupo_id = p_grupo_id
         order by u.name;
end
$$;

revoke all on function public.fn_grupo_catequistas(bigint) from public, anon;
grant execute on function public.fn_grupo_catequistas(bigint) to authenticated;
