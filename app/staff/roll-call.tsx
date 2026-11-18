'use client'

import { useState, useTransition } from 'react'
import {
  bookMember,
  createMemberAndBook,
  takePayment,
  generateSessions,
  setBookingStatus,
} from './actions'

export type Row = {
  booking_id: string
  session_id: string
  session_date: string
  starts: string
  ends: string
  class_name: string
  member_id: string
  first_name: string
  last_name: string | null
  band: 'kid' | 'teen' | 'adult'
  has_email: boolean
  consent_on_file: boolean
  booking_status: string
  paid: boolean
}

export type Session = {
  id: string
  session_date: string
  starts: string
  ends: string
  class_name: string
}

export type MemberOption = {
  id: string
  member_no?: number | null
  first_name: string
  last_name: string | null
  band: 'kid' | 'teen' | 'adult'
}

const BAND_LABEL = {
  kid: 'Kid · 6–12',
  teen: 'Teenager · 13–16',
  adult: 'Adult',
} as const

const BAND_SHORT = { kid: 'Kid', teen: 'Teenager', adult: 'Adult' } as const

const hhmm = (t: string) => t.slice(0, 5)
const money = (pence: number) => `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)}`

const dayHeading = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

export function RollCall({
  sessions,
  rows,
  members,
  rates,
  passes,
  role,
  weekRange,
  monthName,
  groupByDate = false,
}: {
  sessions: Session[]
  rows: Row[]
  members: MemberOption[]
  rates: Record<string, number>
  passes: { kind: string; price_pence: number | null; eligible_bands: string[] }[]
  role: string
  weekRange: string
  monthName: string
  /** Week view spans several days, so each day gets a heading. */
  groupByDate?: boolean
}) {
  const [pay, setPay] = useState<Row | null>(null)
  const [adding, setAdding] = useState<Session | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4500)
  }

  const todayIso = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`
  })()

  let lastDate: string | null = null

  return (
    <>
      {sessions.map((s) => {
        const newDay = groupByDate && s.session_date !== lastDate
        if (newDay) lastDate = s.session_date
        const mine = rows.filter((r) => r.session_id === s.id)
        const owing = mine.filter((r) => !r.paid)
        const takenPence = mine
          .filter((r) => r.paid)
          .reduce((sum, r) => sum + (rates[r.band] ?? 0), 0)

        return (
          <div key={s.id}>
            {newDay && (
              <p className={s.session_date === todayIso ? 'day-rule day-rule-now' : 'day-rule'}>
                {dayHeading(s.session_date)}
                {s.session_date === todayIso && <span>tonight</span>}
              </p>
            )}
            <div className="sess">
              <div className="sess-head">
                <span className="sess-time">{hhmm(s.starts)}</span>
                <span className="sess-name">{s.class_name}</span>
                <span className="sess-coach">until {hhmm(s.ends)}</span>
              </div>

            <div className="rows">
              {mine.length === 0 && (
                <div className="row" style={{ borderLeftColor: 'var(--hairline)' }}>
                  <span className="row-body">
                    <span className="row-name" style={{ color: '#7A6A59', fontWeight: 400 }}>
                      Nobody in yet
                    </span>
                  </span>
                </div>
              )}

              {mine.map((r) => (
                <button
                  className={r.paid ? 'row paid' : 'row'}
                  key={r.booking_id}
                  type="button"
                  onClick={() => setPay(r)}
                >
                  <span className="row-body">
                    <span className="row-name">
                      {r.first_name} {r.last_name ?? ''}
                    </span>
                    <span className="row-meta">
                      {r.band !== 'adult' && (
                        <span className="chip chip-junior">{BAND_LABEL[r.band]}</span>
                      )}
                      {!r.has_email && <span className="chip">No email</span>}
                      {r.band !== 'adult' && !r.consent_on_file && (
                        <span className="chip" style={{ color: 'var(--oxide-ink)' }}>
                          No consent on file
                        </span>
                      )}
                      {role === 'admin' && !r.paid && (
                        <span className="chip">owes {money(rates[r.band] ?? 0)}</span>
                      )}
                    </span>
                  </span>
                  <span className={r.paid ? 'pill pill-paid' : 'pill pill-unpaid'}>
                    {r.paid ? 'Paid' : 'Owes'}
                  </span>
                  <span className="row-caret" aria-hidden="true">
                    <svg width={8} height={13} viewBox="0 0 8 13" fill="none">
                      <path d="M1 1l6 5.5L1 12" stroke="currentColor" strokeWidth={1.6} />
                    </svg>
                  </span>
                </button>
              ))}
            </div>

            <div className="sess-foot">
              <span>
                <b>{mine.length}</b> in &middot; <b>{owing.length}</b> still to pay
                {role === 'admin' && (
                  <>
                    {' '}
                    &middot; taken <b>{money(takenPence)}</b>
                  </>
                )}
              </span>
              <button
                type="button"
                className="btn-add"
                onClick={() => setAdding(s)}
              >
                + Add someone
              </button>
            </div>
            </div>
          </div>
        )
      })}

      {pay && (
        <PaymentSheet
          row={pay}
          rates={rates}
          passes={passes}
          weekRange={weekRange}
          monthName={monthName}
          isAdmin={role === 'admin'}
          today={todayIso}
          onClose={() => setPay(null)}
          onDone={(msg) => {
            setPay(null)
            flash(msg)
          }}
        />
      )}

      {adding && (
        <AddSheet
          session={adding}
          members={members}
          bookedIds={rows.filter((r) => r.session_id === adding.id).map((r) => r.member_id)}
          onClose={() => setAdding(null)}
          onDone={(msg) => {
            setAdding(null)
            flash(msg)
          }}
        />
      )}

      <div className={toast ? 'toast show' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

function PaymentSheet({
  row,
  rates,
  passes,
  weekRange,
  monthName,
  isAdmin,
  today,
  onClose,
  onDone,
}: {
  row: Row
  rates: Record<string, number>
  passes: { kind: string; price_pence: number | null; eligible_bands: string[] }[]
  weekRange: string
  monthName: string
  isAdmin: boolean
  today: string
  onClose: () => void
  onDone: (msg: string) => void
}) {
  // Typing up a past session: assume the money was taken that day.
  const [takenOn, setTakenOn] = useState(row.session_date < today ? row.session_date : today)
  const [kind, setKind] = useState<'single' | 'week' | 'month'>('single')
  const [method, setMethod] = useState<'cash' | 'card'>('cash')
  const [ref, setRef] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [pending, start] = useTransition()

  const singlePrice = rates[row.band] ?? 0
  const week = passes.find((p) => p.kind === 'week')
  const month = passes.find((p) => p.kind === 'month')
  const weekAllowed = week?.eligible_bands.includes(row.band) ?? false
  const monthAllowed = month?.eligible_bands.includes(row.band) ?? false

  function submit() {
    setError(null)
    start(async () => {
      const res = await takePayment(
        row.member_id,
        kind,
        method,
        row.booking_id,
        method === 'card' ? ref : undefined,
        isAdmin && takenOn && takenOn !== today ? takenOn : undefined
      )
      if (!res.ok) {
        setError(res.error)
        return
      }
      const amount =
        kind === 'single' ? singlePrice : kind === 'week' ? week!.price_pence! : month!.price_pence!
      onDone(
        kind === 'single'
          ? `${money(amount)} ${method} recorded for ${row.first_name} — this class only.`
          : `${money(amount)} ${method} recorded for ${row.first_name} — ${kind} pass, earlier nights included.`
      )
    })
  }

  return (
    <div className="scrim open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Take payment from ${row.first_name}`}>
        <div className="sheet-head">
          <div>
            <h3>
              {row.first_name} {row.last_name ?? ''}
            </h3>
            <p className="sheet-sub">
              {hhmm(row.starts)} {row.class_name}
            </p>
          </div>
          <button className="btn-x" type="button" onClick={onClose} aria-label="Close">
            <svg width={13} height={13} viewBox="0 0 13 13" aria-hidden="true">
              <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth={1.6} fill="none" />
            </svg>
          </button>
        </div>

        {row.paid && (
          <p className="sheet-note">
            This one is already settled. Recording another payment adds a second one.
          </p>
        )}

        <div className="sheet-group">
          <span className="sheet-label">What is this paying for?</span>

          <label className="opt">
            <input
              type="radio"
              name="kind"
              checked={kind === 'single'}
              onChange={() => setKind('single')}
            />
            <span className="opt-body">
              <span className="opt-name">This session</span>
              <span className="opt-note">{BAND_SHORT[row.band]} rate · this class only</span>
            </span>
            <span className="opt-fig">{money(singlePrice)}</span>
          </label>

          <label className="opt" style={weekAllowed ? undefined : { opacity: 0.5 }}>
            <input
              type="radio"
              name="kind"
              checked={kind === 'week'}
              disabled={!weekAllowed}
              onChange={() => setKind('week')}
            />
            <span className="opt-body">
              <span className="opt-name">Week pass</span>
              <span className="opt-note">{weekRange}, all sessions</span>
            </span>
            <span className="opt-fig">{money(week?.price_pence ?? 1000)}</span>
          </label>

          <label className="opt" style={monthAllowed ? undefined : { opacity: 0.5 }}>
            <input
              type="radio"
              name="kind"
              checked={kind === 'month'}
              disabled={!monthAllowed}
              onChange={() => setKind('month')}
            />
            <span className="opt-body">
              <span className="opt-name">Month pass</span>
              <span className="opt-note">{monthName}, all sessions</span>
            </span>
            <span className="opt-fig">{money(month?.price_pence ?? 4000)}</span>
          </label>

          {row.band === 'kid' && (
            <p className="sheet-warn">
              Kids are {money(singlePrice)} a session and train twice a week, so a £10 week pass
              would cost more. The timetable lists the week pass under teenagers and adults only.
            </p>
          )}
        </div>

        <div className="sheet-group">
          <span className="sheet-label">How did they pay?</span>
          <div className="pair">
            <label className="opt">
              <input
                type="radio"
                name="method"
                checked={method === 'cash'}
                onChange={() => setMethod('cash')}
              />
              <span className="opt-body">
                <span className="opt-name">Cash</span>
              </span>
            </label>
            <label className="opt">
              <input
                type="radio"
                name="method"
                checked={method === 'card'}
                onChange={() => setMethod('card')}
              />
              <span className="opt-body">
                <span className="opt-name">Card</span>
              </span>
            </label>
          </div>
        </div>

        {method === 'card' && (
          <div className="field field-light">
            <label htmlFor="ref">SumUp reference (optional)</label>
            <input
              id="ref"
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Last 4 digits or receipt no."
            />
          </div>
        )}

        {isAdmin && (
          <div className="field field-light">
            <label htmlFor="taken-on">Date taken</label>
            <input
              id="taken-on"
              type="date"
              value={takenOn}
              max={today}
              onChange={(e) => setTakenOn(e.target.value)}
            />
            {takenOn !== today && (
              <p className="sheet-note" style={{ marginTop: 6 }}>
                This payment will be recorded as taken on{' '}
                {new Date(takenOn + 'T12:00:00').toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                , not today.
              </p>
            )}
          </div>
        )}

        <p className="sheet-note">
          Card payments are taken on the SumUp reader first, then recorded here. The two are not
          linked — check the card total against SumUp at the end of the week.
        </p>

        {error && <p className="sheet-warn">{error}</p>}

        <button className="btn-record" type="button" onClick={submit} disabled={pending}>
          {pending ? 'Recording…' : 'Record payment'}
        </button>

        <div className="sheet-danger">
          {!confirmRemove && (
            <button
              className="btn-danger"
              type="button"
              onClick={() => setConfirmRemove(true)}
              disabled={pending}
            >
              Remove from this session
            </button>
          )}

          {confirmRemove && (
            <>
              <p className="sheet-warn">
                {row.paid
                  ? `Take ${row.first_name} out of this session? They have already paid for it — the payment stays on record, so check whether they are owed it back or should be moved to another night.`
                  : `Take ${row.first_name} out of this session?`}
              </p>
              <div className="pair">
                <button
                  className="btn-ghost-light"
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  disabled={pending}
                >
                  Keep them in
                </button>
                <button
                  className="btn-danger"
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError(null)
                    start(async () => {
                      const res = await setBookingStatus(row.booking_id, 'cancelled')
                      if (!res.ok) {
                        setError(res.error)
                        return
                      }
                      onDone(`${row.first_name} removed from ${hhmm(row.starts)} ${row.class_name}.`)
                    })
                  }}
                >
                  {pending ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function AddSheet({
  session,
  members,
  bookedIds,
  onClose,
  onDone,
}: {
  session: Session
  members: MemberOption[]
  bookedIds: string[]
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const available = members.filter((m) => !bookedIds.includes(m.id))
  const q = query.trim().toLowerCase()
  const matches = q
    ? available.filter(
        (m) =>
          `${m.first_name} ${m.last_name ?? ''}`.toLowerCase().includes(q) ||
          (/^\d{4}$/.test(q) && String(m.member_no ?? '') === q)
      )
    : available

  function add(memberId: string, name: string) {
    setError(null)
    start(async () => {
      const res = await bookMember(session.id, memberId)
      if (!res.ok) return setError(res.error)
      onDone(`${name} added to ${hhmm(session.starts)} ${session.class_name}.`)
    })
  }

  function create() {
    setError(null)
    start(async () => {
      const res = await createMemberAndBook(session.id, {
        first_name: first,
        last_name: last,
        phone,
        date_of_birth: dob,
      })
      if (!res.ok) return setError(res.error)
      onDone(`${first} added to ${hhmm(session.starts)} ${session.class_name}.`)
    })
  }

  return (
    <div className="scrim open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Add someone to this session">
        <div className="sheet-head">
          <div>
            <h3>Add someone</h3>
            <p className="sheet-sub">
              {hhmm(session.starts)} {session.class_name}
            </p>
          </div>
          <button className="btn-x" type="button" onClick={onClose} aria-label="Close">
            <svg width={13} height={13} viewBox="0 0 13 13" aria-hidden="true">
              <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth={1.6} fill="none" />
            </svg>
          </button>
        </div>

        {!creating && (
          <>
            <div className="field field-light">
              <label htmlFor="q">Search members</label>
              <input
                id="q"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or member number"
                autoComplete="off"
              />
            </div>

            <div className="pick-list">
              {matches.length === 0 && (
                <p className="sheet-note">
                  {members.length === 0
                    ? 'No members on the system yet. Add the first one below.'
                    : 'Nobody matches, or everyone matching is already in this session.'}
                </p>
              )}
              {matches.slice(0, 8).map((m) => (
                <button
                  key={m.id}
                  className="opt"
                  type="button"
                  disabled={pending}
                  onClick={() => add(m.id, m.first_name)}
                >
                  <span className="opt-body">
                    <span className="opt-name">
                      {m.first_name} {m.last_name ?? ''}
                    </span>
                    <span className="opt-note">
                      {m.member_no ? `No. ${m.member_no} · ` : ''}
                      {BAND_LABEL[m.band]}
                    </span>
                  </span>
                  <span className="opt-fig">Add</span>
                </button>
              ))}
            </div>

            {error && <p className="sheet-warn">{error}</p>}

            <button className="btn-record" type="button" onClick={() => setCreating(true)}>
              New member
            </button>
          </>
        )}

        {creating && (
          <>
            <div className="pair">
              <div className="field field-light">
                <label htmlFor="fn">First name</label>
                <input id="fn" value={first} onChange={(e) => setFirst(e.target.value)} />
              </div>
              <div className="field field-light">
                <label htmlFor="ln">Last name</label>
                <input id="ln" value={last} onChange={(e) => setLast(e.target.value)} />
              </div>
            </div>

            <div className="field field-light">
              <label htmlFor="dob">Date of birth</label>
              <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>

            <div className="field field-light">
              <label htmlFor="ph">Phone (optional)</label>
              <input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <p className="sheet-note">
              Date of birth decides the rate, so it is not optional. Next of kin, guardian consent
              and the rest come from the full registration form.
            </p>

            {error && <p className="sheet-warn">{error}</p>}

            <div className="pair">
              <button className="btn-ghost-light" type="button" onClick={() => setCreating(false)}>
                Back
              </button>
              <button className="btn-record" type="button" onClick={create} disabled={pending}>
                {pending ? 'Adding…' : 'Add & book in'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function GenerateSessionsButton() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <button
        className="btn-record"
        type="button"
        disabled={pending}
        style={{ alignSelf: 'flex-start', paddingInline: 20 }}
        onClick={() =>
          start(async () => {
            const res = await generateSessions(8)
            if (!res.ok) setError(res.error)
          })
        }
      >
        {pending ? 'Generating…' : 'Generate the next 8 weeks'}
      </button>
      {error && <p className="sheet-warn">{error}</p>}
    </>
  )
}
