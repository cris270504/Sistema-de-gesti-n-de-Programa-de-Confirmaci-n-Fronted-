import { describe, it, expect } from 'vitest'
import { validarDni, validarCelular, validarEmail } from './useFieldValidation'

describe('validarDni', () => {
  it('acepta 8 dígitos', () => expect(validarDni('12345678')).toBeNull())
  it('rechaza menos de 8 dígitos', () => expect(validarDni('1234')).not.toBeNull())
  it('rechaza letras', () => expect(validarDni('1234567a')).not.toBeNull())
  it('vacío no genera error (lo maneja required)', () => expect(validarDni('')).toBeNull())
})

describe('validarCelular', () => {
  it('acepta 9 dígitos que empiezan en 9', () => expect(validarCelular('987654321')).toBeNull())
  it('rechaza si no empieza en 9', () => expect(validarCelular('123456789')).not.toBeNull())
  it('rechaza menos de 9 dígitos', () => expect(validarCelular('98765')).not.toBeNull())
  it('vacío no genera error (celular es opcional)', () => expect(validarCelular('')).toBeNull())
})

describe('validarEmail', () => {
  it('acepta un email válido', () => expect(validarEmail('user@ejemplo.com')).toBeNull())
  it('rechaza sin @', () => expect(validarEmail('userejemplo.com')).not.toBeNull())
  it('rechaza sin dominio', () => expect(validarEmail('user@ejemplo')).not.toBeNull())
  it('vacío no genera error (lo maneja required)', () => expect(validarEmail('')).toBeNull())
})
