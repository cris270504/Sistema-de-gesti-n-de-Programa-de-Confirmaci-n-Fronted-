-- Hardening sin cambios de lógica (advisors de Supabase, 2026-11-08).
--  1) search_path fijo en las funciones de public que no lo tenían
--     (lint 0011). Ninguna referencia objetos fuera de public/pg_catalog,
--     así que 'public, pg_temp' resuelve exactamente lo mismo que hoy.
--  2) Índices duplicados (lint 0009): se conserva uno de cada par.
--  3) FKs sin índice (lint 0001).
--  4) app_parroquia_activa() no tiene por qué ser invocable sin sesión
--     (lint 0028). Sigue disponible para authenticated (la usan las RLS).
-- Idempotente: se puede re-correr.

-- 1) search_path ---------------------------------------------------------
do $$
declare
    f record;
begin
    for f in
        select p.oid::regprocedure as sig
          from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.prokind in ('f', 'p')
           and not exists (select 1 from pg_depend d
                            where d.objid = p.oid and d.deptype = 'e')
           and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                            where c like 'search_path=%')
    loop
        execute format('alter function %s set search_path = public, pg_temp', f.sig);
    end loop;
end
$$;

-- 2) índices duplicados ---------------------------------------------------
drop index if exists public.idx_apoderados_parroquia_id;
drop index if exists public.idx_asistencia_reunion;
drop index if exists public.idx_confirmando_ap_confirmando;
drop index if exists public.idx_confirmandos_parroquia_id;
drop index if exists public.idx_grupos_parroquia_id;
drop index if exists public.idx_justificaciones_asistencia;
drop index if exists public.idx_reunions_fecha;
drop index if exists public.idx_reunions_parroquia_id;

-- 3) FKs sin índice -------------------------------------------------------
create index if not exists idx_confirmando_apoderado_apoderado_id      on public.confirmando_apoderado (apoderado_id);
create index if not exists idx_confirmando_apoderado_tipo_apoderado_id on public.confirmando_apoderado (tipo_apoderado_id);
create index if not exists idx_confirmando_requisito_requisito_id      on public.confirmando_requisito (requisito_id);
create index if not exists idx_confirmando_sacramento_sacramento_id    on public.confirmando_sacramento (sacramento_id);
create index if not exists idx_frontend_error_logs_user_id             on public.frontend_error_logs (user_id);
create index if not exists idx_prog_sac_detalle_sacramento_id          on public.programacion_sacramento_detalle (sacramento_id);
create index if not exists idx_programaciones_sacramento_sacramento_id on public.programaciones_sacramento (sacramento_id);
create index if not exists idx_reunion_user_user_id                    on public.reunion_user (user_id);
create index if not exists idx_role_has_permissions_role_id            on public.role_has_permissions (role_id);
create index if not exists idx_sacramento_requisito_requisito_id       on public.sacramento_requisito (requisito_id);
create index if not exists idx_users_grupo_id                          on public.users (grupo_id);

-- 4) anon no ejecuta app_parroquia_activa ---------------------------------
revoke execute on function public.app_parroquia_activa() from public, anon;
grant  execute on function public.app_parroquia_activa() to authenticated, service_role;
