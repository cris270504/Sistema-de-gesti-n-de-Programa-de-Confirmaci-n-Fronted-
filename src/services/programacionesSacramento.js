import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Celebraciones de sacramentos (migración 20261008000000). Lecturas por
// PostgREST (RLS de parroquia); escrituras solo por RPC transaccional
// (estado de confirmando_sacramento + detalle en una sola transacción).

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw errorLegible(error)
  return data
}

// Bautismo → Primera Comunión → Confirmación (igual que RutaSacramental.vue).
export const ORDEN_CLAVE = { bautismo: 1, comunion: 2, confirmacion: 3 }
export const CLAVES_PROGRAMABLES = Object.keys(ORDEN_CLAVE)

// programaciones_sacramento llega a sacramentos por dos caminos (su FK directa
// y el detalle como tabla puente), así que PostgREST exige nombrar la FK.
const SAC_PRINCIPAL = 'sacramento:sacramentos!programaciones_sacramento_sacramento_id_fkey(id, nombre, clave)'
const SAC_DETALLE = 'sacramento:sacramentos!programacion_sacramento_detalle_sacramento_id_fkey(id, nombre, clave)'

const COLS_LISTA =
  `id, fecha, estado, registrada_at, sacramento_id, ${SAC_PRINCIPAL},` +
  ' detalle:programacion_sacramento_detalle(confirmando_id, sacramento_id, recibio)'

const COLS_DETALLE =
  `id, fecha, estado, registrada_at, sacramento_id, ${SAC_PRINCIPAL},` +
  ' detalle:programacion_sacramento_detalle(confirmando_id, sacramento_id, recibio,' +
  ' confirmando:confirmandos(id, nombres, apellidos, estado, grupo:grupos(id, nombre)),' +
  ` ${SAC_DETALLE})`

// Agrega los conteos que usan la lista y el calendario (jóvenes distintos y
// cuántos recibieron el sacramento principal).
export function resumirProgramacion(row) {
  const detalle = row?.detalle ?? []
  const jovenes = new Set(detalle.map((d) => d.confirmando_id))
  const principal = detalle.filter((d) => d.sacramento_id === row.sacramento_id)
  return {
    ...row,
    total_jovenes: jovenes.size,
    total_recibieron: principal.filter((d) => d.recibio === true).length,
  }
}

export async function getProgramaciones() {
  const rows = await unwrap(
    supabase.from('programaciones_sacramento').select(COLS_LISTA).order('fecha', { ascending: true }),
  )
  return rows.map(resumirProgramacion)
}

// Detalle agrupado por joven: [{ confirmando, sacramentos: [{ id, nombre, clave, recibio }] }]
export async function getProgramacionById(id) {
  const row = await unwrap(
    supabase.from('programaciones_sacramento').select(COLS_DETALLE).eq('id', Number(id)).single(),
  )
  const porJoven = new Map()
  for (const d of row.detalle ?? []) {
    if (!porJoven.has(d.confirmando_id)) {
      porJoven.set(d.confirmando_id, {
        confirmando_id: d.confirmando_id,
        confirmando: d.confirmando,
        sacramentos: [],
      })
    }
    porJoven.get(d.confirmando_id).sacramentos.push({ ...d.sacramento, recibio: d.recibio })
  }
  const jovenes = [...porJoven.values()]
  for (const j of jovenes) {
    j.sacramentos.sort((a, b) => (ORDEN_CLAVE[a.clave] ?? 9) - (ORDEN_CLAVE[b.clave] ?? 9))
  }
  jovenes.sort((a, b) =>
    `${a.confirmando?.apellidos ?? ''} ${a.confirmando?.nombres ?? ''}`.localeCompare(
      `${b.confirmando?.apellidos ?? ''} ${b.confirmando?.nombres ?? ''}`, 'es'))

  return { ...resumirProgramacion(row), jovenes }
}

// { [sacramento_id]: total } de jóvenes activos con el sacramento pendiente.
export async function getConteoElegibles() {
  const rows = await unwrap(supabase.rpc('fn_conteo_elegibles_sacramento'))
  return Object.fromEntries((rows ?? []).map((r) => [r.sacramento_id, Number(r.total)]))
}

export async function getElegibles(sacramentoId, programacionId = null) {
  const rows = await unwrap(
    supabase.rpc('fn_elegibles_sacramento', {
      p_sacramento_id: Number(sacramentoId),
      p_programacion_id: programacionId ? Number(programacionId) : null,
    }),
  )
  return (rows ?? []).map((r) => ({ ...r, anteriores: r.anteriores ?? [] }))
}

// items: [{ confirmando_id, sacramento_ids: [] }]; fecha: 'YYYY-MM-DD HH:mm' (hora local).
export async function programarSacramento({ id = null, sacramentoId, fecha, items }) {
  return unwrap(
    supabase.rpc('fn_programar_sacramento', {
      p_id: id ? Number(id) : null,
      p_sacramento_id: Number(sacramentoId),
      p_fecha: fecha,
      p_items: items.map((i) => ({
        confirmando_id: Number(i.confirmando_id),
        sacramento_ids: (i.sacramento_ids ?? []).map(Number),
      })),
    }),
  )
}

export async function cancelarProgramacion(id) {
  await unwrap(supabase.rpc('fn_cancelar_programacion_sacramento', { p_id: Number(id) }))
}

// items: [{ confirmando_id, sacramento_id, recibio: boolean }]
export async function registrarSacramentos(id, items) {
  await unwrap(
    supabase.rpc('fn_registrar_sacramentos', {
      p_id: Number(id),
      p_items: items.map((i) => ({
        confirmando_id: Number(i.confirmando_id),
        sacramento_id: Number(i.sacramento_id),
        recibio: Boolean(i.recibio),
      })),
    }),
  )
}
