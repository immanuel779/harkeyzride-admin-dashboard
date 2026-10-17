export function toCsv<T>(
  rows: T[],
  columns: Array<{ key: keyof T | string; header: string; accessor?: (row: T) => unknown }>,
): string {
  const header = columns.map((c) => escapeCsv(c.header)).join(',')

  const lines = rows.map((row) => {
    return columns
      .map((col) => {
        const value = col.accessor
          ? col.accessor(row)
          : (row as Record<string, unknown>)[col.key as string]
        return escapeCsv(value)
      })
      .join(',')
  })

  return [header, ...lines].join('\n')
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(filename, blob)
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}