import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConfirmandosStore } from './confirmandos'
import { useAuthStore } from './auth'

// Arma una asistencia mínima con la fecha y estado que necesitemos para
// controlar el orden cronológico del cálculo de racha.
function asistencia(fecha, estado) {
  return { estado, reunion: { fecha } }
}

function confirmandoBase(overrides) {
  return {
    id: 1,
    apellidos: 'Pacherres Litano',
    nombres: 'Ariane Yamile',
    estado: 'en_preparacion',
    grupo_id: 10,
    apoderados: [],
    asistencias: [],
    ...overrides,
  }
}

describe('confirmandosAlerta (cálculo de racha de faltas injustificadas)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Gestor: así el filtro por grupo_id no interfiere, solo probamos el cálculo de racha.
    useAuthStore().user = { permissions: ['ver todas las alertas'], grupo_ids: [] }
  })

  it('detecta una racha de 4 injustificadas seguidas y la marca como ALTO/SEGUIDAS', () => {
    const store = useConfirmandosStore()
    store.items = [
      confirmandoBase({
        asistencias: [
          asistencia('2026-06-14', 'asistio'),
          asistencia('2026-06-28', 'asistio'),
          asistencia('2026-07-05', 'falta injustificada'),
          asistencia('2026-07-12', 'falta injustificada'),
          asistencia('2026-07-19', 'falta injustificada'),
          asistencia('2026-07-26', 'falta injustificada'),
        ],
      }),
    ]

    const [alerta] = store.confirmandosAlerta
    expect(alerta.injustificadas_seguidas).toBe(4)
    expect(alerta.nivel_riesgo).toBe('ALTO')
    expect(alerta.motivo_alerta).toContain('SEGUIDAS')
  })

  it('una asistencia o tardanza posterior corta la racha activa, pero NO borra el máximo histórico', () => {
    const store = useConfirmandosStore()
    store.items = [
      confirmandoBase({
        asistencias: [
          asistencia('2026-07-05', 'falta injustificada'),
          asistencia('2026-07-12', 'falta injustificada'),
          asistencia('2026-07-19', 'falta injustificada'),
          asistencia('2026-07-26', 'falta injustificada'),
          asistencia('2026-08-09', 'tardanza'),   // corta la racha activa
          asistencia('2026-08-16', 'asistio'),
          asistencia('2026-08-23', 'asistio'),
        ],
      }),
    ]

    const [alerta] = store.confirmandosAlerta
    // El máximo histórico (4) se mantiene aunque ya se haya "recuperado" después.
    expect(alerta.injustificadas_seguidas).toBe(4)
    expect(alerta.total_faltas_injustificadas).toBe(4)
  })

  it('una falta justificada NO corta la racha de injustificadas (solo asistio/tardanza la cortan)', () => {
    const store = useConfirmandosStore()
    store.items = [
      confirmandoBase({
        // Si la justificada cortara la racha, el máximo sería 2 (sin alerta, NINGUNO).
        // Como NO la corta, la racha sigue sumando hasta 4 (ALTO).
        asistencias: [
          asistencia('2026-07-05', 'falta injustificada'),
          asistencia('2026-07-12', 'falta injustificada'),
          asistencia('2026-07-19', 'falta justificada'),
          asistencia('2026-07-26', 'falta injustificada'),
          asistencia('2026-08-02', 'falta injustificada'),
        ],
      }),
    ]

    const [alerta] = store.confirmandosAlerta
    expect(alerta).toBeDefined()
    expect(alerta.injustificadas_seguidas).toBe(4)
  })

  it('sin faltas ni tardanzas relevantes, no genera alerta (queda fuera de la lista)', () => {
    const store = useConfirmandosStore()
    store.items = [
      confirmandoBase({
        asistencias: [asistencia('2026-07-05', 'asistio'), asistencia('2026-07-12', 'asistio')],
      }),
    ]

    expect(store.confirmandosAlerta).toHaveLength(0)
  })

  it('un confirmando retirado nunca aparece en las alertas, aunque tenga faltas', () => {
    const store = useConfirmandosStore()
    store.items = [
      confirmandoBase({
        estado: 'retirado',
        asistencias: [
          asistencia('2026-07-05', 'falta injustificada'),
          asistencia('2026-07-12', 'falta injustificada'),
          asistencia('2026-07-19', 'falta injustificada'),
        ],
      }),
    ]

    expect(store.confirmandosAlerta).toHaveLength(0)
  })

  it('un catequista (no gestor) solo ve alertas de sus propios grupos', () => {
    const store = useConfirmandosStore()
    store.items = [
      confirmandoBase({ id: 1, grupo_id: 10, asistencias: [asistencia('2026-07-05', 'falta injustificada'), asistencia('2026-07-12', 'falta injustificada'), asistencia('2026-07-19', 'falta injustificada')] }),
      confirmandoBase({ id: 2, grupo_id: 99, asistencias: [asistencia('2026-07-05', 'falta injustificada'), asistencia('2026-07-12', 'falta injustificada'), asistencia('2026-07-19', 'falta injustificada')] }),
    ]

    const authStore = useAuthStore()
    authStore.user = { permissions: [], grupo_ids: [10] } // sin 'ver todas las alertas', solo el grupo 10

    const ids = store.confirmandosAlerta.map(a => a.id)
    expect(ids).toEqual([1])
  })
})
