import { describe, it, expect, vi, afterEach } from 'vitest'
import { guardarArchivo, generarExcel, generarPdf, TIPOS_ARCHIVO } from './exportConfirmandosArchivos'
import { columnasPorClave, construirFilas } from './exportConfirmandos'

afterEach(() => {
  delete window.showSaveFilePicker
  vi.restoreAllMocks()
})

describe('lib/exportConfirmandosArchivos — guardarArchivo', () => {
  const blob = new Blob(['x'])

  it('usa showSaveFilePicker con nombre sugerido y tipos cuando existe', async () => {
    const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) }
    window.showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable: async () => writable })

    const r = await guardarArchivo(blob, 'a.xlsx', TIPOS_ARCHIVO.xlsx)

    expect(r).toBe('guardado')
    const opts = window.showSaveFilePicker.mock.calls[0][0]
    expect(opts.suggestedName).toBe('a.xlsx')
    expect(opts.types[0].accept[TIPOS_ARCHIVO.xlsx.mime]).toEqual(['.xlsx'])
    expect(writable.write).toHaveBeenCalledWith(blob)
    expect(writable.close).toHaveBeenCalled()
  })

  it('si el usuario cancela (AbortError) no escribe ni lanza', async () => {
    const abort = Object.assign(new Error('cancelado'), { name: 'AbortError' })
    window.showSaveFilePicker = vi.fn().mockRejectedValue(abort)

    await expect(guardarArchivo(blob, 'a.pdf', TIPOS_ARCHIVO.pdf)).resolves.toBe('cancelado')
  })

  it('propaga errores que no son cancelación', async () => {
    window.showSaveFilePicker = vi.fn().mockRejectedValue(new Error('disco lleno'))

    await expect(guardarArchivo(blob, 'a.pdf', TIPOS_ARCHIVO.pdf)).rejects.toThrow('disco lleno')
  })

  it('si el navegador rechaza el selector por falta de gesto del usuario (SecurityError) descarga con enlace', async () => {
    const seguridad = Object.assign(new Error('user activation'), { name: 'SecurityError' })
    window.showSaveFilePicker = vi.fn().mockRejectedValue(seguridad)
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await expect(guardarArchivo(blob, 'a.pdf', TIPOS_ARCHIVO.pdf)).resolves.toBe('guardado')
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('sin showSaveFilePicker descarga con <a download> y libera la URL', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const r = await guardarArchivo(blob, 'a.pdf', TIPOS_ARCHIVO.pdf)

    expect(r).toBe('guardado')
    expect(click).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    expect(document.querySelector('a[download]')).toBeNull()
  })
})

describe('lib/exportConfirmandosArchivos — generadores', () => {
  const columnas = columnasPorClave(['apellidos', 'nombres', 'estado'])
  const filas = construirFilas(
    [{ apellidos: 'Paz', nombres: 'Ana', estado: 'confirmado' }],
    columnas,
  )

  it('generarExcel produce un .xlsx válido (zip) con encabezado y fila', async () => {
    const blob = await generarExcel({ titulo: 'Confirmandos – Todos', columnas, filas })

    expect(blob.type).toBe(TIPOS_ARCHIVO.xlsx.mime)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')

    const { default: ExcelJS } = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await blob.arrayBuffer())
    const ws = wb.worksheets[0]
    expect(ws.getRow(1).values.slice(1)).toEqual(['Apellidos', 'Nombres', 'Estado'])
    expect(ws.getRow(2).values.slice(1)).toEqual(['Paz', 'Ana', 'Confirmado'])
    expect(ws.getRow(1).font.bold).toBe(true)
    expect(ws.views[0].state).toBe('frozen')
    expect(ws.autoFilter).toBeTruthy()
    // La primera carga de exceljs en vitest es lenta (transformación): timeout holgado.
  }, 90000)

  it('generarPdf produce un PDF', async () => {
    const blob = await generarPdf({
      titulo: 'Confirmandos – Todos',
      columnas,
      filas,
      filtros: ['Grupo: A'],
      fecha: new Date(2026, 9, 5),
    })

    expect(blob.type).toBe(TIPOS_ARCHIVO.pdf.mime)
    const texto = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 8))
    expect(texto.startsWith('%PDF-')).toBe(true)
  })
})
