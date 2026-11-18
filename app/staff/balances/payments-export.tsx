'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { downloadCsv } from '@/lib/csv'
import { one } from '@/lib/pg'

type Preset = 'week' | 'month' | 'custom'

/** One payment as it comes back from Supabase, with what it paid for. */
type PaymentRow = {
  id: string
  amount_pence: number
  method: 'cash' | 'card'
  sumup_ref: string | null
  note: string | null
  taken_at: string
  voided_at: string | null
  members: unknown
  taker: unknown
  passes: {
    kind: 'single' | 'week' | 'month'
    period_start: string | null
    period_end: string | null
    bookings: unknown
  }[]
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const money = (p: number) => `£${(p / 100).toFixed(2)}`

const shortDate = (s: string) =>
  fromIso(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Monday to Sunday, matching how the week pass is counted. */
function thisWeek(): [string, string] {
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return [iso(monday), iso(sunday)]
}

function thisMonth(): [string, string] {
  const now = new Date()
  return [
    iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  ]
}

const KIND_LABEL = { single: 'Single session', week: 'Week pass', month: 'Month pass' } as const

/** "Thu 19 Nov 2026 18:00 Adults Boxing" for a session, or the dates a pass covers. */
function covers(p: PaymentRow['passes'][number]) {
  if (p.kind !== 'single') {
    return p.period_start && p.period_end
      ? `${shortDate(p.period_start)} to ${shortDate(p.period_end)}`
      : ''
  }
  const sess = one(
    (one(p.bookings) as { sessions: unknown } | null)?.sessions
  ) as { session_date: string; starts: string; class_types: unknown } | null
  if (!sess) return ''
  const cls = (one(sess.class_types) as { name: string } | null)?.name ?? 'Session'
  return `${shortDate(sess.session_date)} ${sess.starts.slice(0, 5)} ${cls}`
}

/** Every payment taken between two dates, inclusive, in pages of 1,000. */
async function fetchPayments(from: string, to: string) {
  const supabase = createClient()

  // The dates are local days, so the range runs from midnight at the start
  // of the first to midnight at the end of the last.
  const start = fromIso(from)
  const end = fromIso(to)
  end.setDate(end.getDate() + 1)

  const rows: PaymentRow[] = []
  const PAGE = 1000

  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('payments')
      .select(
        'id, amount_pence, method, sumup_ref, note, taken_at, voided_at, ' +
          'members (first_name, last_name), ' +
          'taker:profiles!taken_by (full_name), ' +
          'passes (kind, period_start, period_end, bookings (sessions (session_date, starts, class_types (name))))'
      )
      .gte('taken_at', start.toISOString())
      .lt('taken_at', end.toISOString())
      .order('taken_at')
      .order('id')
      .range(page * PAGE, page * PAGE + PAGE - 1)

    if (error) return { rows: null, error: error.message }

    rows.push(...((data ?? []) as unknown as PaymentRow[]))
    if (!data || data.length < PAGE) break
  }

  return { rows, error: null }
}

type Summary = { count: number; cash: number; card: number; voided: number; range: string }

export function PaymentsExport() {
  const [preset, setPreset] = useState<Preset>('week')
  const [from, setFrom] = useState(() => thisWeek()[0])
  const [to, setTo] = useState(() => thisWeek()[1])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)

  function choose(p: Preset) {
    setPreset(p)
    setSummary(null)
    setError(null)
    if (p === 'week') [setFrom, setTo].forEach((set, i) => set(thisWeek()[i]))
    if (p === 'month') [setFrom, setTo].forEach((set, i) => set(thisMonth()[i]))
  }

  const rangeOk = Boolean(from && to && from <= to)

  async function download() {
    setError(null)
    setSummary(null)
    setBusy(true)

    const { rows, error } = await fetchPayments(from, to)
    setBusy(false)

    if (!rows) return setError(error)

    const range = from === to ? shortDate(from) : `${shortDate(from)} to ${shortDate(to)}`
    const live = rows.filter((r) => !r.voided_at)

    setSummary({
      count: live.length,
      cash: live.filter((r) => r.method === 'cash').reduce((s, r) => s + r.amount_pence, 0),
      card: live.filter((r) => r.method === 'card').reduce((s, r) => s + r.amount_pence, 0),
      voided: rows.length - live.length,
      range,
    })

    if (rows.length === 0) return

    downloadCsv(
      `caesars-payments-${from}-to-${to}.csv`,
      [
        'Date',
        'Time',
        'Member',
        'Amount (£)',
        'Method',
        'Paid for',
        'Covers',
        'SumUp ref',
        'Taken by',
        'Note',
        'Status',
      ],
      rows.map((r) => {
        const when = new Date(r.taken_at)
        const m = one(r.members) as { first_name: string; last_name: string | null } | null
        const pass = r.passes?.[0]
        return [
          iso(when),
          when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          m ? `${m.first_name} ${m.last_name ?? ''}`.trim() : '',
          (r.amount_pence / 100).toFixed(2),
          r.method === 'cash' ? 'Cash' : 'Card',
          pass ? KIND_LABEL[pass.kind] : '',
          pass ? covers(pass) : '',
          r.sumup_ref ?? '',
          (one(r.taker) as { full_name: string } | null)?.full_name ?? '',
          r.note ?? '',
          r.voided_at ? 'Voided' : 'Paid',
        ]
      })
    )
  }

  return (
    <div className="pay-export">
      <p className="queue-head">Export payments</p>
      <p className="pane-sub">
        Every payment taken in the period, one row each, as a spreadsheet file.
      </p>

      <div className="pay-presets" role="group" aria-label="Period">
        {(
          [
            ['week', 'This week'],
            ['month', 'This month'],
            ['custom', 'Custom dates'],
          ] as const
        ).map(([p, label]) => (
          <button
            key={p}
            type="button"
            className={preset === p ? 'btn-add on' : 'btn-add'}
            aria-pressed={preset === p}
            onClick={() => choose(p)}
          >
            {label}
          </button>
        ))}
      </div>

      {preset === 'custom' ? (
        <div className="pair pay-dates">
          <div className="field field-light">
            <label htmlFor="pay-from">From</label>
            <input
              id="pay-from"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setSummary(null)
              }}
            />
          </div>
          <div className="field field-light">
            <label htmlFor="pay-to">To</label>
            <input
              id="pay-to"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setSummary(null)
              }}
            />
          </div>
        </div>
      ) : (
        <p className="pane-sub">
          {shortDate(from)} to {shortDate(to)}
        </p>
      )}

      {preset === 'custom' && !rangeOk && (
        <p className="sheet-warn">Pick a start date that is on or before the end date.</p>
      )}

      {error && <p className="sheet-warn">Could not load the payments: {error}</p>}

      <div className="export-row">
        <button className="btn-record" type="button" disabled={busy || !rangeOk} onClick={download}>
          {busy ? 'Preparing…' : 'Download payments'}
        </button>
      </div>

      {summary && (
        <p className="sheet-note" role="status">
          {summary.count === 0 && summary.voided === 0 ? (
            <>No payments were taken {summary.range.includes(' to ') ? 'from' : 'on'} {summary.range}, so there is nothing to download.</>
          ) : (
            <>
              <b>
                {summary.count} payment{summary.count === 1 ? '' : 's'}, {money(summary.cash + summary.card)}
              </b>{' '}
              &mdash; {money(summary.cash)} cash, {money(summary.card)} card.
              {summary.voided > 0 &&
                ` ${summary.voided} voided payment${summary.voided === 1 ? ' is' : 's are'} listed in the file but not counted here.`}
            </>
          )}
        </p>
      )}
    </div>
  )
}
