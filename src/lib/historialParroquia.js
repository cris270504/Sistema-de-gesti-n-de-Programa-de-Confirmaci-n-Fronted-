// Texto legible de una fila del historial de la parroquia (parroquia_auditoria).
// Devuelve { texto, objetivo, extra, tono } — tono: 'normal' | 'ok' | 'peligro'.

const ESTADOS = { en_preparacion: 'En preparación', confirmado: 'Confirmado', retirado: 'Retirado' }

const CAMPOS = {
  programa_inicio: 'inicio del programa', programa_fin: 'cierre del programa', programa_tipo: 'tipo de programa',
  programa_nombre_otro: 'nombre del programa', persona_nombre_singular: 'nombre de la persona',
  persona_nombre_plural: 'nombre de la persona', dias_ventana_justificacion: 'plazo para justificar',
  tipos_reunion: 'tipos de reunión', umbrales_alerta: 'alertas', procedencias: 'procedencias',
  branding: 'identidad', roles_labels: 'nombres de roles', ui: 'panel y menú', grupos_edad_min: 'edades de grupos',
  grupos_edad_max: 'edades de grupos', contacto: 'contacto', justificacion_motivos: 'motivos de justificación',
}

export function describirCambio(f) {
  const d = f?.detalle ?? {}
  const n = d.nombre ?? ''
  switch (f?.accion) {
    case 'configuracion': {
      const campos = [...new Set((d.campos ?? []).map((c) => CAMPOS[c] ?? c))]
      return { texto: 'Cambió la configuración:', objetivo: campos.join(', '), extra: '', tono: 'normal' }
    }
    case 'acciones_justificacion':
      return { texto: 'Actualizó las acciones reparadoras:', objetivo: (d.acciones ?? []).join(', '), extra: '', tono: 'normal' }
    case 'confirmando_estado':
      return { texto: 'Cambió el estado de', objetivo: n, extra: `de ${ESTADOS[d.de] ?? d.de} a ${ESTADOS[d.a] ?? d.a}`,
        tono: d.a === 'retirado' ? 'peligro' : d.a === 'confirmado' ? 'ok' : 'normal' }
    case 'confirmando_eliminado': return { texto: 'Eliminó al joven', objetivo: n, extra: '', tono: 'peligro' }
    case 'grupo_creado': return { texto: 'Creó el grupo', objetivo: n, extra: '', tono: 'ok' }
    case 'grupo_eliminado': return { texto: 'Eliminó el grupo', objetivo: n, extra: '', tono: 'peligro' }
    case 'reunion_eliminada': return { texto: 'Eliminó la reunión', objetivo: n, extra: d.fecha ? `del ${d.fecha}` : '', tono: 'peligro' }
    case 'rol_guardado': return { texto: 'Guardó el rol', objetivo: n, extra: '', tono: 'normal' }
    case 'rol_eliminado': return { texto: 'Eliminó el rol', objetivo: n, extra: '', tono: 'peligro' }
    case 'usuario_creado': return { texto: 'Creó al usuario', objetivo: n, extra: '', tono: 'ok' }
    case 'usuario_editado': return { texto: 'Editó al usuario', objetivo: n, extra: '', tono: 'normal' }
    case 'usuario_activado': return { texto: 'Activó al usuario', objetivo: n, extra: '', tono: 'ok' }
    case 'usuario_desactivado': return { texto: 'Desactivó al usuario', objetivo: n, extra: '', tono: 'peligro' }
    case 'usuario_eliminado': return { texto: 'Eliminó al usuario', objetivo: n, extra: '', tono: 'peligro' }
    case 'contrasena_restablecida': return { texto: 'Restableció la contraseña de', objetivo: n, extra: '', tono: 'normal' }
    case 'exportacion': return { texto: 'Descargó el respaldo de datos', objetivo: '', extra: '', tono: 'normal' }
    case 'ciclo_cerrado':
      return { texto: 'Cerró el ciclo', objetivo: n,
        extra: d.modo === 'eliminar' ? `y eliminó ${d.jovenes ?? 0} jóvenes` : `y archivó ${d.jovenes ?? 0} jóvenes`,
        tono: d.modo === 'eliminar' ? 'peligro' : 'normal' }
    case 'ciclo_reabierto': return { texto: 'Reabrió el ciclo', objetivo: n, extra: `(${d.jovenes ?? 0} jóvenes)`, tono: 'ok' }
    case 'jovenes_reactivados': return { texto: 'Reactivó', objetivo: `${d.cantidad ?? 0} jóvenes archivados`, extra: '', tono: 'ok' }
    default: return { texto: f?.accion ?? '', objetivo: n, extra: '', tono: 'normal' }
  }
}
