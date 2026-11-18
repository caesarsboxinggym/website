'use client'

import { createClient } from '@/lib/supabase/client'
import { useStaff } from '@/lib/staff'
import { useData } from '@/lib/use-data'
import { PaneLoading } from '../pane-loading'
import { ExportCsv } from './export-csv'
import { PaymentsExport } from './payments-export'

type Balance = {
  member_id: string
  first_name: string
  last_name: string | null
  phone: string | null
  email: string | null
  has_email: boolean
  unpaid_sessions: number
  owed_pence: number
  oldest_unpaid: string
  newest_unpaid: string
}

const money = (p: number) => `£${(p / 100).toFixed(p % 100 ? 2 : 0)}`

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function mondayOf(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((d.getDay() + 6) % 7))
  return m
}

const shortDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function BalancesPage() {
  const staff = useStaff()

  // The view guards on is_admin() too, so a coach would see nothing regardless.
  // Saying so plainly beats showing an empty table.
  if (staff?.role !== 'admin') {
    return (
      <section className="pane on">
        <div className="pane-head">
          <h2 className="pane-title">Outstanding balances</h2>
        </div>
        <div className="locked">
          <h3>Admin only</h3>
          <p>
            Coaches can see attendance and who has paid, but amounts, totals and the chase list are
            restricted to admin.
          </p>
          <p>
            Enforced in the database, not just hidden here — a coach account cannot read the
            payments table at all.
          </p>
        </div>
      </section>
    )
  }

  return <AdminBalances />
}

async function load() {
  const supabase = createClient()

  const monday = mondayOf(new Date())
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)

  const [{ data: balanceRows, error }, { data: takingsRows }] = await Promise.all([
    supabase.from('outstanding_balances').select('*').order('owed_pence', { ascending: false }),
    supabase
      .from('takings_by_day')
      .select('day, method, payments, total_pence')
      .gte('day', iso(monday))
      .lte('day', iso(sunday)),
  ])

  const balances = (balanceRows ?? []) as Balance[]

  const totalOwed = balances.reduce((s, b) => s + b.owed_pence, 0)
  const totalSessions = balances.reduce((s, b) => s + b.unpaid_sessions, 0)

  let cash = 0
  let card = 0
  for (const t of takingsRows ?? []) {
    if (t.method === 'cash') cash += t.total_pence as number
    else card += t.total_pence as number
  }

  return { error, balances, totalOwed, totalSessions, cash, card, monday, sunday }
}

function AdminBalances() {
  const { data } = useData(load)
  if (!data) return <PaneLoading />
  const { error, balances, totalOwed, totalSessions, cash, card, monday, sunday } = data

  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <section className="pane on">
      <div className="pane-head">
        <h2 className="pane-title">Outstanding balances</h2>
        <p className="pane-sub">
          Everything unpaid, not just this week — so nothing quietly drops off the list.
        </p>
      </div>

      <div className="totals">
        <div className="tot">
          <span className="tot-k">Cash this week</span>
          <span className="tot-v">{money(cash)}</span>
        </div>
        <div className="tot">
          <span className="tot-k">Card this week</span>
          <span className="tot-v">{money(card)}</span>
        </div>
        <div className="tot tot-oxide">
          <span className="tot-k">Outstanding, all time</span>
          <span className="tot-v">{money(totalOwed)}</span>
        </div>
      </div>

      <p className="pane-sub" style={{ margin: '-6px 0 18px' }}>
        Cash and card cover {fmt(monday)} – {fmt(sunday)}. Compare the card figure against the SumUp
        weekly total — they are separate records and nothing reconciles them automatically.
      </p>

      {error && (
        <div className="locked">
          <h3>Could not load balances</h3>
          <p>{error.message}</p>
        </div>
      )}

      {!error && balances.length === 0 && (
        <div className="locked">
          <h3>Nobody owes anything</h3>
          <p>Every booked session on the system has been paid for.</p>
        </div>
      )}

      {balances.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="num">Unpaid</th>
                  <th className="num">Owes</th>
                  <th>Since</th>
                  <th>Chase by</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.member_id}>
                    <td>
                      {b.first_name} {b.last_name ?? ''}
                    </td>
                    <td className="num">{b.unpaid_sessions}</td>
                    <td className="num owed">{money(b.owed_pence)}</td>
                    <td className="num">{shortDate(b.oldest_unpaid)}</td>
                    <td>
                      {b.has_email ? (
                        <a
                          className="chip chip-link"
                          href={`mailto:${b.email}?subject=${encodeURIComponent(
                            "Caesar's Boxing Gym — outstanding sessions"
                          )}&body=${encodeURIComponent(
                            `Hi ${b.first_name},\n\nOur records show ${b.unpaid_sessions} unpaid session${
                              b.unpaid_sessions === 1 ? '' : 's'
                            } totalling ${money(b.owed_pence)}.\n\nYou can settle up at the gym, or reply and we'll send a card payment link.\n\nThanks,\nCaesar's Boxing Gym`
                          )}`}
                        >
                          Email
                        </a>
                      ) : b.phone ? (
                        <a className="chip chip-link" href={`tel:${b.phone.replace(/\s/g, '')}`}>
                          Call {b.phone}
                        </a>
                      ) : (
                        <span className="chip">No contact on file</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{totalSessions}</td>
                  <td className="num">{money(totalOwed)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <ExportCsv
            rows={balances.map((b) => ({
              name: `${b.first_name} ${b.last_name ?? ''}`.trim(),
              phone: b.phone ?? '',
              email: b.email ?? '',
              unpaid: b.unpaid_sessions,
              owed: (b.owed_pence / 100).toFixed(2),
              since: b.oldest_unpaid,
            }))}
          />
        </>
      )}

      <PaymentsExport />
    </section>
  )
}
