-- =====================================================================
-- Mismo arreglo que 20260913000000 (wrap-in-select de las funciones de
-- seguridad en las policies) pero para las 7 tablas que quedaron afuera
-- porque en ese momento el foco era solo justificaciones. Encontradas con
-- supabase/tests/audit_rls_schema.sql, bloque 4.
--
-- Cambio mecánico, sin cambiar el resultado: (select fn()) en vez de fn()
-- para que Postgres evalúe la función una vez por consulta en vez de una
-- vez por fila.
-- =====================================================================

-- catequista_grupo
alter policy catequista_grupo_delete on public.catequista_grupo
    using ((select app_is_privileged()));

alter policy catequista_grupo_insert on public.catequista_grupo
    with check ((select app_is_privileged()));

alter policy catequista_grupo_select on public.catequista_grupo
    using (
        (select app_is_privileged())
        or (user_id = (select app_current_user_id()))
    );

alter policy catequista_grupo_update on public.catequista_grupo
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

-- frontend_error_logs
alter policy frontend_error_logs_delete on public.frontend_error_logs
    using ((select app_is_privileged()));

alter policy frontend_error_logs_insert on public.frontend_error_logs
    with check (
        (select app_is_privileged())
        or (user_id = (select app_current_user_id()))
    );

alter policy frontend_error_logs_select on public.frontend_error_logs
    using ((select app_is_privileged()));

alter policy frontend_error_logs_update on public.frontend_error_logs
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

-- parroquias
alter policy parroquias_select on public.parroquias
    using (
        (id = (select app_current_parroquia_id()))
        or (select app_es_proveedor())
    );

alter policy parroquias_write on public.parroquias
    using ((select app_es_proveedor()))
    with check ((select app_es_proveedor()));

-- requisitos
alter policy requisitos_select on public.requisitos
    using (
        (select app_current_parroquia_id()) is not null
        or (select app_es_proveedor())
    );

alter policy requisitos_write on public.requisitos
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

-- sacramentos
alter policy sacramentos_select on public.sacramentos
    using (
        (select app_current_parroquia_id()) is not null
        or (select app_es_proveedor())
    );

alter policy sacramentos_write on public.sacramentos
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

-- tipo_apoderados
alter policy tipo_apoderados_select on public.tipo_apoderados
    using (
        (select app_current_parroquia_id()) is not null
        or (select app_es_proveedor())
    );

alter policy tipo_apoderados_write on public.tipo_apoderados
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

-- users
alter policy users_select on public.users
    using (
        (select app_is_privileged())
        or (id = (select app_current_user_id()))
    );

alter policy users_write on public.users
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));
