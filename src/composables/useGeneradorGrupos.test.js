import { describe, it, expect, vi, afterEach } from 'vitest'
import { periodoActual } from './useGeneradorGrupos'

describe('periodoActual', () => {
  afterEach(() => vi.useRealTimers())

  it('devuelve el año calendario en curso como string', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2031, 5, 15))
    expect(periodoActual()).toBe('2031')
  })

  it('cambia con el año (no queda fijo en el código)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 31, 12))
    expect(periodoActual()).toBe('2026')
    vi.setSystemTime(new Date(2027, 0, 1, 12))
    expect(periodoActual()).toBe('2027')
  })

  it('acepta una fecha explícita', () => {
    expect(periodoActual(new Date(2040, 0, 1, 12))).toBe('2040')
  })
})
