/** Quote anything containing a comma, quote or newline, per RFC 4180. */
function cell(v: string | number) {
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Build a CSV and hand it to the browser as a download. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows].map((line) => line.map(cell).join(',')).join('\r\n')

  // Excel needs the BOM to read £ correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
