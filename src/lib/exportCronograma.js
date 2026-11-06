// Exportar el cronograma de una jornada a Word (.docx) y PDF.
// Misma estructura que la app de origen (C:\dev\CRONOGRAMAS\export-docx.js):
// tabla HORA | MOMENTO | DETALLE | RESPONSABLE, momento clave resaltado y
// tabla aparte "Sin hora definida". docx / jspdf se cargan con import()
// dinámico: solo pesan cuando alguien exporta.
import { duracionTexto, fechaLarga, nombreArchivo, partesFecha, rango } from './cronograma'
import { TIPOS_ARCHIVO, guardarArchivo } from './exportConfirmandosArchivos'

export const TIPO_DOCX = {
  extension: 'docx',
  mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  descripcion: 'Documento de Word',
}

const CLAVE_HEX = 'FFEDD5'
const ENCABEZADOS = ['HORA', 'MOMENTO', 'DETALLE', 'RESPONSABLE']
const ANCHOS = [22, 30, 30, 18] // % por columna

const hex = (color) => String(color || '#2563eb').replace('#', '').slice(0, 6).toUpperCase()

/**
 * Filas listas para exportar (texto plano, sin HTML).
 * @param {object} c          resultado de calcular()
 * @param {(ids:number[])=>string} nombresDe  ids de responsables → "Ana, Luis"
 */
export function filasExport(c, nombresDe) {
  const fila = (m, conHora, esClave = false) => ({
    hora: conHora ? rango(m.inicio, m.fin) : '—',
    momento: esClave ? `${m.nombre}  (momento clave)` : m.nombre,
    detalle: m.detalle || '',
    responsable: nombresDe(m.responsables ?? []),
    esClave,
  })
  return {
    programa: c.filas.map((f) => fila(f, true, f.esClave)),
    sinHora: c.sinHora.map((m) => fila(m, false)),
  }
}

export function resumenTexto(reunion, c) {
  const fecha = fechaLarga(partesFecha(reunion.fecha).fecha)
  const horario = c.filas.length
    ? `${rango(c.inicio, c.fin)}  ·  ${duracionTexto(c.total)}  ·  ${c.filas.length} momento${c.filas.length === 1 ? '' : 's'}`
    : 'Sin momentos programados'
  return [fecha, horario].filter(Boolean).join('  ·  ')
}

const tituloDe = (reunion) =>
  reunion.categoria?.nombre ? `${reunion.categoria.nombre} · ${reunion.nombre_tema}` : reunion.nombre_tema

export async function generarDocx({ reunion, c, nombresDe, color }) {
  const {
    AlignmentType, BorderStyle, Document, Packer, Paragraph, ShadingType,
    Table, TableCell, TableRow, TextRun, WidthType,
  } = await import('docx')
  const primario = hex(color)
  const borde = { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' }
  const bordes = { top: borde, bottom: borde, left: borde, right: borde }
  const texto = (t, opts = {}) => new TextRun({ text: t ?? '', font: 'Calibri', size: 21, ...opts })

  const celda = (t, i, { encabezado = false, clave = false } = {}) => new TableCell({
    width: { size: ANCHOS[i], type: WidthType.PERCENTAGE },
    borders: bordes,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: encabezado
      ? { type: ShadingType.CLEAR, fill: primario, color: 'auto' }
      : clave ? { type: ShadingType.CLEAR, fill: CLAVE_HEX, color: 'auto' } : undefined,
    children: String(t ?? '').split('\n').map((l) => new Paragraph({
      alignment: encabezado ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [texto(l, { bold: encabezado || clave, color: encabezado ? 'FFFFFF' : '1E293B' })],
    })),
  })

  const tabla = (filas) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: ENCABEZADOS.map((t, i) => celda(t, i, { encabezado: true })) }),
      ...filas.map((f) => new TableRow({
        cantSplit: true,
        children: [f.hora, f.momento, f.detalle, f.responsable].map((t, i) => celda(t, i, { clave: f.esClave })),
      })),
    ],
  })

  const { programa, sinHora } = filasExport(c, nombresDe)
  const hijos = [
    new Paragraph({ spacing: { after: 80 }, children: [texto(tituloDe(reunion), { bold: true, size: 36, color: primario })] }),
    new Paragraph({ spacing: { after: 240 }, children: [texto(resumenTexto(reunion, c), { color: '475569' })] }),
  ]
  if (programa.length) hijos.push(tabla(programa))
  if (sinHora.length) {
    hijos.push(
      new Paragraph({ spacing: { before: 360, after: 120 }, children: [texto('Sin hora definida', { bold: true, size: 26, color: primario })] }),
      tabla(sinHora),
    )
  }

  const doc = new Document({
    creator: 'SGPC',
    title: tituloDe(reunion),
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: hijos }],
  })
  return Packer.toBlob(doc)
}

const rgb = (color) => {
  const h = hex(color)
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export async function generarPdf({ reunion, c, nombresDe, color }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margen = 14
  const anchoUtil = doc.internal.pageSize.getWidth() - 2 * margen
  const primario = rgb(color)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...primario)
  doc.text(doc.splitTextToSize(tituloDe(reunion), anchoUtil), margen, margen + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(doc.splitTextToSize(resumenTexto(reunion, c), anchoUtil), margen, margen + 11)

  const { programa, sinHora } = filasExport(c, nombresDe)
  const columnStyles = Object.fromEntries(ANCHOS.map((a, i) => [i, { cellWidth: (a / 100) * anchoUtil }]))
  const tabla = (filas, startY) => autoTable(doc, {
    head: [ENCABEZADOS],
    body: filas.map((f) => [f.hora, f.momento, f.detalle, f.responsable]),
    startY,
    margin: { left: margen, right: margen },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.8, overflow: 'linebreak', valign: 'top', textColor: [30, 41, 59] },
    headStyles: { fillColor: primario, textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles,
    showHead: 'everyPage',
    didParseCell: (data) => {
      if (data.section === 'body' && filas[data.row.index]?.esClave) {
        data.cell.styles.fillColor = [255, 237, 213]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  let y = margen + 18
  if (programa.length) {
    tabla(programa, y)
    y = doc.lastAutoTable.finalY + 10
  }
  if (sinHora.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...primario)
    doc.text('Sin hora definida', margen, y)
    tabla(sinHora, y + 3)
  }

  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(`Página ${p} de ${paginas}`, doc.internal.pageSize.getWidth() - margen, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
  }
  return doc.output('blob')
}

export async function exportarCronograma(formato, datos) {
  const base = nombreArchivo(`Cronograma - ${datos.reunion.nombre_tema}`)
  if (formato === 'docx') {
    return guardarArchivo(await generarDocx(datos), `${base}.docx`, TIPO_DOCX)
  }
  return guardarArchivo(await generarPdf(datos), `${base}.pdf`, TIPOS_ARCHIVO.pdf)
}
