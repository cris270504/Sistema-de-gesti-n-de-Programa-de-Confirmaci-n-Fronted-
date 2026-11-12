// Respaldo completo de una parroquia en un libro de Excel (una hoja por tabla).
// Lógica pura: recibe los datos ya leídos y arma las hojas. Sin red ni Vue.
import { COLUMNAS, construirFilas, fechaIso } from './exportConfirmandos'

// Tipos de asistente tal como los guarda la base.
export const TIPO_ASISTENTE = {
  confirmando: 'App\\Models\\Confirmando',
  usuario: 'App\\Models\\User',
  apoderado: 'App\\Models\\Apoderado',
}

const fecha = (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : '')
const nombre = (p) => [p?.apellidos, p?.nombres].filter(Boolean).join(', ')

function hoja(titulo, columnas, filas) {
  return { titulo, columnas: columnas.map(([key, label, width = 22]) => ({ key, label, width })), filas }
}

/**
 * @param datos { confirmandos, apoderados, grupos, usuarios, reuniones, asistencias, justificaciones, acciones }
 * @returns [{ titulo, columnas: [{ key, label, width }], filas: string[][] }]
 */
export function armarHojasRespaldo(datos, hoy = new Date()) {
  const {
    confirmandos = [], apoderados = [], grupos = [], usuarios = [], reuniones = [],
    asistencias = [], justificaciones = [], acciones = [], ciclos = [],
  } = datos
  const cicloNombre = new Map(ciclos.map((c) => [Number(c.id), c.nombre]))
  const ciclo = (c) => (c.archivado_ciclo_id ? `Archivado (${cicloNombre.get(Number(c.archivado_ciclo_id)) ?? 'ciclo cerrado'})` : 'Actual')

  const porId = (lista) => new Map(lista.map((x) => [Number(x.id), x]))
  const conf = porId(confirmandos)
  const apod = porId(apoderados)
  const usr = porId(usuarios)
  const reu = porId(reuniones)
  const asis = porId(asistencias)
  const accion = new Map(acciones.map((a) => [a.clave, a.nombre]))

  const nombreAsistente = (tipo, id) => {
    if (tipo === TIPO_ASISTENTE.confirmando) return nombre(conf.get(Number(id))) || `#${id}`
    if (tipo === TIPO_ASISTENTE.apoderado) return nombre(apod.get(Number(id))) || `#${id}`
    if (tipo === TIPO_ASISTENTE.usuario) return usr.get(Number(id))?.name || `#${id}`
    return `#${id}`
  }
  const ETIQUETA_TIPO = {
    [TIPO_ASISTENTE.confirmando]: 'Joven',
    [TIPO_ASISTENTE.apoderado]: 'Apoderado',
    [TIPO_ASISTENTE.usuario]: 'Catequista',
  }

  return [
    {
      titulo: 'Jóvenes',
      columnas: [...COLUMNAS.map((c) => ({ key: c.key, label: c.label, width: c.width })),
        { key: 'ciclo', label: 'Ciclo', width: 30 }],
      filas: construirFilas(confirmandos, COLUMNAS, hoy).map((fila, i) => [...fila, ciclo(confirmandos[i])]),
    },
    hoja('Apoderados', [['apellidos', 'Apellidos', 28], ['nombres', 'Nombres', 28], ['celular', 'Celular', 16]],
      apoderados.map((a) => [a.apellidos ?? '', a.nombres ?? '', a.celular ?? ''])),
    hoja('Grupos', [['nombre', 'Grupo', 28], ['procedencia', 'Procedencia', 18], ['periodo', 'Periodo', 14]],
      grupos.map((g) => [g.nombre ?? '', g.procedencia ?? '', g.periodo ?? ''])),
    hoja('Usuarios', [['name', 'Nombre', 30], ['email', 'Correo', 30], ['dni', 'DNI', 14], ['celular', 'Celular', 16],
      ['roles', 'Roles', 26], ['grupos', 'Grupos', 26], ['activo', 'Activo', 10]],
    usuarios.map((u) => [
      u.name ?? '', u.email ?? '', u.dni ?? '', u.celular ?? '',
      (u.roles ?? []).map((r) => r?.name).filter(Boolean).join(', '),
      (u.grupos ?? []).map((g) => g?.nombre).filter(Boolean).join(', '),
      u.activo ? 'Sí' : 'No',
    ])),
    hoja('Reuniones', [['fecha', 'Fecha', 18], ['nombre_tema', 'Tema', 40], ['tipo', 'Tipo', 16], ['descripcion', 'Descripción', 40]],
      reuniones.map((r) => [fecha(r.fecha), r.nombre_tema ?? '', r.tipo ?? '', r.descripcion ?? ''])),
    hoja('Asistencias', [['fecha', 'Fecha', 18], ['reunion', 'Reunión', 36], ['tipo', 'Tipo', 14], ['persona', 'Persona', 34],
      ['estado', 'Estado', 20], ['nota', 'Nota', 30]],
    asistencias.map((a) => {
      const r = reu.get(Number(a.reunion_id))
      return [fecha(r?.fecha), r?.nombre_tema ?? '', ETIQUETA_TIPO[a.asistente_type] ?? a.asistente_type ?? '',
        nombreAsistente(a.asistente_type, a.asistente_id), a.estado ?? '', a.nota ?? '']
    })),
    hoja('Justificaciones', [['fecha_falta', 'Fecha de la falta', 18], ['persona', 'Persona', 34], ['motivo', 'Motivo', 30],
      ['accion', 'Acción reparadora', 22], ['detalle', 'Detalle', 30], ['fecha_acuerdo', 'Fecha del acuerdo', 16],
      ['estado', 'Estado', 16]],
    justificaciones.map((j) => {
      const a = asis.get(Number(j.asistencia_id))
      const r = a ? reu.get(Number(a.reunion_id)) : null
      return [fecha(r?.fecha), a ? nombreAsistente(a.asistente_type, a.asistente_id) : '', j.motivo ?? '',
        accion.get(j.tipo_accion) ?? j.tipo_accion ?? '', j.descripcion ?? '', j.fecha_acuerdo ?? '', j.estado ?? '']
    })),
  ]
}

export const nombreArchivoRespaldo = (slug, hoy = new Date()) =>
  `respaldo_${String(slug || 'parroquia').replace(/[^a-z0-9-]+/gi, '-')}_${fechaIso(hoy)}.xlsx`
