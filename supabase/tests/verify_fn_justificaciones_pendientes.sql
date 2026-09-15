-- =====================================================================
-- Verificación de fn_justificaciones_pendientes contra la RLS real.
-- =====================================================================
-- fn_justificaciones_pendientes() es SECURITY DEFINER: bypassea RLS por
-- completo y reimplementa a mano la autorización de 8 tablas (ver los
-- comentarios en supabase/migrations/20260913000000_fix_v_justificaciones_pendientes_timeout.sql).
-- Si alguien cambia una policy de asistencia/confirmandos/reunions/etc. y
-- se olvida de replicar el cambio en esa función, esta seguiría
-- devolviendo datos con la regla VIEJA, sin ningún error visible.
--
-- Este script compara, para 3 perfiles de usuario reales, el resultado de
-- la función contra el de la vista v_justificaciones_pendientes (que sigue
-- yendo por RLS real, security_invoker). Si algo no coincide, la función
-- está desincronizada de las policies y hay que revisarla.
--
-- CUÁNDO CORRERLO: después de cualquier cambio a las policies de
-- asistencia, confirmandos, reunions, grupos, justificaciones,
-- confirmando_apoderado, apoderados o parroquia_configuraciones, o a la
-- función misma.
--
-- CÓMO CORRERLO: pegar cada bloque BEGIN...ROLLBACK por separado en el SQL
-- Editor (varios SELECT en un mismo envío solo muestran el resultado del
-- último). Reemplazar los `app_user_id`/`parroquia_id`/`roles` de abajo si
-- esos usuarios de prueba ya no existen — elegir uno privilegiado
-- (coordinador/super-admin), uno catequista con grupo_ids no vacío, y el
-- proveedor.
-- =====================================================================

-- ==================== Usuario privilegiado ====================
begin;
select set_config('request.jwt.claims', jsonb_build_object(
    'app_user_id', 1, 'parroquia_id', 1, 'es_proveedor', false,
    'roles', to_jsonb(array['super-admin'])
)::text, true);
set local role authenticated;

select
  'privilegiado' as caso,
  (select count(*) from public.v_justificaciones_pendientes) as total_vista,
  (select count(*) from public.fn_justificaciones_pendientes(10000)) as total_rpc,
  (select count(*) from (
     select asistencia_id from public.v_justificaciones_pendientes
     except
     select asistencia_id from public.fn_justificaciones_pendientes(10000)
  ) x) as solo_en_vista,
  (select count(*) from (
     select asistencia_id from public.fn_justificaciones_pendientes(10000)
     except
     select asistencia_id from public.v_justificaciones_pendientes
  ) y) as solo_en_rpc_peligroso;
rollback;

-- ==================== Catequista con grupo ====================
begin;
select set_config('request.jwt.claims', jsonb_build_object(
    'app_user_id', 9, 'parroquia_id', 1, 'es_proveedor', false,
    'roles', to_jsonb(array['catequista'])
)::text, true);
set local role authenticated;

select
  'catequista' as caso,
  (select count(*) from public.v_justificaciones_pendientes) as total_vista,
  (select count(*) from public.fn_justificaciones_pendientes(10000)) as total_rpc,
  (select count(*) from (
     select asistencia_id from public.v_justificaciones_pendientes
     except
     select asistencia_id from public.fn_justificaciones_pendientes(10000)
  ) x) as solo_en_vista,
  (select count(*) from (
     select asistencia_id from public.fn_justificaciones_pendientes(10000)
     except
     select asistencia_id from public.v_justificaciones_pendientes
  ) y) as solo_en_rpc_peligroso;
rollback;

-- ==================== Proveedor ====================
begin;
select set_config('request.jwt.claims', jsonb_build_object(
    'app_user_id', 120004, 'parroquia_id', null, 'es_proveedor', true,
    'roles', to_jsonb(array['proveedor'])
)::text, true);
set local role authenticated;

select
  'proveedor' as caso,
  (select count(*) from public.v_justificaciones_pendientes) as total_vista,
  (select count(*) from public.fn_justificaciones_pendientes(10000)) as total_rpc,
  (select count(*) from (
     select asistencia_id from public.v_justificaciones_pendientes
     except
     select asistencia_id from public.fn_justificaciones_pendientes(10000)
  ) x) as solo_en_vista,
  (select count(*) from (
     select asistencia_id from public.fn_justificaciones_pendientes(10000)
     except
     select asistencia_id from public.v_justificaciones_pendientes
  ) y) as solo_en_rpc_peligroso;
rollback;

-- Esperado en los 3 bloques: total_vista = total_rpc, solo_en_vista = 0,
-- solo_en_rpc_peligroso = 0. Cualquier fila en "solo_en_rpc_peligroso" es
-- una fuga de datos real: la función muestra algo que la RLS de verdad no
-- permitiría.
