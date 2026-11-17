export interface CsvColumn<T> {
  label: string
  value: (row: T) => string | number | null | undefined
}

function escapeCell(value: string | number | null | undefined) {
  if (value == null) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]) {
  const header = columns.map((column) => escapeCell(column.label)).join(',')
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(','),
  )
  return [header, ...body].join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  // UTF-8 BOM keeps Excel from mangling the peso sign and accented names.
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function csvFilename(prefix: string, from: string, to: string) {
  return `${prefix}_${from}_to_${to}.csv`
}
