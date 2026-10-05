import { describe, it, expect } from 'vitest'
import {
  COLUMNAS,
  GRUPOS_COLUMNAS,
  ESTADOS_EXPORT,
  A4_ANCHO_UTIL_VERTICAL_MM,
  calcularEdad,
  calcularOrientacionPdf,
  columnasPorClave,
  construirFilas,
  describirFiltros,
  nombreArchivoExport,
  tituloExport,
} from './exportConfirmandos'

const confirmando = {
  id: 1,
  nombres: 'Luis Alberto',
  apellidos: 'Quispe Ramos',
  fecha_nacimiento: '2010-03-15',
  genero: 'm',
  celular: '987654321',
  estado: 'en_preparacion',
  grupo: { id: 2, nombre: 'Grupo A', procedencia: 'sede' },
  sacramentos: [
    { nombre: 'Bautismo', pivot: { estado: 'pendiente' } },
    { nombre: 'Comunión', pivot: { estado: 'recibido' } },
  ],
  apoderados: [
    { nombres: 'Ana', apellidos: 'Paz', celular: '911', pivot: { tipo_apoderado_id: 2 } },
    { nombres: 'Juan', apellidos: 'Ríos', celular: null, pivot: { tipo_apoderado_id: 1 } },
    { nombres: 'Eva', apellidos: 'Sol', celular: '922', pivot: { tipo_apoderado_id: 9 } },
  ],
  requisitos: [
    { nombre: 'Partida', pivot: { estado: 'entregado' } },
    { nombre: 'Foto', pivot: { estado: 'pendiente' } },
  ],
  fecha_retiro: null,
  motivo_retiro: null,
}

const valor = (clave, c = confirmando, hoy = new Date(2026, 9, 5)) =>
  COLUMNAS.find((col) => col.key === clave).get(c, { hoy })

describe('lib/exportConfirmandos — catálogo', () => {
  it('cada columna tiene clave única, etiqueta, ancho y grupo válido', () => {
    const claves = COLUMNAS.map((c) => c.key)
    expect(new Set(claves).size).toBe(claves.length)
    const grupos = GRUPOS_COLUMNAS.map((g) => g.id)
    for (const c of COLUMNAS) {
      expect(c.label).toBeTruthy()
      expect(c.width).toBeGreaterThan(0)
      expect(grupos).toContain(c.group)
      expect(typeof c.get).toBe('function')
    }
  })

  it('expone los cuatro estados del modal', () => {
    expect(ESTADOS_EXPORT.map((e) => e.value)).toEqual(['en_preparacion', 'confirmado', 'retirado', 'todos'])
  })
})

describe('lib/exportConfirmandos — getters', () => {
  it('datos personales', () => {
    expect(valor('apellidos')).toBe('Quispe Ramos')
    expect(valor('nombres')).toBe('Luis Alberto')
    expect(valor('fecha_nacimiento')).toBe('15/03/2010')
    expect(valor('edad')).toBe('16')
    expect(valor('genero')).toBe('Masculino')
    expect(valor('celular')).toBe('987654321')
    expect(valor('estado')).toBe('En preparación')
  })

  it('vacíos y género femenino / sin dato', () => {
    const vacio = { ...confirmando, fecha_nacimiento: null, genero: 'f', celular: null, grupo: null }
    expect(valor('fecha_nacimiento', vacio)).toBe('')
    expect(valor('edad', vacio)).toBe('')
    expect(valor('genero', vacio)).toBe('Femenino')
    expect(valor('celular', vacio)).toBe('')
    expect(valor('grupo', vacio)).toBe('Sin grupo')
    expect(valor('procedencia', vacio)).toBe('')
    expect(valor('genero', { ...vacio, genero: null })).toBe('')
  })

  it('grupo y procedencia', () => {
    expect(valor('grupo')).toBe('Grupo A')
    expect(valor('procedencia')).toBe('Sede')
  })

  it('sacramentos con estado real', () => {
    expect(valor('sacramentos')).toBe('Bautismo: Pendiente, Comunión: Recibido')
    expect(valor('sacramentos', { ...confirmando, sacramentos: [] })).toBe('')
  })

  it('apoderados con tipo y celular', () => {
    expect(valor('apoderados')).toBe(
      'Madre: Ana Paz (911); Padre: Juan Ríos; Tutor: Eva Sol (922)',
    )
    expect(valor('apoderados', { ...confirmando, apoderados: [] })).toBe('')
  })

  it('requisitos con estado', () => {
    expect(valor('requisitos')).toBe('Partida: Entregado, Foto: Pendiente')
  })

  it('retiro', () => {
    const retirado = { ...confirmando, estado: 'retirado', fecha_retiro: '2026-08-01T00:00:00Z', motivo_retiro: 'Mudanza' }
    expect(valor('fecha_retiro', retirado)).toBe('01/08/2026')
    expect(valor('motivo_retiro', retirado)).toBe('Mudanza')
    expect(valor('fecha_retiro')).toBe('')
  })
})

describe('lib/exportConfirmandos — calcularEdad', () => {
  it('resta un año si aún no cumplió', () => {
    expect(calcularEdad('2010-10-06', new Date(2026, 9, 5))).toBe(15)
    expect(calcularEdad('2010-10-05', new Date(2026, 9, 5))).toBe(16)
  })
  it('devuelve null con fecha ausente o inválida', () => {
    expect(calcularEdad(null)).toBeNull()
    expect(calcularEdad('xx')).toBeNull()
  })
})

describe('lib/exportConfirmandos — filas y columnas', () => {
  it('columnasPorClave respeta el orden del catálogo y descarta claves desconocidas', () => {
    const cols = columnasPorClave(['celular', 'inexistente', 'apellidos'])
    expect(cols.map((c) => c.key)).toEqual(['apellidos', 'celular'])
  })

  it('construirFilas devuelve solo las columnas elegidas', () => {
    const cols = columnasPorClave(['apellidos', 'estado'])
    expect(construirFilas([confirmando], cols)).toEqual([['Quispe Ramos', 'En preparación']])
  })
})

describe('lib/exportConfirmandos — orientación PDF', () => {
  const ancho = (n) => ({ width: n })
  it('vertical cuando las columnas caben en el ancho útil A4', () => {
    expect(calcularOrientacionPdf([ancho(60), ancho(60), ancho(70)])).toBe('portrait')
    expect(calcularOrientacionPdf([ancho(A4_ANCHO_UTIL_VERTICAL_MM)])).toBe('portrait')
  })
  it('horizontal cuando exceden el ancho útil', () => {
    expect(calcularOrientacionPdf([ancho(100), ancho(A4_ANCHO_UTIL_VERTICAL_MM - 99)])).toBe('landscape')
  })
  it('sin columnas es vertical', () => {
    expect(calcularOrientacionPdf([])).toBe('portrait')
  })
  it('las columnas básicas caben en vertical y todas juntas no', () => {
    expect(calcularOrientacionPdf(columnasPorClave(['apellidos', 'nombres', 'celular', 'estado']))).toBe('portrait')
    expect(calcularOrientacionPdf(COLUMNAS)).toBe('landscape')
  })
})

describe('lib/exportConfirmandos — nombre, título y filtros', () => {
  it('nombre de archivo con estado y fecha', () => {
    expect(nombreArchivoExport({ estado: 'en_preparacion', fecha: new Date(2026, 9, 5), extension: 'xlsx' }))
      .toBe('confirmandos_en-preparacion_2026-10-05.xlsx')
    expect(nombreArchivoExport({ estado: 'todos', fecha: new Date(2026, 0, 9), extension: 'pdf' }))
      .toBe('confirmandos_todos_2026-01-09.pdf')
  })

  it('título según el estado', () => {
    expect(tituloExport('confirmado')).toBe('Confirmandos – Confirmados')
    expect(tituloExport('todos')).toBe('Confirmandos – Todos')
  })

  it('describirFiltros lista solo los activos', () => {
    expect(describirFiltros({ search: '', grupo: 'todos', procedencia: 'todos' }, [])).toEqual([])
    const grupos = [{ id: 4, nombre: 'Grupo B' }]
    expect(
      describirFiltros({ search: ' Jose ', grupo: 4, procedencia: 'sede' }, grupos),
    ).toEqual(['Búsqueda: "Jose"', 'Grupo: Grupo B', 'Procedencia: Sede'])
    expect(describirFiltros({ grupo: 'sin_grupo' }, [])).toEqual(['Grupo: Sin grupo asignado'])
  })
})
