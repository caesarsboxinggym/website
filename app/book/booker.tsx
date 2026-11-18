'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { memberGroup, requestPlace, requestPlaceByNumber, validMemberNo } from './actions'
import { BASE } from '@/lib/base'
import { fitsSession, isKidOn, isKidsClass, todayIso, validDob } from '@/lib/age'

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
  /** By invitation: shown so people know it runs, but cannot be asked for. */
  invite_only?: boolean
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

/** Remembered on this device only, so a member types their number once. */
const NO_KEY = 'cb:member-no'

type Group = 'kid' | 'adult' | null | 'error' | undefined

export function Booker({ slots }: { slots: Slot[] }) {
  const [picked, setPicked] = useState<Slot | null>(null)
  const [done, setDone] = useState<Slot | null>(null)
  // Asked first, because it decides which classes they can ask for.
  const [dob, setDob] = useState('')
  const dobOk = validDob(dob)

  // Members can skip the form with their number instead.
  const [mode, setMode] = useState<'new' | 'member'>('new')
  const [no, setNo] = useState('')
  // undefined = not looked up yet, null = no such number
  const [group, setGroup] = useState<Group>(undefined)
  const latest = useRef('')

  function lookUp(value: string) {
    const v = value.replace(/\D/g, '').slice(0, 4)
    setNo(v)
    setGroup(undefined)
    latest.current = v
    if (!validMemberNo(v)) return
    memberGroup(v).then((res) => {
      if (latest.current !== v) return
      setGroup(res.ok ? res.group : 'error')
      if (res.ok && res.group) {
        try {
          localStorage.setItem(NO_KEY, v)
        } catch {}
      }
    })
  }

  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(NO_KEY)
    } catch {}
    if (saved && validMemberNo(saved)) {
      setMode('member')
      lookUp(saved)
    }
    // run once, on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const asMember = mode === 'member'
  const memberOk = asMember && (group === 'kid' || group === 'adult')

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
    const finish = () => {
      setDone(picked)
      setPicked(null)
    }
    return memberOk ? (
      <MemberConfirm slot={picked} memberNo={no} onBack={() => setPicked(null)} onDone={finish} />
    ) : (
      <RequestForm slot={picked} dob={dob} onBack={() => setPicked(null)} onDone={finish} />
    )
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
  const ready = asMember ? memberOk : dobOk
  const kid = asMember ? group === 'kid' : dobOk && isKidOn(dob, todayIso())
  const open = !ready
    ? []
    : asMember
      ? slots.filter((s) => isKidsClass(s.max_age) === kid)
      : slots.filter((s) => fitsSession(dob, s.session_date, s.max_age))

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
        <div className="pay-presets" role="group" aria-label="How to book">
          <button
            type="button"
            className={!asMember ? 'btn-out btn-out-on' : 'btn-out'}
            aria-pressed={!asMember}
            onClick={() => setMode('new')}
          >
            New here
          </button>
          <button
            type="button"
            className={asMember ? 'btn-out btn-out-on' : 'btn-out'}
            aria-pressed={asMember}
            onClick={() => setMode('member')}
          >
            I have a member number
          </button>
        </div>

        {asMember ? (
          <>
            <div className="field">
              <label htmlFor="bno">Member number</label>
              <input
                id="bno"
                className="book-no"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={no}
                onChange={(e) => lookUp(e.target.value)}
                placeholder="4 digits"
                autoComplete="off"
              />
            </div>
            <p className="field-hint">
              {no.length < 4
                ? 'It is in your welcome email. A coach can also tell you it.'
                : group === undefined
                  ? 'Checking…'
                  : group === 'error'
                    ? 'Could not check that number just now. Try again, or book as new.'
                    : group === null
                      ? 'That number is not on the system. Check it, or choose “New here”.'
                      : kid
                        ? 'Showing kids classes. Pick a session and that is it.'
                        : 'Showing your classes. Pick a session and that is it.'}
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {ready && days.length === 0 && (
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
              const f = s.invite_only
                ? { text: 'Invite only', tone: 'invite' as const }
                : fullness(s.places_left, s.capacity)
              const ages = ageNote(s.min_age, s.max_age)
              return (
                <button
                  key={s.id}
                  type="button"
                  className="book-slot"
                  disabled={s.places_left === 0 || s.invite_only}
                  onClick={() => setPicked(s)}
                >
                  <span className="book-time">{hhmm(s.starts)}</span>
                  <span className="book-body">
                    <span className="book-name">{s.class_name}</span>
                    <span className="book-meta">
                      {ages ? `${ages} · ` : ''}until {hhmm(s.ends)}
                      {s.invite_only ? ' · a coach will invite you' : ''}
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

/** A member asking with their number: nothing to fill in, just confirm. */
function MemberConfirm({
  slot,
  memberNo,
  onBack,
  onDone,
}: {
  slot: Slot
  memberNo: string
  onBack: () => void
  onDone: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <div className="reg-form">
      <div className="book-picked">
        <span className="book-picked-k">Member {memberNo} is asking for</span>
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

      {error && <p className="sheet-warn">{error}</p>}

      <button
        className="btn btn-solid reg-submit"
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null)
          start(async () => {
            const res = await requestPlaceByNumber(slot.id, memberNo)
            if (!res.ok) return setError(res.error)
            onDone()
          })
        }}
      >
        {pending ? 'Sending…' : 'Ask for a place'}
      </button>

      <p className="field-hint">
        This asks for a place; a coach confirms it. Nothing to pay now &mdash; pay on the night,
        cash or card.
      </p>
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
  const [privacy, setPrivacy] = useState(false)
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
          const res = await requestPlace({ session_id: slot.id, date_of_birth: dob, privacy_agreed: privacy, ...f })
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

      <label className="check">
        <input
          type="checkbox"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
          required
        />
        <span>
          I agree to Caesar&rsquo;s Boxing Gym keeping these details to arrange and run the
          session, as set out in the{' '}
          <a href={`${BASE}/privacy/`} target="_blank" rel="noreferrer">
            privacy notice
          </a>
          . They stay with the gym and are never sold or passed on. If the person training is
          under 18, a parent or guardian should tick this.
        </span>
      </label>

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
