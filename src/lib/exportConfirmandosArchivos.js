// Generadores de archivo del export de confirmandos. exceljs / jspdf /
// jspdf-autotable pesan bastante: se cargan con import() dinámico solo al
// exportar, para no engordar el bundle principal.
import {
  PDF_MARGEN_MM,
  calcularOrientacionPdf,
  fechaLegible,
} from './exportConfirmandos'

export const TIPOS_ARCHIVO = {
  xlsx: {
    extension: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    descripcion: 'Libro de Excel',
  },
  pdf: {
    extension: 'pdf',
    mime: 'application/pdf',
    descripcion: 'Documento PDF',
  },
  docx: {
    extension: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    descripcion: 'Documento de Word',
  },
}

// mm estimados → caracteres de ancho de columna de Excel.
const anchoExcel = (mm) => Math.max(10, Math.round(mm * 0.6))

export async function generarExcel({ titulo, columnas, filas }) {
  return generarLibro([{ titulo, columnas, filas }])
}

// Libro con varias hojas: [{ titulo, columnas: [{ key, label, width }], filas }].
export async function generarLibro(hojas) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.created = new Date()

  for (const { titulo, columnas, filas } of hojas) {
    const ws = wb.addWorksheet(titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, '-'), {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    ws.columns = columnas.map((c) => ({
      header: c.label,
      key: c.key,
      width: anchoExcel(c.width),
      style: { alignment: { vertical: 'top', wrapText: true } },
    }))
    ws.addRows(filas)

    const encabezado = ws.getRow(1)
    encabezado.font = { bold: true }
    encabezado.alignment = { vertical: 'middle', wrapText: true }
    encabezado.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
    })
    if (columnas.length) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: TIPOS_ARCHIVO.xlsx.mime })
}

export async function generarPdf({ titulo, columnas, filas, filtros = [], fecha = new Date() }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  const orientation = calcularOrientacionPdf(columnas)
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const anchoUtil = anchoPagina - 2 * PDF_MARGEN_MM

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, PDF_MARGEN_MM, PDF_MARGEN_MM + 4)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generado el ${fechaLegible(fecha)}  |  Total: ${filas.length}`, PDF_MARGEN_MM, PDF_MARGEN_MM + 10)
  let inicioY = PDF_MARGEN_MM + 14
  if (filtros.length) {
    const lineas = doc.splitTextToSize(`Filtros: ${filtros.join('  |  ')}`, anchoUtil)
    doc.text(lineas, PDF_MARGEN_MM, inicioY)
    inicioY += lineas.length * 4
  }

  // Los anchos estimados se reparten proporcionalmente para llenar el ancho útil.
  const total = columnas.reduce((s, c) => s + c.width, 0)
  const columnStyles = Object.fromEntries(
    columnas.map((c, i) => [i, { cellWidth: (c.width / total) * anchoUtil }]),
  )

  autoTable(doc, {
    head: [columnas.map((c) => c.label)],
    body: filas,
    startY: inicioY + 1,
    margin: { left: PDF_MARGEN_MM, right: PDF_MARGEN_MM, bottom: PDF_MARGEN_MM + 4 },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [229, 231, 235], textColor: 20, fontStyle: 'bold' },
    columnStyles,
    showHead: 'everyPage',
    didDrawPage: () => {
      const altoPagina = doc.internal.pageSize.getHeight()
      doc.setFontSize(8)
      doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, anchoPagina - PDF_MARGEN_MM, altoPagina - 6, { align: 'right' })
    },
  })

  return doc.output('blob')
}

// Word: misma estructura que el PDF (título, fecha, total, filtros y tabla),
// pero editable. Usa la misma orientación automática según el ancho de columnas.
export async function generarWord({ titulo, columnas, filas, filtros = [], fecha = new Date() }) {
  const {
    AlignmentType, BorderStyle, Document, Packer, PageOrientation, Paragraph, ShadingType,
    Table, TableCell, TableRow, TextRun, WidthType,
  } = await import('docx')

  const orientacion = calcularOrientacionPdf(columnas)
  const borde = { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' }
  const bordes = { top: borde, bottom: borde, left: borde, right: borde }
  const texto = (t, opts = {}) => new TextRun({ text: t ?? '', font: 'Calibri', size: 18, ...opts })
  const total = columnas.reduce((s, c) => s + c.width, 0)

  const celda = (valor, i, encabezado = false) => new TableCell({
    width: { size: (columnas[i].width / total) * 100, type: WidthType.PERCENTAGE },
    borders: bordes,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    shading: encabezado ? { type: ShadingType.CLEAR, fill: 'E5E7EB', color: 'auto' } : undefined,
    children: String(valor ?? '').split('\n').map((linea) => new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [texto(linea, { bold: encabezado })],
    })),
  })

  const tabla = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: columnas.map((c, i) => celda(c.label, i, true)) }),
      ...filas.map((fila) => new TableRow({ cantSplit: true, children: fila.map((v, i) => celda(v, i)) })),
    ],
  })

  const hijos = [
    new Paragraph({ spacing: { after: 80 }, children: [texto(titulo, { bold: true, size: 28 })] }),
    new Paragraph({
      spacing: { after: filtros.length ? 40 : 200 },
      children: [texto(`Generado el ${fechaLegible(fecha)}  |  Total: ${filas.length}`, { color: '4B5563' })],
    }),
  ]
  if (filtros.length) {
    hijos.push(new Paragraph({
      spacing: { after: 200 },
      children: [texto(`Filtros: ${filtros.join('  |  ')}`, { color: '4B5563' })],
    }))
  }
  hijos.push(tabla)

  const margen = Math.round((PDF_MARGEN_MM / 25.4) * 1440) // mm → twips
  const doc = new Document({
    creator: 'SGPC',
    title: titulo,
    sections: [{
      properties: {
        page: {
          size: {
            orientation: orientacion === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
          },
          margin: { top: margen, bottom: margen, left: margen, right: margen },
        },
      },
      children: hijos,
    }],
  })
  return Packer.toBlob(doc)
}

function descargarConEnlace(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.style.display = 'none'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

/**
 * Guarda el archivo: con el selector nativo (File System Access API: Chrome/
 * Edge) si existe; si no, descarga normal. Devuelve 'guardado' o 'cancelado'
 * (el usuario cerró el selector: no es un error).
 */
export async function guardarArchivo(blob, nombre, tipo) {
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: nombre,
        types: [{ description: tipo.descripcion, accept: { [tipo.mime]: [`.${tipo.extension}`] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'guardado'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelado'
      // El selector exige un gesto reciente del usuario; si la consulta tardó
      // y caducó, se cae a la descarga normal en vez de fallar.
      if (e?.name !== 'SecurityError') throw e
    }
  }
  descargarConEnlace(blob, nombre)
  return 'guardado'
}
