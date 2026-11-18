'use client'

import { useMemo, useState, useTransition } from 'react'
import { acceptBookingRequest, rejectBookingRequest } from './actions'
import { ageOn } from '@/lib/age'

/** Stands in for a member id when the person is not on the system yet. */
const NEW = 'new'

export type BookingRequest = {
  id: string
  session_id: string
  /** Set when they asked with their member number, so there is no guessing who it is. */
  member_id: string | null
  first_name: string
  last_name: string | null
  phone: string
  email: string | null
  date_of_birth: string | null
  note: string | null
  requested_at: string
  session_date: string
  starts: string
  class_name: string
  places_left: number
  capacity: number
}

export type MemberOption = {
  id: string
  member_no: number | null
  first_name: string
  last_name: string | null
  phone: string | null
  band: 'kid' | 'teen' | 'adult'
}

const hhmm = (t: string) => t.slice(0, 5)
const digits = (s: string) => s.replace(/\D/g, '')

const dayLabel = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

export function BookingRequestList({
  requests,
  members,
}: {
  requests: BookingRequest[]
  members: MemberOption[]
}) {
  const [toast, setToast] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4500)
  }

  return (
    <>
      {requests.map((r) => (
        <BookingCard key={r.id} r={r} members={members} onDone={flash} />
      ))}
      <div className={toast ? 'toast show' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  )
}

function BookingCard({
  r,
  members,
  onDone,
}: {
  r: BookingRequest
  members: MemberOption[]
  onDone: (msg: string) => void
}) {
  const name = `${r.first_name} ${r.last_name ?? ''}`.trim()

  // Match on phone first — it is the one field we insist on — then on name.
  const suggested = useMemo(() => {
    const known = r.member_id ? members.filter((m) => m.id === r.member_id) : []
    if (known.length) return known
    const p = digits(r.phone)
    const byPhone = members.filter((m) => m.phone && digits(m.phone) === p)
    if (byPhone.length) return byPhone
    const first = r.first_name.trim().toLowerCase()
    const last = (r.last_name ?? '').trim().toLowerCase()
    return members.filter(
      (m) =>
        m.first_name.toLowerCase() === first &&
        (!last || (m.last_name ?? '').toLowerCase() === last)
    )
  }, [members, r])

  // A new member needs a date of birth: it decides their rate and age group.
  const canCreate = Boolean(r.date_of_birth)

  // One clear match is picked for the coach. No match at all means they are
  // almost certainly new, so that is picked instead.
  const [chosen, setChosen] = useState<string | null>(
    suggested.length === 1 ? suggested[0].id : suggested.length === 0 && canCreate ? NEW : null
  )
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [pending, start] = useTransition()

  const q = query.trim().toLowerCase()
  const matches = q
    ? members.filter(
        (m) =>
          `${m.first_name} ${m.last_name ?? ''}`.toLowerCase().includes(q) ||
          (/^\d{4}$/.test(q) && String(m.member_no ?? '') === q)
      )
    : suggested

  const full = r.places_left <= 0

  return (
    <div className="sess">
      <div className="sess-head">
        <span className="sess-time">{hhmm(r.starts)}</span>
        <span className="sess-name">{r.class_name}</span>
        <span className="chip">{dayLabel(r.session_date)}</span>
        <span className={full ? 'pill pill-unpaid' : 'chip'} style={{ marginLeft: 'auto' }}>
          {full ? 'Session full' : `${r.places_left} of ${r.capacity} left`}
        </span>
      </div>

      <div className="det-grid">
        <div className="det">
          <span className="det-k">Asked for by</span>
          <span className="det-v">{name}</span>
        </div>
        <div className="det">
          <span className="det-k">Phone</span>
          <span className="det-v">
            <a href={`tel:${digits(r.phone)}`} style={{ color: 'inherit' }}>
              {r.phone}
            </a>
          </span>
        </div>
        {r.email && (
          <div className="det">
            <span className="det-k">Email</span>
            <span className="det-v">{r.email}</span>
          </div>
        )}
        {r.date_of_birth && (
          <div className="det">
            <span className="det-k">Date of birth</span>
            <span className="det-v">
              {new Date(r.date_of_birth + 'T00:00:00').toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}{' '}
              &middot; age {ageOn(r.date_of_birth, r.session_date)} on the night &middot;{' '}
              {ageOn(r.date_of_birth, r.session_date) < 13 ? 'kid' : '13 or over'}
            </span>
          </div>
        )}
        {r.note && (
          <div className="det">
            <span className="det-k">Note</span>
            <span className="det-v">{r.note}</span>
          </div>
        )}
      </div>

      <div className="match">
        <span className="sheet-label">Who is this on the system?</span>

        {suggested.length === 1 && chosen === suggested[0].id && (
          <p className="field-hint" style={{ color: 'var(--patina-ink)' }}>
            Matched to {suggested[0].first_name} {suggested[0].last_name ?? ''} on{' '}
            {suggested[0].phone && digits(suggested[0].phone) === digits(r.phone)
              ? 'phone number'
              : 'name'}
            .
          </p>
        )}

        <input
          className="match-search"
          type="search"
          placeholder="Search members by name or number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="pick-list">
          {matches.length === 0 && (
            <p className="field-hint">
              {q
                ? 'Nobody matches that search.'
                : canCreate
                  ? 'Nobody on the system matches this name or phone number.'
                  : 'Nobody matches, and this request has no date of birth, so they cannot be added from here. Add them on the Members tab first.'}
            </p>
          )}
          {matches.slice(0, 6).map((m) => (
            <button
              key={m.id}
              type="button"
              className={chosen === m.id ? 'opt opt-chosen' : 'opt'}
              onClick={() => setChosen(m.id)}
            >
              <span className="opt-body">
                <span className="opt-name">
                  {m.first_name} {m.last_name ?? ''}
                </span>
                <span className="opt-note">
                  {m.member_no ? `No. ${m.member_no} · ` : ''}
                  {m.band === 'kid' ? 'Kid' : m.band === 'teen' ? 'Teenager' : 'Adult'}
                  {m.phone ? ` · ${m.phone}` : ''}
                </span>
              </span>
              <span className="opt-fig">{chosen === m.id ? 'Selected' : 'Pick'}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className={chosen === NEW ? 'opt opt-chosen' : 'opt'}
              onClick={() => setChosen(NEW)}
            >
              <span className="opt-body">
                <span className="opt-name">Not on the system yet</span>
                <span className="opt-note">Add {name} as a new member from these details</span>
              </span>
              <span className="opt-fig">{chosen === NEW ? 'Selected' : 'Pick'}</span>
            </button>
          )}
        </div>
      </div>

      {full && (
        <p className="sheet-warn" style={{ margin: '0 14px 14px' }}>
          This session is full. Accepting is blocked — ring {r.first_name} on {r.phone} and offer
          another night.
        </p>
      )}

      {error && (
        <p className="sheet-warn" style={{ margin: '0 14px 14px' }}>
          {error}
        </p>
      )}

      <div className="sess-foot">
        {!confirmReject && (
          <>
            <button
              className="btn-danger"
              type="button"
              disabled={pending}
              style={{ minHeight: 40 }}
              onClick={() => setConfirmReject(true)}
            >
              Turn down
            </button>
            <button
              className="btn-record"
              type="button"
              disabled={pending || full || !chosen}
              style={{ minHeight: 40, paddingInline: 18, marginLeft: 'auto' }}
              onClick={() => {
                setError(null)
                start(async () => {
                  const res = await acceptBookingRequest(r.id, chosen === NEW ? null : chosen!)
                  if (!res.ok) return setError(res.error)
                  onDone(
                    chosen === NEW
                      ? `${name} added as a member and booked into ${hhmm(r.starts)} ${r.class_name}.`
                      : `${name} booked into ${hhmm(r.starts)} ${r.class_name}.`
                  )
                })
              }}
            >
              {pending
                ? 'Booking…'
                : chosen === NEW
                  ? 'Add member & book in'
                  : chosen
                    ? 'Approve & book in'
                    : 'Pick a member first'}
            </button>
          </>
        )}

        {confirmReject && (
          <>
            <span style={{ fontSize: '.75rem' }}>Turn down this request?</span>
            <button
              className="btn-out btn-out-light"
              type="button"
              disabled={pending}
              style={{ marginLeft: 'auto' }}
              onClick={() => setConfirmReject(false)}
            >
              Keep it
            </button>
            <button
              className="btn-danger"
              type="button"
              disabled={pending}
              style={{
                minHeight: 40,
                background: 'var(--oxide)',
                color: '#fff',
                borderColor: 'var(--oxide)',
              }}
              onClick={() => {
                setError(null)
                start(async () => {
                  const res = await rejectBookingRequest(r.id)
                  if (!res.ok) return setError(res.error)
                  onDone(`${name}'s request turned down.`)
                })
              }}
            >
              {pending ? 'Turning down…' : 'Turn down'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
