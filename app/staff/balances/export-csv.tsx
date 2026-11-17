'use client'

type Row = {
  name: string
  phone: string
  email: string
  unpaid: number
  owed: string
  since: string
}

/** Quote anything containing a comma, quote or newline, per RFC 4180. */
function cell(v: string | number) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function ExportCsv({ rows }: { rows: Row[] }) {
  function download() {
    const header = ['Name', 'Phone', 'Email', 'Unpaid sessions', 'Owed (£)', 'Unpaid since']
    const body = rows.map((r) => [r.name, r.phone, r.email, r.unpaid, r.owed, r.since])
    const csv = [header, ...body].map((line) => line.map(cell).join(',')).join('\r\n')

    // Excel needs the BOM to read £ correctly.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `caesars-outstanding-${stamp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="export-row">
      <button className="btn-add" type="button" onClick={download}>
        Download as CSV
      </button>
      <span className="pane-sub">
        {rows.length} member{rows.length === 1 ? '' : 's'} to chase
      </span>
    </div>
  )
}
