-- =====================================================================
-- v_dashboard_alertas: mismo patrón de riesgo que v_justificaciones_pendientes
-- tenía antes de arreglarla (security_invoker + filtro sobre columna
-- calculada `nivel_riesgo` que PostgREST no puede empujar a través del
-- security barrier), aplicado sobre un window function por confirmando
-- (recorre TODO su historial de asistencia, no solo una ventana acotada).
--
-- La diferencia con justificaciones: esta vista YA se beneficia de la
-- migración 20260913000000 (wrap-in-select + EXISTS correlacionado en las
-- 8 tablas que toca), porque esos cambios son a nivel de policy, no de
-- vista puntual. Puede que ya esté suficientemente rápida.
--
-- No la reescribí a ciegas a SECURITY DEFINER (como sí hicimos con
-- justificaciones) porque no tengo forma de correr EXPLAIN ANALYZE ni de
-- validar el resultado contra usuarios reales sin acceso a la base -- y es
-- el dashboard que calcula nivel de riesgo de menores, no vale la pena
-- arriesgar una reescritura sin poder probarla. Corré esto primero:
-- =====================================================================

-- 1) Tiempo real, con el plan completo. Como usuario admin de la SQL
--    Editor (bypassea RLS), esto mide el costo "de piso" del cálculo, sin
--    el filtro de RLS -- si esto YA es lento, la versión con RLS real será
--    igual o peor.
explain (analyze, buffers, format text)
select * from public.v_dashboard_alertas where nivel_riesgo <> 'NINGUNO';

-- 2) Cuántos confirmandos activos hay en total (para poner el tiempo del
--    punto 1 en contexto -- 50 confirmandos lento es un problema real, 5000
--    confirmandos lento es esperable).
select count(*) from public.confirmandos where estado <> 'retirado';

-- 3) Tamaño de la tabla asistencia (el costo real es proporcional a esto,
--    no a la cantidad de confirmandos -- cada confirmando puede tener años
--    de historial).
select count(*) from public.asistencia;

-- ---------------------------------------------------------------------
-- Si el punto 1 tarda más de ~1-2 segundos con pocos cientos de
-- confirmandos, avisame con el resultado del EXPLAIN y armo la misma
-- solución que para justificaciones (función SECURITY DEFINER con el
-- scope precalculado), validándola con el mismo patrón de 3 usuarios de
-- prueba antes de que el frontend la use.
-- ---------------------------------------------------------------------
