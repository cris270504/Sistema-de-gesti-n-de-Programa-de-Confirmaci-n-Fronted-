import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/stores/confirmandos', () => ({
  useConfirmandosStore: vi.fn(),
}))
vi.mock('@/funciones', () => ({
  showAlerta: vi.fn(),
}))

import { useConfirmandosStore } from '@/stores/confirmandos'
import { showAlerta } from '@/funciones'
import { useImportExcel } from './useImportExcel'

function archivoFalso(nombre) {
  return { target: { files: [{ name: nombre }], value: '' } }
}

describe('useImportExcel', () => {
  let importarExcel
  let recargarTabla

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    importarExcel = vi.fn().mockResolvedValue({ message: 'ok' })
    useConfirmandosStore.mockReturnValue({ importarExcel })
    recargarTabla = vi.fn()
  })

  it('rechaza una extensión no permitida sin llamar al service', async () => {
    const { handleFileUpload, isImporting } = useImportExcel(recargarTabla)
    await handleFileUpload(archivoFalso('confirmandos.pdf'))

    expect(importarExcel).not.toHaveBeenCalled()
    expect(showAlerta).toHaveBeenCalledWith(expect.stringContaining('Excel'), 'warning')
    expect(isImporting.value).toBe(false)
  })

  it('con extensión válida, importa y recarga la tabla', async () => {
    const { handleFileUpload } = useImportExcel(recargarTabla)
    await handleFileUpload(archivoFalso('confirmandos.xlsx'))

    expect(importarExcel).toHaveBeenCalled()
    expect(recargarTabla).toHaveBeenCalled()
    expect(showAlerta).toHaveBeenCalledWith('ok', 'success')
  })

  it('si el service falla, muestra el error y no recarga la tabla', async () => {
    importarExcel.mockRejectedValue(new Error('boom'))
    const { handleFileUpload } = useImportExcel(recargarTabla)
    await handleFileUpload(archivoFalso('confirmandos.csv'))

    expect(recargarTabla).not.toHaveBeenCalled()
    expect(showAlerta).toHaveBeenCalledWith(expect.any(String), 'error')
  })
})
