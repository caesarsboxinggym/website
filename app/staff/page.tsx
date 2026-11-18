'use client'

import { createClient } from '@/lib/supabase/client'
import { useStaff } from '@/lib/staff'
import { useData } from '@/lib/use-data'
import { PaneLoading } from './pane-loading'
import { one } from '@/lib/pg'
import { RollCall, GenerateSessionsButton, type Row, type Session, type MemberOption } from './roll-call'

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/** Monday of the current week, matching date_trunc('week') in Postgres. */
function mondayOf(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((d.getDay() + 6) % 7))
  return m
}

async function load() {
  const supabase = createClient()
  const date = localDate()

  const [
    { data: sessionRows, error: sessErr },
    { data: rollRows, error: rollErr },
    { data: memberRows },
    { data: rateRows },
    { data: passRows },
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, session_date, starts, ends, status, class_types (name)')
      .eq('session_date', date)
      .neq('status', 'cancelled')
      .order('starts'),
    // cancelled bookings stay on record but drop off the roll call
    supabase
      .from('roll_call')
      .select('*')
      .eq('session_date', date)
      .neq('booking_status', 'cancelled')
      .order('starts'),
    supabase
      .from('members')
      .select('*')
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

  // Band for the member picker, mirroring member_band_on() in SQL.
  const bandOf = (dob: string | null, override: string | null): MemberOption['band'] => {
    if (override) return override as MemberOption['band']
    if (!dob) return 'adult'
    const age = Math.floor(
      (Date.now() - new Date(dob).getTime()) / (365.2425 * 24 * 60 * 60 * 1000)
    )
    return age < 13 ? 'kid' : age <= 16 ? 'teen' : 'adult'
  }

  const members: MemberOption[] = (memberRows ?? []).map((m) => ({
    id: m.id as string,
    member_no: (m.member_no as number) ?? null,
    first_name: m.first_name as string,
    last_name: (m.last_name as string) ?? null,
    band: bandOf(m.date_of_birth as string | null, m.band_override as string | null),
  }))

  const monday = mondayOf()
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const weekRange = `${fmt(monday)} – ${fmt(sunday)}`
  const monthName = new Date().toLocaleDateString('en-GB', { month: 'long' })

  const heading = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return { error, sessions, rows, members, rates, passRows, weekRange, monthName, heading }
}

export default function TonightPage() {
  const staff = useStaff()
  const { data } = useData(load)
  if (!data) return <PaneLoading />
  const { error, sessions, rows, members, rates, passRows, weekRange, monthName, heading } = data

  return (
    <section className="pane on">
      <div className="pane-head">
        <h2 className="pane-title">{heading}</h2>
        <p className="pane-sub">Tap a name to take a payment. Red owes, green is settled.</p>
      </div>

      {error && (
        <div className="locked">
          <h3>Could not load the roll call</h3>
          <p>{error.message}</p>
        </div>
      )}

      {!error && sessions.length === 0 && (
        <div className="locked">
          <h3>No sessions on today</h3>
          <p>
            The club trains Monday to Thursday. If today should have sessions, they have not been
            generated from the weekly pattern yet.
          </p>
          {staff?.role === 'admin' ? (
            <GenerateSessionsButton />
          ) : (
            <p>An admin needs to generate them.</p>
          )}
        </div>
      )}

      {!error && sessions.length > 0 && (
        <RollCall
          sessions={sessions}
          rows={rows}
          members={members}
          rates={rates}
          passes={(passRows ?? []) as { kind: string; price_pence: number | null; eligible_bands: string[] }[]}
          role={staff?.role ?? 'coach'}
          weekRange={weekRange}
          monthName={monthName}
        />
      )}
    </section>
  )
}
