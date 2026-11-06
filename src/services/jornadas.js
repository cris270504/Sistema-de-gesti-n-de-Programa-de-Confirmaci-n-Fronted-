import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Cronograma por momentos de jornadas / retiros.
// RLS por permiso: leer exige 'ver cronograma'; escribir, 'editar cronograma'.
// La base de datos mantiene reunions.fecha (hora de inicio) sincronizada con
// el momento clave — ver supabase/migrations/20261106000000_cronograma_jornadas.sql.

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw errorLegible(error)
  return data
}

const limpio = (v) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

export function duracionValida(v) {
  if (v == null || v === '') return null
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1440) : null
}

// ── Categorías ───────────────────────────────────────────────────────────────
const CAT_COLS = 'id, nombre, permite_cronograma, orden, activa'

export function getCategorias() {
  return unwrap(supabase.from('reunion_categorias').select(CAT_COLS).order('orden').order('id'))
}

export function createCategoria({ nombre, permite_cronograma, orden }, parroquiaId) {
  return unwrap(supabase.from('reunion_categorias')
    .insert({ parroquia_id: parroquiaId, nombre: limpio(nombre), permite_cronograma: !!permite_cronograma, orden: orden ?? 0 })
    .select(CAT_COLS).single())
}

export function updateCategoria(id, { nombre, permite_cronograma, activa }) {
  const cambios = {}
  if (nombre !== undefined) cambios.nombre = limpio(nombre)
  if (permite_cronograma !== undefined) cambios.permite_cronograma = !!permite_cronograma
  if (activa !== undefined) cambios.activa = !!activa
  return unwrap(supabase.from('reunion_categorias').update(cambios).eq('id', Number(id)).select(CAT_COLS).single())
}

export function deleteCategoria(id) {
  return unwrap(supabase.from('reunion_categorias').delete().eq('id', Number(id)))
}

// ── Jornadas (reuniones cuya categoría permite cronograma) ───────────────────
const JORNADA_COLS = 'id, nombre_tema, fecha, descripcion, tipo, categoria_id, '
  + 'categoria:reunion_categorias!inner(id, nombre, permite_cronograma), '
  + 'momentos:reunion_momentos(id, duracion_min, en_cronograma, orden, es_clave, clave_hora)'

export function getJornadas() {
  return unwrap(supabase.from('reunions').select(JORNADA_COLS)
    .eq('categoria.permite_cronograma', true)
    .order('fecha', { ascending: false }))
}

// ¿Hay al menos un evento con cronograma? (visibilidad del módulo en el menú)
export async function hayJornadas() {
  const { count, error } = await supabase.from('reunions')
    .select('id, categoria:reunion_categorias!inner(permite_cronograma)', { count: 'exact', head: true })
    .eq('categoria.permite_cronograma', true)
  if (error) throw errorLegible(error)
  return (count ?? 0) > 0
}

const MOMENTO_COLS = 'id, reunion_id, nombre, detalle, duracion_min, en_cronograma, orden, es_clave, clave_hora, '
  + 'responsables:reunion_momento_responsables(user_id)'

export async function getJornada(id) {
  const reunion = await unwrap(supabase.from('reunions')
    .select('id, nombre_tema, fecha, descripcion, tipo, categoria_id, categoria:reunion_categorias(id, nombre, permite_cronograma)')
    .eq('id', Number(id)).single())
  const momentos = await unwrap(supabase.from('reunion_momentos').select(MOMENTO_COLS)
    .eq('reunion_id', Number(id)).order('orden').order('id'))
  return {
    reunion,
    momentos: momentos.map((m) => ({ ...m, responsables: (m.responsables ?? []).map((r) => r.user_id) })),
  }
}

// ── Momentos ─────────────────────────────────────────────────────────────────
async function siguienteOrden(reunionId, enCronograma) {
  const filas = await unwrap(supabase.from('reunion_momentos').select('orden')
    .eq('reunion_id', reunionId).eq('en_cronograma', enCronograma)
    .order('orden', { ascending: false }).limit(1))
  return (filas[0]?.orden ?? -1) + 1
}

async function setResponsables(momentoId, userIds) {
  const ids = [...new Set((userIds ?? []).map(Number).filter(Boolean))]
  await unwrap(supabase.from('reunion_momento_responsables').delete().eq('momento_id', momentoId))
  if (ids.length) {
    await unwrap(supabase.from('reunion_momento_responsables')
      .insert(ids.map((user_id) => ({ momento_id: momentoId, user_id }))))
  }
}

// Con duración → al final del cronograma; sin duración → "Sin hora definida".
export async function createMomento(reunionId, { nombre, duracion_min, detalle, responsables }) {
  const duracion = duracionValida(duracion_min)
  const enCrono = duracion != null
  const orden = await siguienteOrden(Number(reunionId), enCrono)
  const creado = await unwrap(supabase.from('reunion_momentos').insert({
    reunion_id: Number(reunionId), nombre: limpio(nombre), detalle: limpio(detalle),
    duracion_min: duracion, en_cronograma: enCrono, orden,
  }).select('id').single())
  await setResponsables(creado.id, responsables)
  return creado
}

// Quitar la duración a un momento programado lo manda a "Sin hora definida"
// (el trigger también le quita la marca de clave; la hora de inicio se conserva).
export async function updateMomento(momento, { nombre, duracion_min, detalle, responsables }) {
  const duracion = duracionValida(duracion_min)
  const cambios = { nombre: limpio(nombre), detalle: limpio(detalle), duracion_min: duracion }
  if (momento.en_cronograma && duracion == null) {
    cambios.en_cronograma = false
    cambios.orden = await siguienteOrden(momento.reunion_id, false)
  }
  await unwrap(supabase.from('reunion_momentos').update(cambios).eq('id', momento.id))
  await setResponsables(momento.id, responsables)
}

export function setDuracion(momentoId, duracion_min) {
  return unwrap(supabase.from('reunion_momentos').update({ duracion_min: duracionValida(duracion_min) }).eq('id', momentoId))
}

export function deleteMomento(id) {
  return unwrap(supabase.from('reunion_momentos').delete().eq('id', Number(id)))
}

// Orden completo de ambas listas en una sola sentencia (RPC).
export function ordenar(reunionId, cronogramaIds, sinHoraIds) {
  return unwrap(supabase.rpc('cronograma_ordenar', {
    p_reunion_id: Number(reunionId), p_cronograma: cronogramaIds, p_sin_hora: sinHoraIds,
  }))
}

// momentoId null = quitar la clave.
export function setClave(reunionId, momentoId) {
  return unwrap(supabase.rpc('cronograma_clave', { p_reunion_id: Number(reunionId), p_momento_id: momentoId }))
}

export function setClaveHora(momentoId, hhmm) {
  return unwrap(supabase.from('reunion_momentos').update({ clave_hora: hhmm }).eq('id', momentoId).eq('es_clave', true))
}

export function duplicarJornada(reunionId, nombre, fecha) {
  return unwrap(supabase.rpc('cronograma_duplicar', { p_reunion_id: Number(reunionId), p_nombre: limpio(nombre), p_fecha: fecha }))
}

// Catequistas y coordinadores activos de la parroquia (posibles responsables).
export async function getResponsablesPosibles() {
  const usuarios = await unwrap(supabase.from('v_usuarios').select('id, name, activo, roles').eq('activo', true).order('name'))
  // v_usuarios.roles es jsonb: [{ id, name }].
  const nombreRol = (r) => (typeof r === 'string' ? r : r?.name)
  return usuarios.filter((u) => (u.roles ?? []).some((r) => ['catequista', 'coordinador'].includes(nombreRol(r))))
}
