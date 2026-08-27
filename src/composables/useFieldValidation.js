import { computed, reactive } from 'vue'

// Formatos peruanos usados en el sistema (DNI de 8 dígitos, celular de 9 que
// empieza en 9). Los campos vacíos no generan error acá — eso lo sigue
// resolviendo el `required` del input y la validación al enviar el formulario;
// esto es solo feedback en tiempo real mientras el usuario escribe.
const DNI_REGEX = /^\d{8}$/
const CELULAR_REGEX = /^9\d{8}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validarDni(valor) {
  if (!valor) return null
  return DNI_REGEX.test(valor) ? null : 'El DNI debe tener 8 dígitos'
}

export function validarCelular(valor) {
  if (!valor) return null
  return CELULAR_REGEX.test(valor) ? null : 'El celular debe tener 9 dígitos y empezar en 9'
}

export function validarEmail(valor) {
  if (!valor) return null
  return EMAIL_REGEX.test(valor) ? null : 'Ingresa un correo válido'
}

/**
 * Validación en tiempo real por campo, mostrando el error recién cuando el
 * usuario sale del campo (blur) — no en cada tecla, para no marcar "inválido"
 * un DNI a medio escribir.
 *
 * @param {Record<string, () => string|null>} reglas - ej. { dni: () => validarDni(draft.value.dni) }
 * @example
 * const { errores, marcarTocado } = useFieldValidation({
 *   dni: () => validarDni(draft.value.dni),
 *   email: () => validarEmail(draft.value.email),
 * })
 * // en el template: :class="{ 'is-invalid': errores.dni }" @blur="marcarTocado('dni')"
 */
export function useFieldValidation(reglas) {
  const tocados = reactive({})

  const marcarTocado = (campo) => { tocados[campo] = true }

  const errores = computed(() => {
    const out = {}
    for (const campo in reglas) {
      out[campo] = tocados[campo] ? reglas[campo]() : null
    }
    return out
  })

  const esValido = computed(() => Object.values(reglas).every(regla => !regla()))

  return { errores, marcarTocado, esValido }
}
