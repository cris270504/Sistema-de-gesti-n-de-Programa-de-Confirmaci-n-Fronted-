-- HOTFIX (2026-11-08 ~06:06 UTC): el login dejó de funcionar tras
-- 20261108010000_aislamiento_fail_closed.
--
-- custom_access_token_hook corre como `supabase_auth_admin` (sin BYPASSRLS) y
-- lee public.users. La política RESTRICTIVA users_parroquia estaba declarada
-- para {public} (todos los roles); con app_parroquia_ok ahora "fail-closed",
-- supabase_auth_admin (sin claims → sin parroquia_id) ya no veía ninguna fila:
-- el hook emitía tokens sin app_user_id/parroquia_id/roles y fn_get_user
-- respondía 403 "Sin usuario en el contexto".
--
-- La restricción por parroquia es para los roles de la API, no para el
-- servicio de Auth (que tiene su propia política permisiva users_auth_admin_read).

alter policy users_parroquia on public.users to anon, authenticated;
