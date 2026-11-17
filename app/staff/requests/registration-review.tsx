'use client'

import { useState, useTransition } from 'react'
import { acceptRegistration, rejectRegistration } from './actions'

export type Submission = {
  id: string
  first_name: string
  last_name: string | null
  date_of_birth: string | null
  phone: string | null
  email: string | null
  address: string | null
  health_notes: string | null
  next_of_kin_name: string | null
  next_of_kin_phone: string | null
  next_of_kin_relationship: string | null
  guardian_name: string | null
  guardian_phone: string | null
  guardian_relationship: string | null
  consent_given: boolean
  media_consent: boolean
  submitted_at: string
}

function ageOn(dob: string | null) {
  if (!dob) return null
  const d = new Date(dob + 'T00:00:00')
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const before =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  if (before) age -= 1
  return age
}

function bandOf(age: number | null) {
  if (age === null) return { label: 'Age unknown', rate: null }
  if (age < 13) return { label: `Kid · ${age}`, rate: '£3' }
  if (age <= 16) return { label: `Teenager · ${age}`, rate: '£5' }
  return { label: `Adult · ${age}`, rate: '£5' }
}

function Detail({ k, v }: { k: string; v: string | null }) {
  if (!v) return null
  return (
    <div className="det">
      <span className="det-k">{k}</span>
      <span className="det-v">{v}</span>
    </div>
  )
}

export function ReviewList({ submissions }: { submissions: Submission[] }) {
  const [toast, setToast] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4500)
  }

  return (
    <>
      {submissions.map((s) => (
        <SubmissionCard key={s.id} s={s} onDone={flash} />
      ))}

      <div className={toast ? 'toast show' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  )
}

function SubmissionCard({
  s,
  onDone,
}: {
  s: Submission
  onDone: (msg: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [pending, start] = useTransition()

  const age = ageOn(s.date_of_birth)
  const band = bandOf(age)
  const minor = age !== null && age < 18
  const blocked = minor && (!s.guardian_name || !s.consent_given)

  const name = `${s.first_name} ${s.last_name ?? ''}`.trim()

  return (
    <div className="sess">
      <div className="sess-head">
        <span className="sess-name">{name}</span>
        <span className="chip">{band.label}</span>
        {band.rate && <span className="chip">{band.rate} a session</span>}
        <span className="sess-coach" style={{ marginLeft: 'auto' }}>
          {new Date(s.submitted_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      </div>

      <div className="det-grid">
        <Detail k="Date of birth" v={s.date_of_birth} />
        <Detail k="Phone" v={s.phone} />
        <Detail k="Email" v={s.email ?? 'None given — chase in person'} />
        <Detail k="Address" v={s.address} />
        <Detail
          k="Next of kin"
          v={
            s.next_of_kin_name
              ? [s.next_of_kin_name, s.next_of_kin_relationship, s.next_of_kin_phone]
                  .filter(Boolean)
                  .join(' · ')
              : null
          }
        />
        <Detail k="Health notes" v={s.health_notes} />
        {minor && (
          <Detail
            k="Parent or guardian"
            v={
              s.guardian_name
                ? [s.guardian_name, s.guardian_relationship, s.guardian_phone]
                    .filter(Boolean)
                    .join(' · ')
                : null
            }
          />
        )}
        <Detail k="Photos" v={s.media_consent ? 'Happy to appear' : 'Prefers not to appear'} />
      </div>

      {minor && (
        <div className="det-flags">
          <span className={s.consent_given ? 'pill pill-paid' : 'pill pill-unpaid'}>
            {s.consent_given ? 'Guardian consent given' : 'No guardian consent'}
          </span>
          <span className={s.guardian_name ? 'pill pill-paid' : 'pill pill-unpaid'}>
            {s.guardian_name ? 'Guardian named' : 'No guardian named'}
          </span>
        </div>
      )}

      {blocked && (
        <p className="sheet-warn" style={{ margin: '0 14px 14px' }}>
          Under 18 with no guardian name or consent, so this cannot be accepted. Ring them, get the
          guardian details, then add {s.first_name} by hand from the Tonight tab.
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
              onClick={() => setConfirmReject(true)}
              style={{ minHeight: 40 }}
            >
              Reject
            </button>
            <button
              className="btn-record"
              type="button"
              disabled={pending || blocked}
              style={{ minHeight: 40, paddingInline: 18, marginLeft: 'auto' }}
              onClick={() => {
                setError(null)
                start(async () => {
                  const res = await acceptRegistration(s.id)
                  if (!res.ok) return setError(res.error)
                  onDone(`${name} added to the members list.`)
                })
              }}
            >
              {pending ? 'Adding…' : 'Accept & add member'}
            </button>
          </>
        )}

        {confirmReject && (
          <>
            <span style={{ fontSize: '.75rem' }}>Reject this registration?</span>
            <button
              className="btn-out btn-out-light"
              type="button"
              disabled={pending}
              onClick={() => setConfirmReject(false)}
              style={{ marginLeft: 'auto' }}
            >
              Keep it
            </button>
            <button
              className="btn-danger"
              type="button"
              disabled={pending}
              style={{ minHeight: 40, background: 'var(--oxide)', color: '#fff', borderColor: 'var(--oxide)' }}
              onClick={() => {
                setError(null)
                start(async () => {
                  const res = await rejectRegistration(s.id)
                  if (!res.ok) return setError(res.error)
                  onDone(`${name}'s registration rejected.`)
                })
              }}
            >
              {pending ? 'Rejecting…' : 'Reject'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
