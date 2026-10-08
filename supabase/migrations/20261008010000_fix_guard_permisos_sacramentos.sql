-- =====================================================================
-- Corrige 20261008000000_programar_sacramentos.sql: los permisos nuevos se
-- crearon con guard_name 'web', pero fn_get_user solo devuelve permisos con
-- guard_name = 'api', así que el frontend nunca los veía.
--
-- Además se quitan del rol 'proveedor' (cuenta de plataforma, sin parroquia):
-- los recibió solo porque tenía 'crear cronograma'.
--
-- Idempotente: se puede volver a correr sin efectos.
-- =====================================================================

update public.permissions
   set guard_name = 'api', updated_at = now()
 where name in ('ver sacramentos programados', 'programar sacramentos', 'registrar sacramentos')
   and guard_name <> 'api';

delete from public.role_has_permissions rhp
 using public.permissions p, public.roles r
 where p.id = rhp.permission_id
   and r.id = rhp.role_id
   and r.name = 'proveedor'
   and p.name in ('ver sacramentos programados', 'programar sacramentos', 'registrar sacramentos');

-- Verificación (debe mostrar guard 'api' y solo super-admin / coordinador):
-- select p.name, p.guard_name, r.name as rol
--   from permissions p
--   join role_has_permissions rhp on rhp.permission_id = p.id
--   join roles r on r.id = rhp.role_id
--  where p.name in ('ver sacramentos programados', 'programar sacramentos', 'registrar sacramentos');
