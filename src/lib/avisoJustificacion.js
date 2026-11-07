// Regla de registro de asistencias: solo coordinador o super-admin marcan
// "falta justificada". El catequista ve un aviso con un "?" que despliega, en
// el mismo aviso, el proceso del módulo Justificaciones.
// La base de datos aplica la misma regla en fn_guardar_asistencias.
import Swal from 'sweetalert2'

export const ROLES_JUSTIFICAN = ['coordinador', 'super-admin']
export const ESTADO_JUSTIFICADA = 'falta justificada'

export const MENSAJE_JUSTIFICACION =
  'Para justificar una falta realiza el proceso acordado. Por favor selecciona "Injustificado".'

export const PASOS_JUSTIFICACION = [
  'Marca la falta como "Injustificado" y guarda la asistencia.',
  'La falta aparece en el módulo Justificaciones.',
  'Ahí se registra el acuerdo: motivo, fecha y acción reparadora (lectura, colecta u otra).',
  'Cuando se cumple la acción, se valida en Justificaciones y la falta pasa a "Justificada" automáticamente.',
]

/** ¿Este usuario puede marcar "falta justificada" al registrar asistencias? */
export const puedeMarcarJustificada = (roles = []) => roles.some((r) => ROLES_JUSTIFICAN.includes(r))

/**
 * ¿Hay que impedir este cambio de estado? Solo se bloquea ELEGIR "justificada"
 * cuando antes no lo estaba (desmarcarla o dejarla igual no se bloquea).
 */
export const debeBloquearJustificada = ({ nuevoEstado, estadoActual, roles }) =>
  nuevoEstado === ESTADO_JUSTIFICADA && estadoActual !== ESTADO_JUSTIFICADA && !puedeMarcarJustificada(roles)

const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function htmlAvisoJustificacion() {
  return `
    <div class="aviso-justif">
      <p class="aviso-justif__msg">
        <span>${escapar(MENSAJE_JUSTIFICACION)}</span>
        <button type="button" class="aviso-justif__ayuda" aria-expanded="false" aria-controls="aviso-justif-proceso"
          aria-label="Ver el proceso de justificación" title="Ver el proceso de justificación">?</button>
      </p>
      <div id="aviso-justif-proceso" class="aviso-justif__proceso" hidden>
        <p class="aviso-justif__titulo">Proceso de justificación:</p>
        <ol>${PASOS_JUSTIFICACION.map((p) => `<li>${escapar(p)}</li>`).join('')}</ol>
      </div>
    </div>`
}

export function mostrarAvisoJustificacion() {
  return Swal.fire({
    icon: 'info',
    html: htmlAvisoJustificacion(),
    confirmButtonText: 'Entendido',
    didOpen: (popup) => {
      const boton = popup.querySelector('.aviso-justif__ayuda')
      const proceso = popup.querySelector('.aviso-justif__proceso')
      boton?.addEventListener('click', () => {
        const abrir = proceso.hidden
        proceso.hidden = !abrir
        boton.setAttribute('aria-expanded', String(abrir))
      })
    },
  })
}
