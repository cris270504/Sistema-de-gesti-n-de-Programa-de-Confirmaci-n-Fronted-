import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Ciclos del programa. Los jóvenes archivados quedan ocultos por RLS; para
// verlos (lista de archivados, respaldo) la consulta envía esta cabecera.
export const CABECERA_ARCHIVADOS = ['x-incluir-archivados', 'si']

export async function listCiclos() {
  const { data, error } = await supabase
    .from('parroquia_ciclos')
    .select('id, nombre, modo, jovenes, cerrado_at, cerrado_por_nombre, reabierto_at')
    .order('cerrado_at', { ascending: false })
  if (error) throw errorLegible(error)
  return data ?? []
}

// modo: 'mantener' | 'eliminar'. inicio/fin: fechas del ciclo nuevo (opcionales).
export async function cerrarCiclo({ nombre, modo, confirmacion, inicio = null, fin = null }) {
  const { data, error } = await supabase.rpc('fn_cerrar_ciclo', {
    p_nombre: nombre,
    p_modo: modo,
    p_confirmacion: confirmacion,
    p_inicio: inicio || null,
    p_fin: fin || null,
  })
  if (error) throw errorLegible(error)
  return data
}

export async function reabrirUltimoCiclo() {
  const { data, error } = await supabase.rpc('fn_reabrir_ultimo_ciclo')
  if (error) throw errorLegible(error)
  return data
}

// Jóvenes archivados de un ciclo. La búsqueda por nombre se hace en el
// navegador (filtrarArchivados): no se arma un filtro de PostgREST con texto libre.
export async function listArchivados(cicloId) {
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from('confirmandos')
      .select('id, nombres, apellidos, estado, celular, fecha_nacimiento')
      .eq('archivado_ciclo_id', Number(cicloId))
      .order('apellidos', { ascending: true })
      .order('nombres', { ascending: true })
      .range(desde, desde + 999)
      .setHeader(...CABECERA_ARCHIVADOS)
    if (error) throw errorLegible(error)
    filas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return filas
}

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

export function filtrarArchivados(lista, busqueda = '') {
  const t = normalizar(busqueda)
  if (!t) return lista
  return lista.filter((c) => normalizar(`${c.apellidos} ${c.nombres}`).includes(t))
}

export async function reactivarConfirmandos(ids) {
  const { data, error } = await supabase.rpc('fn_reactivar_confirmandos', { p_ids: ids.map(Number) })
  if (error) throw errorLegible(error)
  return data
}

// Último ciclo que todavía se puede deshacer (cerrado con «mantener» y sin reabrir).
export function cicloReabrible(ciclos) {
  const vigentes = ciclos.filter((c) => !c.reabierto_at)
  const ultimo = vigentes[0]
  return ultimo && ultimo.modo === 'mantener' ? ultimo : null
}

// Jóvenes del ciclo actual por estado (los archivados no cuentan: los oculta RLS).
export async function contarJovenesActuales() {
  const contar = async (estado) => {
    let q = supabase.from('confirmandos').select('id', { count: 'exact', head: true })
    if (estado) q = q.eq('estado', estado)
    const { count, error } = await q
    if (error) throw errorLegible(error)
    return count ?? 0
  }
  const [total, en_preparacion, confirmado, retirado] = await Promise.all([
    contar(null), contar('en_preparacion'), contar('confirmado'), contar('retirado'),
  ])
  return { total, en_preparacion, confirmado, retirado }
}
