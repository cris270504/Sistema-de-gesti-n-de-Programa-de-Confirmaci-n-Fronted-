import { supabase } from '@/lib/supabase'

// Fase 3: el dashboard lee de dos vistas (RLS por parroquia + grupo vía
// security_invoker) en vez de GET /dashboard/metricas de Laravel.
// - v_dashboard_metricas: conteos + tasas (1 fila)
// - v_dashboard_alertas: alertas de riesgo por confirmando (rachas/umbrales)

export async function getDashboardMetricas() {
  const [metricas, alertas] = await Promise.all([
    supabase.from('v_dashboard_metricas').select('*').maybeSingle(),
    supabase.from('v_dashboard_alertas').select('*').neq('nivel_riesgo', 'NINGUNO'),
  ])

  if (metricas.error) throw new Error(metricas.error.message)
  if (alertas.error) throw new Error(alertas.error.message)

  return {
    metricas: metricas.data ?? {},
    alertas: alertas.data ?? [],
  }
}
