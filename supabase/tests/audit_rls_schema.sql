-- =====================================================================
-- Auditoría de RLS de todo el esquema `public`.
-- =====================================================================
-- Ya encontramos 2 huecos de este tipo por accidente en una sola sesión
-- (un GRANT faltante que bloqueaba TODO, y policies con RLS anidada
-- costosa). Esto generaliza esas preguntas a cada tabla del esquema, no
-- solo a las que tocamos a mano.
--
-- Corré cada bloque por separado (el SQL Editor solo muestra el último
-- SELECT de un envío con varios).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tablas SIN RLS habilitado. Si PostgREST expone el schema `public`
--    (lo hace, es el default) y la tabla tiene GRANT a anon/authenticated,
--    esto significa "cualquier logueado (o cualquier visitante) puede leer
--    o escribir la tabla completa, sin ningún filtro". Máxima prioridad.
-- ---------------------------------------------------------------------
select
    c.relname as tabla,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    pg_size_pretty(pg_total_relation_size(c.oid)) as tamano
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'  -- solo tablas normales
  and not c.relrowsecurity
order by pg_total_relation_size(c.oid) desc;

-- ---------------------------------------------------------------------
-- 2) Tablas CON RLS habilitado pero SIN ninguna policy. Con RLS activado
--    y 0 policies, Postgres deniega todo por defecto -- no es un agujero,
--    pero puede ser un "todo roto silenciosamente" si se esperaba que
--    funcionara. Confirmá que sea intencional.
-- ---------------------------------------------------------------------
select c.relname as tabla
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname
  )
order by c.relname;

-- ---------------------------------------------------------------------
-- 3) Tablas con RLS habilitado pero NO forzado (relforcerowsecurity =
--    false). El dueño de la tabla (y cualquier rol con privilegios de
--    dueño, ej. funciones SECURITY DEFINER de ese owner) BYPASSEA la RLS
--    por completo salvo que esté forzada. Si alguna función SECURITY
--    DEFINER nueva llega a tocar una tabla de esta lista pensando que la
--    RLS la protege, no la protege.
-- ---------------------------------------------------------------------
select c.relname as tabla, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity
  and not c.relforcerowsecurity
order by c.relname;

-- ---------------------------------------------------------------------
-- 4) Policies que llaman a un helper de seguridad SIN envolver en
--    `(select ...)`. Detectado por texto -- heurística, puede haber falsos
--    positivos/negativos, pero es la misma clase de bug que encontramos en
--    las 8 tablas de justificaciones (STABLE no alcanza; sin el wrap,
--    Postgres re-ejecuta la función por fila en vez de una vez por query).
-- ---------------------------------------------------------------------
select
    tablename,
    policyname,
    cmd,
    qual,
    with_check
from pg_policies
where schemaname = 'public'
  and (
    (qual is not null and qual ~ '(app_is_privileged|app_es_proveedor|app_current_parroquia_id|app_current_user_id)\(\)'
       and qual !~ '\(select\s+(app_is_privileged|app_es_proveedor|app_current_parroquia_id|app_current_user_id)\(\)\)')
    or
    (with_check is not null and with_check ~ '(app_is_privileged|app_es_proveedor|app_current_parroquia_id|app_current_user_id)\(\)'
       and with_check !~ '\(select\s+(app_is_privileged|app_es_proveedor|app_current_parroquia_id|app_current_user_id)\(\)\)')
  )
order by tablename, policyname;

-- ---------------------------------------------------------------------
-- 5) Policies RESTRICTIVE que referencian OTRA tabla vía subquery no
--    correlacionado (`IN (SELECT id FROM otra_tabla)` en vez de un EXISTS
--    correlacionado por FK puntual). Es el patrón exacto que causaba RLS
--    anidada cara en asistencia_parroquia/justificaciones_parroquia antes
--    de reescribirlas -- vale la pena revisar cualquier otra que aparezca
--    acá.
-- ---------------------------------------------------------------------
select tablename, policyname, permissive, cmd, qual
from pg_policies
where schemaname = 'public'
  and permissive = 'RESTRICTIVE'
  and qual ~ 'IN \( *SELECT'
order by tablename, policyname;
