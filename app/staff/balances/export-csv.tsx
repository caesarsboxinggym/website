'use client'

import { downloadCsv } from '@/lib/csv'

type Row = {
  name: string
  phone: string
  email: string
  unpaid: number
  owed: string
  since: string
}

export function ExportCsv({ rows }: { rows: Row[] }) {
  function download() {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(
      `caesars-outstanding-${stamp}.csv`,
      ['Name', 'Phone', 'Email', 'Unpaid sessions', 'Owed (£)', 'Unpaid since'],
      rows.map((r) => [r.name, r.phone, r.email, r.unpaid, r.owed, r.since])
    )
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
