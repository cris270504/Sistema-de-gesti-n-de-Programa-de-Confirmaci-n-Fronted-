-- Acuerdos de justificación registrados antes de existir justificaciones.tipo_accion
-- (migración 20260913020000) guardaban la acción reparadora como texto libre en
-- `descripcion` y dejaban `tipo_accion` en null. Ese texto libre equivale a 'otros'.
-- Las filas sin descripcion se dejan como están: no hay forma de inferir qué se pactó.
-- No toca esquema ni RLS: solo corrige datos existentes; el CHECK
-- justificaciones_tipo_accion_check ya admite 'otros' y los cupos solo cuentan
-- 'lectura' y 'colecta'.

update public.justificaciones
   set tipo_accion = 'otros'
 where tipo_accion is null
   and coalesce(btrim(descripcion), '') <> '';
