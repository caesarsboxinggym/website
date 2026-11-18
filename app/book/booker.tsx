'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { requestPlace } from './actions'
import { fitsSession, isKidOn, todayIso, validDob } from '@/lib/age'

export type Slot = {
  id: string
  session_date: string
  starts: string
  ends: string
  class_name: string
  min_age: number | null
  max_age: number | null
  capacity: number
  places_left: number
}

const hhmm = (t: string) => t.slice(0, 5)

const dayHeading = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  return isToday ? `${label} — tonight` : label
}

function ageNote(min: number | null, max: number | null) {
  if (min && max) return `Ages ${min}–${max}`
  if (min) return `Ages ${min} and up`
  return null
}

/** How full, as words rather than a bare number. */
function fullness(left: number, capacity: number) {
  if (left === 0) return { text: 'Full', tone: 'full' as const }
  if (left <= 3) return { text: `Only ${left} left`, tone: 'low' as const }
  if (left <= capacity / 2) return { text: `${left} places left`, tone: 'mid' as const }
  return { text: `${left} places left`, tone: 'ok' as const }
}

export function Booker({ slots }: { slots: Slot[] }) {
  const [picked, setPicked] = useState<Slot | null>(null)
  const [done, setDone] = useState<Slot | null>(null)
  // Asked first, because it decides which classes they can ask for.
  const [dob, setDob] = useState('')
  const dobOk = validDob(dob)

  if (done) {
    return (
      <div className="reg-done">
        <h2 className="sect-title">Asked for, not booked yet</h2>
        <p className="lede">
          A coach will confirm your place for{' '}
          <b style={{ color: 'var(--limestone-2)' }}>
            {hhmm(done.starts)} {done.class_name}
          </b>{' '}
          on {dayHeading(done.session_date).replace(' — tonight', '')}. If the session fills up
          first, they will ring you.
        </p>
        <p className="lede" style={{ fontSize: '.875rem' }}>
          Pay on the night, cash or card. Nothing to pay now.
        </p>
        <div className="hero-cta">
          <button className="btn btn-solid" type="button" onClick={() => setDone(null)}>
            Book another session
          </button>
          <Link className="btn btn-ghost" href="/">
            Back to the website
          </Link>
        </div>
      </div>
    )
  }

  if (picked) {
    return <RequestForm slot={picked} dob={dob} onBack={() => setPicked(null)} onDone={() => { setDone(picked); setPicked(null) }} />
  }

  if (slots.length === 0) {
    return (
      <div className="note">
        <b>No sessions listed yet.</b> Give the gym a ring on 07568 402875 and a coach will sort you
        out.
      </div>
    )
  }

  // Kids (12 and under) see kids classes only; everyone else sees the rest.
  const open = dobOk ? slots.filter((s) => fitsSession(dob, s.session_date, s.max_age)) : []
  const kid = dobOk && isKidOn(dob, todayIso())

  // group by day
  const days: { date: string; slots: Slot[] }[] = []
  for (const s of open) {
    const last = days[days.length - 1]
    if (last && last.date === s.session_date) last.slots.push(s)
    else days.push({ date: s.session_date, slots: [s] })
  }

  return (
    <div className="book-days">
      <div className="book-who">
        <div className="field">
          <label htmlFor="bdob">Date of birth of the person training</label>
          <input
            id="bdob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={todayIso()}
            autoComplete="bday"
          />
        </div>
        <p className="field-hint">
          {!dob
            ? 'Start here. Kids (12 and under) and adults train in separate classes, so this decides which sessions you can ask for.'
            : !dobOk
              ? 'That does not look like a real date of birth.'
              : kid
                ? 'Showing kids classes, for ages 12 and under.'
                : 'Showing classes for ages 13 and over. Kids classes are for 12 and under.'}
        </p>
      </div>

      {dobOk && days.length === 0 && (
        <div className="note">
          <b>No {kid ? 'kids' : 'adult'} sessions in the next two weeks.</b> Give the gym a ring on
          07568 402875 and a coach will sort you out.
        </div>
      )}

      {days.map((d) => (
        <div key={d.date}>
          <p className="day-rule day-rule-dark">{dayHeading(d.date)}</p>
          <div className="book-list">
            {d.slots.map((s) => {
              const f = fullness(s.places_left, s.capacity)
              const ages = ageNote(s.min_age, s.max_age)
              return (
                <button
                  key={s.id}
                  type="button"
                  className="book-slot"
                  disabled={s.places_left === 0}
                  onClick={() => setPicked(s)}
                >
                  <span className="book-time">{hhmm(s.starts)}</span>
                  <span className="book-body">
                    <span className="book-name">{s.class_name}</span>
                    <span className="book-meta">
                      {ages ? `${ages} · ` : ''}until {hhmm(s.ends)}
                    </span>
                  </span>
                  <span className={`book-left book-left-${f.tone}`}>{f.text}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function RequestForm({
  slot,
  dob,
  onBack,
  onDone,
}: {
  slot: Slot
  dob: string
  onBack: () => void
  onDone: () => void
}) {
  const [f, setF] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    note: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((prev) => ({ ...prev, [k]: e.target.value }))

  return (
    <form
      className="reg-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const res = await requestPlace({ session_id: slot.id, date_of_birth: dob, ...f })
          if (!res.ok) return setError(res.error)
          onDone()
        })
      }}
    >
      <div className="book-picked">
        <span className="book-picked-k">You&rsquo;re asking for</span>
        <span className="book-picked-v">
          {hhmm(slot.starts)} {slot.class_name}
        </span>
        <span className="book-picked-m">
          {dayHeading(slot.session_date).replace(' — tonight', '')} &middot; {slot.places_left} of{' '}
          {slot.capacity} places left
        </span>
        <button className="btn-out" type="button" onClick={onBack}>
          Change
        </button>
      </div>

      <fieldset className="reg-set">
        <legend className="eyebrow">Details of the person training</legend>

        <div className="pair">
          <div className="field">
            <label htmlFor="bfn">First name</label>
            <input id="bfn" value={f.first_name} onChange={set('first_name')} autoComplete="given-name" required />
          </div>
          <div className="field">
            <label htmlFor="bln">Last name</label>
            <input id="bln" value={f.last_name} onChange={set('last_name')} autoComplete="family-name" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="bph">Phone</label>
          <input id="bph" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" required />
          <p className="field-hint">
            So a coach can confirm, or ring you if the session fills up first.
          </p>
        </div>

        <div className="field">
          <label htmlFor="bem">Email &mdash; optional</label>
          <input id="bem" type="email" value={f.email} onChange={set('email')} autoComplete="email" />
        </div>

        <div className="field">
          <label htmlFor="bnote">Anything to add &mdash; optional</label>
          <textarea id="bnote" rows={2} value={f.note} onChange={set('note')} />
        </div>
      </fieldset>

      {error && <p className="sheet-warn">{error}</p>}

      <button className="btn btn-solid reg-submit" type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Ask for a place'}
      </button>

      <p className="field-hint">
        This asks for a place; a coach confirms it. Nothing to pay now &mdash; pay on the night,
        cash or card.
      </p>
    </form>
  )
}
