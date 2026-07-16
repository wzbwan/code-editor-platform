import * as XLSX from 'xlsx'

export type ExportCell = string | number | boolean | Date | null

interface CreateExportWorksheetOptions {
  columnWidths: number[]
  numberFormats?: Record<number, string>
}

function protectSpreadsheetText(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}

export function createExportWorksheet(
  rows: ExportCell[][],
  options: CreateExportWorksheetOptions
) {
  const normalizedRows = rows.map((row) =>
    row.map((cell) => (typeof cell === 'string' ? protectSpreadsheetText(cell) : cell))
  )
  const worksheet = XLSX.utils.aoa_to_sheet(normalizedRows, { cellDates: true })

  worksheet['!cols'] = options.columnWidths.map((wch) => ({ wch }))

  if (rows.length > 0 && rows[0].length > 0) {
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(rows.length - 1, 0), c: rows[0].length - 1 },
      }),
    }

    for (let columnIndex = 0; columnIndex < rows[0].length; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: 0, c: columnIndex })
      const cell = worksheet[address]
      if (!cell) {
        continue
      }

      cell.s = {
        fill: { fgColor: { rgb: '1F4E78' } },
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
    }
  }

  for (const [columnIndexText, numberFormat] of Object.entries(
    options.numberFormats ?? {}
  )) {
    const columnIndex = Number(columnIndexText)
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
      if (worksheet[address]) {
        worksheet[address].z = numberFormat
      }
    }
  }

  worksheet['!rows'] = [{ hpt: 24 }]

  return worksheet
}

export function writeExportWorkbook(workbook: XLSX.WorkBook) {
  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
    cellStyles: true,
  })
}

export function makeUniqueWorksheetName(
  value: string,
  usedNames: Set<string>,
  fallback: string
) {
  const base = value.replace(/[\\/?*\[\]:]/g, '_').trim().slice(0, 31) || fallback
  let name = base
  let suffix = 2

  while (usedNames.has(name)) {
    const suffixText = `-${suffix}`
    name = `${base.slice(0, 31 - suffixText.length)}${suffixText}`
    suffix += 1
  }

  usedNames.add(name)
  return name
}
