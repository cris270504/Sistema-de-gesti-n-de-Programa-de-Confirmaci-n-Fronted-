import Swal from "sweetalert2"

/**
 * Alerta simple reutilizable
 * @param {string} mensaje
 * @param {'success'|'error'|'warning'|'info'|'question'} icono
 * @param {string} focoId  (opcional) id de elemento a enfocar
 */
export function showAlerta(mensaje, icono = 'info', focoId = '') {
  if (focoId) {
    const el = document.getElementById(focoId)
    if (el) el.focus()
  }
  Swal.fire({
    title: mensaje,
    icon: icono,
  })
}

export function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.exp) return true
    return Date.now() >= payload.exp * 1000
  } catch {
    return true // token corrupto = inválido
  }
}

export function showErroresDeValidacion(errorObj) {
  if (errorObj && typeof errorObj === 'object' && !Array.isArray(errorObj) && !(errorObj instanceof Error)) {
    const lista = Object.entries(errorObj)
      .flatMap(([k, arr]) =>
        Array.isArray(arr) ? arr.map((m) => `• ${m}`) : []
      )
      .join('\n');

    if (lista) {
      showAlerta(lista, 'error');
      return;
    }
  }

  const mensaje = errorObj?.response?.data?.message || errorObj?.message || 'No se pudo procesar la solicitud';
  showAlerta(mensaje, 'error');
}

/**
 * Confirmación genérica. NO elimina nada por sí sola.
 * Devuelve true si el usuario confirma.
 * @param {{
 *  titulo?: string,
 *  texto?: string,
 *  icono?: 'question'|'warning'|'info'|'error'|'success',
 *  confirmarTexto?: string,
 *  cancelarTexto?: string
 * }} opciones
 * @returns {Promise<boolean>}
 */
export function confirmar(opciones = {}) {
  const {
    titulo = '¿Seguro?',
    texto = 'Esta acción no se puede deshacer.',
    icono = 'question',
    confirmarTexto = 'Sí, continuar',
    cancelarTexto = 'Cancelar'
  } = opciones

  const swal = Swal.mixin({
    customClass: {
      confirmButton: 'btn btn-success me-3',
      cancelButton: 'btn btn-danger'
    },
    buttonsStyling: false
  })

  return Swal.fire({
    title: titulo,
    text: texto,
    icon: icono,
    showCancelButton: true,
    confirmButtonText: confirmarTexto,
    cancelButtonText: cancelarTexto,
  }).then(res => !!res.isConfirmed)
}

/**
 * Azúcar sintáctica para confirmar eliminación
 * @param {string} nombre nombre a mostrar (ej: título del post)
 * @returns {Promise<boolean>}
 */
export function confirmarEliminacion(nombre = 'registro') {
  return confirmar({
    titulo: `¿Seguro de eliminar “${nombre}”?`,
    texto: 'Se perderá la información del elemento.',
    icono: 'question',
    confirmarTexto: 'Sí, eliminar',
    cancelarTexto: 'Cancelar'
  })
}
