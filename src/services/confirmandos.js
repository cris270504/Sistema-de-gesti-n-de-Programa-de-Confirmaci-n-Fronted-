import api from '@/lib/api'
import { supabase } from '@/lib/supabase'

// Fase 3 migración Supabase: las LECTURAS de confirmandos van directo a PostgREST
// (la RLS acota por parroquia y por grupo del catequista, igual que hacía el
// filtro en ConfirmandoController). Las escrituras y lo que necesita lógica
// (perfil, buscar-apoderados, importar/exportar Excel) siguen en Laravel hasta
// las Fases 4/5.

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

// PostgREST embebe las relaciones N:M a través de la tabla puente. Se aplanan a
// la forma `{ ...entidad, pivot: {...columnas del puente} }` que ya usa el
// frontend (convención de Eloquent: `s.pivot.estado`, `ap.pivot.tipo_apoderado_id`).
function aplanarM2M(rows, puente, entidad, pivotCols) {
  const flat = (row) => ({
    ...row,
    [entidad + 's']: (row[puente] ?? []).map((link) => ({
      ...link[entidad],
      pivot: Object.fromEntries(pivotCols.map((c) => [c, link[c]])),
    })),
    [puente]: undefined,
  })
  return Array.isArray(rows) ? rows.map(flat) : flat(rows)
}

const SELECT_LISTA =
  'id, nombres, apellidos, fecha_nacimiento, genero, celular, estado, grupo_id,' +
  ' grupo:grupos(id, nombre, color, procedencia),' +
  ' confirmando_sacramento(estado, sacramento:sacramentos(id, nombre))'

const SELECT_DETALLE =
  '*,' +
  ' grupo:grupos(*),' +
  ' confirmando_sacramento(estado, sacramento:sacramentos(id, nombre, clave)),' +
  ' confirmando_requisito(estado, fecha_entrega, requisito:requisitos(id, nombre)),' +
  ' confirmando_apoderado(tipo_apoderado_id, apoderado:apoderados(id, nombres, apellidos, celular))'

function aplanarConfirmando(row) {
  let r = aplanarM2M(row, 'confirmando_sacramento', 'sacramento', ['estado'])
  r = aplanarM2M(r, 'confirmando_requisito', 'requisito', ['estado', 'fecha_entrega'])
  r = aplanarM2M(r, 'confirmando_apoderado', 'apoderado', ['tipo_apoderado_id'])
  return r
}

export async function getConfirmandosList() {
  const rows = await unwrap(
    supabase.from('confirmandos').select(SELECT_LISTA).order('id', { ascending: false }),
  )
  return rows.map((r) => aplanarM2M(r, 'confirmando_sacramento', 'sacramento', ['estado']))
}

export async function getConfirmandoById(id) {
  const row = await unwrap(
    supabase.from('confirmandos').select(SELECT_DETALLE).eq('id', Number(id)).single(),
  )
  return aplanarConfirmando(row)
}

// ── Escrituras y lógica: siguen en Laravel ──────────────────────────────────
export function createConfirmando(confirmando) {
  return api.post('/confirmandos', confirmando).then((res) => res.data)
}

export function obtenerPerfilConfirmando(id) {
  return api.get(`/confirmandos/${id}/perfil`).then((res) => res.data)
}

export function updateConfirmando(id, confirmando) {
  return api.put(`/confirmandos/${id}`, confirmando).then((res) => res.data)
}

export function deleteConfirmandoById(id) {
  return api.delete(`/confirmandos/${id}`).then((res) => res.data)
}

export function retirarConfirmandoById(id) {
  return api.put(`/confirmandos/${id}/retirar`).then((res) => res.data)
}

export function importarConfirmandosExcel(formData) {
  return api.post('/confirmandos/importar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => res.data)
}

export const exportarConfirmandosExcel = async () => {
  const response = await api.get('/confirmandos/exportar', { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'Confirmandos_por_Grupos.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
}
