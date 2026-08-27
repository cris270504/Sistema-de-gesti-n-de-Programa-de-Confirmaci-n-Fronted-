import { describe, it, expect } from 'vitest'
import { isTokenExpired } from './funciones'

// Arma un JWT falso (sin firma real, isTokenExpired no la valida) con el
// payload que le pidamos, para poder controlar `exp` en cada caso de prueba.
function fakeJwt(payload) {
  const base64 = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '')
  return `${base64({ alg: 'none' })}.${base64(payload)}.firma-falsa`
}

describe('isTokenExpired', () => {
  it('devuelve false para un token con exp en el futuro', () => {
    const enUnaHora = Math.floor(Date.now() / 1000) + 3600
    expect(isTokenExpired(fakeJwt({ exp: enUnaHora }))).toBe(false)
  })

  it('devuelve true para un token con exp en el pasado', () => {
    const haceUnaHora = Math.floor(Date.now() / 1000) - 3600
    expect(isTokenExpired(fakeJwt({ exp: haceUnaHora }))).toBe(true)
  })

  it('devuelve true si el payload no tiene exp', () => {
    expect(isTokenExpired(fakeJwt({ sub: 1 }))).toBe(true)
  })

  it('devuelve true para un token corrupto/no parseable', () => {
    expect(isTokenExpired('esto-no-es-un-jwt')).toBe(true)
  })

  it('devuelve true para un string vacío', () => {
    expect(isTokenExpired('')).toBe(true)
  })
})
