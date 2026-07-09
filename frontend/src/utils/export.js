/**
 * 通用文档导出工具：支持 Word (.docx) 和 PDF 导出
 *
 * Word 使用 docx 库生成结构化文档（标题/段落/表格/列表）
 * PDF 使用 html2canvas + jsPDF 将 DOM 元素截图转 PDF（完美支持中文）
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle,
} from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// ==================== Word 导出 ====================

const STYLES = {
  title: { heading: HeadingLevel.TITLE, size: 32, bold: true, align: AlignmentType.CENTER },
  h1: { heading: HeadingLevel.HEADING_1, size: 26, bold: true },
  h2: { heading: HeadingLevel.HEADING_2, size: 22, bold: true },
  h3: { heading: HeadingLevel.HEADING_3, size: 20, bold: true },
  body: { size: 22, spacing: { after: 120, line: 360 } },
  meta: { size: 18, color: '888888', align: AlignmentType.CENTER, spacing: { after: 200 } },
}

function makeParagraph(text, styleKey = 'body') {
  const s = STYLES[styleKey] || STYLES.body
  const opts = {
    children: [new TextRun({ text: String(text || ''), size: s.size, bold: s.bold, color: s.color })],
  }
  if (s.heading) opts.heading = s.heading
  if (s.align) opts.alignment = s.align
  if (s.spacing) opts.spacing = s.spacing
  return new Paragraph(opts)
}

function makeTableCell(text, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: String(text ?? ''), size: opts.size || 20, bold: opts.bold })],
      alignment: opts.align || AlignmentType.LEFT,
    })],
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
  })
}

/**
 * 构建 Word 文档内容
 * @param {Object} doc - 文档结构
 * @param {string} doc.title - 文档标题
 * @param {string} [doc.subtitle] - 副标题/元信息
 * @param {Array} doc.sections - 章节数组 [{ heading, paragraphs?, table?, list? }]
 *   - table: { headers: [], rows: [[], ...] }
 *   - list: [string, ...]
 *   - paragraphs: [string, ...]
 * @returns {Document}
 */
function buildDocxDocument(doc) {
  const children = []

  // 标题
  children.push(makeParagraph(doc.title, 'title'))

  // 元信息
  if (doc.subtitle) {
    children.push(makeParagraph(doc.subtitle, 'meta'))
  }

  children.push(new Paragraph({ text: '', spacing: { after: 200 } }))

  // 章节
  for (const section of doc.sections) {
    children.push(makeParagraph(section.heading, 'h2'))

    if (section.paragraphs) {
      for (const p of section.paragraphs) {
        children.push(makeParagraph(p, 'body'))
      }
    }

    if (section.list) {
      for (const item of section.list) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `\u2022  ${item}`, size: 22 })],
          spacing: { after: 80, line: 340 },
        }))
      }
    }

    if (section.table) {
      const { headers, rows } = section.table
      const tableRows = []

      // 表头
      tableRows.push(new TableRow({
        tableHeader: true,
        children: headers.map(h => makeTableCell(h, { bold: true, size: 20 })),
      }))

      // 数据行
      for (const row of rows) {
        tableRows.push(new TableRow({
          children: row.map(cell => makeTableCell(cell, { size: 20 })),
        }))
      }

      children.push(new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }))

      children.push(new Paragraph({ text: '', spacing: { after: 200 } }))
    }
  }

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      children,
    }],
  })
}

/**
 * 导出 Word 文档
 * @param {Object} doc - 文档结构（同 buildDocxDocument）
 * @param {string} fileName - 文件名（不含扩展名）
 */
export async function exportToWord(doc, fileName) {
  const document = buildDocxDocument(doc)
  const blob = await Packer.toBlob(document)
  saveAs(blob, `${fileName}.docx`)
}

// ==================== PDF 导出 ====================

/**
 * 将 DOM 元素导出为 PDF
 * @param {HTMLElement} element - 要导出的 DOM 元素
 * @param {string} fileName - 文件名（不含扩展名）
 * @param {Object} [opts] - 选项
 * @param {string} [opts.orientation] - 'portrait' | 'landscape'
 */
export async function exportElementToPDF(element, fileName, opts = {}) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const orientation = opts.orientation || 'portrait'
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const contentWidth = pdfWidth - margin * 2
  const contentHeight = pdfHeight - margin * 2

  const imgWidth = contentWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = margin

  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST')
  heightLeft -= contentHeight

  while (heightLeft > 0) {
    position -= contentHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST')
    heightLeft -= contentHeight
  }

  pdf.save(`${fileName}.pdf`)
}

/**
 * 生成 PDF 的临时容器（用于结构化内容导出）
 * @param {Object} doc - 文档结构（同 exportToWord）
 * @returns {HTMLElement}
 */
function createPDFTempContainer(doc) {
  const container = document.createElement('div')
  container.style.cssText = `
    position: absolute; left: -9999px; top: 0; width: 800px;
    background: #fff; padding: 40px; font-family: 'Microsoft YaHei', 'SimSun', sans-serif;
    color: #333; font-size: 14px; line-height: 1.8;
  `

  let html = `<h1 style="text-align:center;font-size:24px;margin-bottom:8px;">${doc.title}</h1>`
  if (doc.subtitle) {
    html += `<p style="text-align:center;color:#888;font-size:13px;margin-bottom:24px;">${doc.subtitle}</p>`
  }
  html += '<hr style="margin-bottom:20px;">'

  for (const section of doc.sections) {
    html += `<h2 style="font-size:18px;border-left:3px solid #409EFF;padding-left:10px;margin:20px 0 10px;">${section.heading}</h2>`

    if (section.paragraphs) {
      for (const p of section.paragraphs) {
        html += `<p style="margin:8px 0;">${p}</p>`
      }
    }

    if (section.list) {
      html += '<ul style="padding-left:24px;">'
      for (const item of section.list) {
        html += `<li style="margin:4px 0;">${item}</li>`
      }
      html += '</ul>'
    }

    if (section.table) {
      const { headers, rows } = section.table
      html += '<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:13px;">'
      html += '<thead><tr>'
      for (const h of headers) {
        html += `<th style="border:1px solid #ddd;padding:8px;background:#f5f7fa;text-align:left;">${h}</th>`
      }
      html += '</tr></thead><tbody>'
      for (const row of rows) {
        html += '<tr>'
        for (const cell of row) {
          html += `<td style="border:1px solid #ddd;padding:8px;">${cell ?? ''}</td>`
        }
        html += '</tr>'
      }
      html += '</tbody></table>'
    }
  }

  container.innerHTML = html
  document.body.appendChild(container)
  return container
}

/**
 * 导出结构化内容为 PDF
 * @param {Object} doc - 文档结构（同 exportToWord）
 * @param {string} fileName - 文件名（不含扩展名）
 * @param {Object} [opts] - 选项
 */
export async function exportToPDF(doc, fileName, opts = {}) {
  const container = createPDFTempContainer(doc)
  try {
    await exportElementToPDF(container, fileName, opts)
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * 通用导出：根据 format 调用 Word 或 PDF
 * @param {string} format - 'word' | 'pdf'
 * @param {Object} doc - 文档结构
 * @param {string} fileName - 文件名（不含扩展名）
 */
export async function exportDocument(format, doc, fileName, opts = {}) {
  if (format === 'word' || format === 'docx') {
    await exportToWord(doc, fileName)
  } else if (format === 'pdf') {
    await exportToPDF(doc, fileName, opts)
  } else {
    throw new Error(`不支持的导出格式: ${format}`)
  }
}
