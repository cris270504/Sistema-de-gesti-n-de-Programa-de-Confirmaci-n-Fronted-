-- Lectura de frontend_error_logs para el panel "Errores del sistema".
--
-- La tabla no tiene GRANT SELECT para authenticated (solo INSERT, vía
-- fn_log_frontend_error). En vez de abrir la tabla —lo que dejaría a los
-- admins de cada parroquia leer stacks y URLs internas— el proveedor la lee
-- por esta función, que rechaza a cualquier otro rol.

create or replace function public.fn_errores_sistema(
    p_parroquia_id bigint default null,
    p_desde        timestamptz default now() - interval '7 days',
    p_limite       integer default 500
)
returns table (
    id bigint, message text, stack text, url text, user_agent text,
    created_at timestamptz, parroquia_id bigint, user_id bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.app_es_proveedor() then
        raise exception 'Solo el proveedor de la plataforma puede ver los errores del sistema.'
            using errcode = 'insufficient_privilege';
    end if;

    return query
        select l.id::bigint, l.message::text, l.stack::text, l.url::text, l.user_agent::text,
               l.created_at::timestamptz, l.parroquia_id::bigint, l.user_id::bigint
          from public.frontend_error_logs l
         where l.created_at >= coalesce(p_desde, now() - interval '7 days')
           and (p_parroquia_id is null or l.parroquia_id = p_parroquia_id)
         order by l.created_at desc
         limit least(greatest(coalesce(p_limite, 500), 1), 1000);
end
$$;

revoke all on function public.fn_errores_sistema(bigint, timestamptz, integer) from public, anon;
grant execute on function public.fn_errores_sistema(bigint, timestamptz, integer) to authenticated;
