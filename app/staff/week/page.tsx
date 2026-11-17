import Link from 'next/link'
import { createClient, getStaff } from '@/lib/supabase/server'
import { one } from '@/lib/pg'
import { RollCall, type Row, type Session, type MemberOption } from '../roll-call'

export const dynamic = 'force-dynamic'

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Monday of the week containing d, matching date_trunc('week') in Postgres. */
function mondayOf(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((d.getDay() + 6) % 7))
  return m
}

function bandOf(dob: string | null, override: string | null): MemberOption['band'] {
  if (override) return override as MemberOption['band']
  if (!dob) return 'adult'
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.2425 * 864e5))
  return age < 13 ? 'kid' : age <= 16 ? 'teen' : 'adult'
}

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>
}) {
  const { w } = await searchParams
  const offset = Number.parseInt(w ?? '0', 10) || 0

  const staff = await getStaff()
  const supabase = await createClient()

  const monday = mondayOf(new Date())
  monday.setDate(monday.getDate() + offset * 7)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)

  const from = iso(monday)
  const to = iso(sunday)

  const [
    { data: sessionRows, error: sessErr },
    { data: rollRows, error: rollErr },
    { data: memberRows },
    { data: rateRows },
    { data: passRows },
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, session_date, starts, ends, class_types (name)')
      .gte('session_date', from)
      .lte('session_date', to)
      .neq('status', 'cancelled')
      .order('session_date')
      .order('starts'),
    supabase
      .from('roll_call')
      .select('*')
      .gte('session_date', from)
      .lte('session_date', to)
      .neq('booking_status', 'cancelled'),
    supabase
      .from('members')
      .select('id, first_name, last_name, date_of_birth, band_override')
      .eq('archived', false)
      .order('first_name'),
    supabase.from('session_rates').select('band, price_pence'),
    supabase.from('pass_products').select('kind, price_pence, eligible_bands').eq('active', true),
  ])

  const error = sessErr ?? rollErr

  const sessions: Session[] = (sessionRows ?? []).map((s) => ({
    id: s.id as string,
    session_date: s.session_date as string,
    starts: s.starts as string,
    ends: s.ends as string,
    class_name: one(s.class_types)?.name ?? 'Session',
  }))

  const rows = (rollRows ?? []) as Row[]

  const rates: Record<string, number> = {}
  for (const r of rateRows ?? []) rates[r.band as string] = r.price_pence as number

  const members: MemberOption[] = (memberRows ?? []).map((m) => ({
    id: m.id as string,
    first_name: m.first_name as string,
    last_name: (m.last_name as string) ?? null,
    band: bandOf(m.date_of_birth as string | null, m.band_override as string | null),
  }))

  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const weekRange = `${fmt(monday)} – ${fmt(sunday)}`

  const unpaid = rows.filter((r) => !r.paid).length
  const label = offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `Week of ${fmt(monday)}`

  return (
    <section className="pane on">
      <div className="pane-head">
        <h2 className="pane-title">{label}</h2>
        <p className="pane-sub">
          {weekRange}. Every session, so any coach can see what happened on a night they
          did not work.
        </p>
      </div>

      <div className="week-nav">
        <Link className="btn-out btn-out-light" href={`/staff/week?w=${offset - 1}`}>
          ← Previous
        </Link>
        {offset !== 0 && (
          <Link className="btn-out btn-out-light" href="/staff/week">
            This week
          </Link>
        )}
        <Link className="btn-out btn-out-light" href={`/staff/week?w=${offset + 1}`}>
          Next →
        </Link>
        <span className="week-tally">
          {rows.length} in &middot; <b>{unpaid}</b> unpaid
        </span>
      </div>

      {error && (
        <div className="locked">
          <h3>Could not load the week</h3>
          <p>{error.message}</p>
        </div>
      )}

      {!error && sessions.length === 0 && (
        <div className="locked">
          <h3>No sessions in this week</h3>
          <p>
            They may not have been generated from the weekly pattern yet. The Tonight tab has a
            button for that if you are an admin.
          </p>
        </div>
      )}

      {!error && sessions.length > 0 && (
        <RollCall
          groupByDate
          sessions={sessions}
          rows={rows}
          members={members}
          rates={rates}
          passes={(passRows ?? []) as { kind: string; price_pence: number | null; eligible_bands: string[] }[]}
          role={staff?.role ?? 'coach'}
          weekRange={weekRange}
          monthName={new Date().toLocaleDateString('en-GB', { month: 'long' })}
        />
      )}
    </section>
  )
}
