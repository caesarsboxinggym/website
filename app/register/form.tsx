'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { submitRegistration } from './actions'

/** Under 18 on today's date, mirroring accept_registration() in SQL. */
function isMinor(dob: string) {
  if (!dob) return false
  const d = new Date(dob + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return false
  const eighteen = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate())
  return eighteen > new Date()
}

function bandLabel(dob: string) {
  if (!dob) return null
  const d = new Date(dob + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const before =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  if (before) age -= 1
  if (age < 0 || age > 120) return null
  if (age < 6) return { text: `Age ${age} — under six, please have a word with a coach first`, warn: true }
  if (age < 13) return { text: `Age ${age} · Kids Boxing · £3 a session`, warn: false }
  if (age <= 16) return { text: `Age ${age} · Teenagers · £5 a session`, warn: false }
  return { text: `Age ${age} · Adult · £5 a session`, warn: false }
}

export function RegisterForm() {
  const [f, setF] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    phone: '',
    email: '',
    address: '',
    health_notes: '',
    next_of_kin_name: '',
    next_of_kin_phone: '',
    next_of_kin_relationship: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_relationship: '',
  })
  const [consent, setConsent] = useState(false)
  const [media, setMedia] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }))

  const minor = useMemo(() => isMinor(f.date_of_birth), [f.date_of_birth])
  const band = useMemo(() => bandLabel(f.date_of_birth), [f.date_of_birth])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await submitRegistration({
        ...f,
        consent_given: consent,
        media_consent: media,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  if (done) {
    return (
      <div className="reg-done">
        <h2 className="sect-title">Thanks, that&rsquo;s in</h2>
        <p className="lede">
          A coach will check it over and add {f.first_name || 'you'} to the system. Nothing else to
          do &mdash; just turn up to a session and pay on the night.
        </p>
        <div className="hero-cta">
          <Link className="btn btn-solid" href="/#classes">
            See the timetable
          </Link>
          <Link className="btn btn-ghost" href="/">
            Back to the website
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form className="reg-form" onSubmit={onSubmit} noValidate>
      <fieldset className="reg-set">
        <legend className="eyebrow">Who&rsquo;s training</legend>

        <div className="pair">
          <div className="field">
            <label htmlFor="fn">First name</label>
            <input id="fn" value={f.first_name} onChange={set('first_name')} autoComplete="given-name" required />
          </div>
          <div className="field">
            <label htmlFor="ln">Last name</label>
            <input id="ln" value={f.last_name} onChange={set('last_name')} autoComplete="family-name" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="dob">Date of birth</label>
          <input
            id="dob"
            type="date"
            value={f.date_of_birth}
            onChange={set('date_of_birth')}
            max={new Date().toISOString().slice(0, 10)}
            required
          />
          {band ? (
            <p className={band.warn ? 'field-warn' : 'field-hint'}>{band.text}</p>
          ) : (
            <p className="field-hint">This sets which class and which rate applies.</p>
          )}
        </div>
      </fieldset>

      <fieldset className="reg-set">
        <legend className="eyebrow">How we reach you</legend>

        <div className="field">
          <label htmlFor="ph">Phone</label>
          <input id="ph" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />
        </div>

        <div className="field">
          <label htmlFor="em">Email &mdash; optional</label>
          <input id="em" type="email" value={f.email} onChange={set('email')} autoComplete="email" />
          <p className="field-hint">
            Leave it blank if you&rsquo;d rather not. It only gets used to send a payment link if
            you can&rsquo;t get in to settle up.
          </p>
        </div>

        <div className="field">
          <label htmlFor="ad">Address</label>
          <textarea id="ad" rows={2} value={f.address} onChange={set('address')} autoComplete="street-address" />
        </div>
      </fieldset>

      <fieldset className="reg-set">
        <legend className="eyebrow">In an emergency</legend>

        <div className="field">
          <label htmlFor="nk">Next of kin</label>
          <input id="nk" value={f.next_of_kin_name} onChange={set('next_of_kin_name')} />
        </div>

        <div className="pair">
          <div className="field">
            <label htmlFor="nkp">Their phone</label>
            <input id="nkp" type="tel" value={f.next_of_kin_phone} onChange={set('next_of_kin_phone')} />
          </div>
          <div className="field">
            <label htmlFor="nkr">Relationship</label>
            <input
              id="nkr"
              value={f.next_of_kin_relationship}
              onChange={set('next_of_kin_relationship')}
              placeholder="Partner, parent…"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="hn">Anything a coach should know</label>
          <textarea
            id="hn"
            rows={3}
            value={f.health_notes}
            onChange={set('health_notes')}
            placeholder="Injuries, asthma, medication, anything we should watch for"
          />
        </div>
      </fieldset>

      {minor && (
        <fieldset className="reg-set reg-set-minor">
          <legend className="eyebrow">Parent or guardian</legend>
          <p className="field-hint" style={{ marginTop: 0 }}>
            This is a contact sport and {f.first_name || 'this member'} is under 18, so we need a
            parent or guardian on record before they can train.
          </p>

          <div className="field">
            <label htmlFor="gn">Parent or guardian name</label>
            <input id="gn" value={f.guardian_name} onChange={set('guardian_name')} required />
          </div>

          <div className="pair">
            <div className="field">
              <label htmlFor="gp">Their phone</label>
              <input id="gp" type="tel" value={f.guardian_phone} onChange={set('guardian_phone')} />
            </div>
            <div className="field">
              <label htmlFor="gr">Relationship</label>
              <input
                id="gr"
                value={f.guardian_relationship}
                onChange={set('guardian_relationship')}
                placeholder="Mother, father, carer…"
              />
            </div>
          </div>

          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I am {f.first_name ? `${f.first_name}'s` : 'this member’s'} parent or guardian and I
              agree to them taking part in coached boxing at Caesar&rsquo;s Boxing Gym.
            </span>
          </label>
        </fieldset>
      )}

      <fieldset className="reg-set">
        <legend className="eyebrow">Photos</legend>
        <label className="check">
          <input type="checkbox" checked={media} onChange={(e) => setMedia(e.target.checked)} />
          <span>
            Happy to appear in photos and videos the gym posts on Instagram and Facebook. Entirely
            optional, and you can change your mind by telling a coach.
          </span>
        </label>
      </fieldset>

      {error && <p className="sheet-warn">{error}</p>}

      <button className="btn btn-solid reg-submit" type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send registration'}
      </button>

      <p className="field-hint">
        A coach checks every registration before it goes on the system. Prefer to do it in person?
        Turn up to any session and a coach will type it in with you.
      </p>
    </form>
  )
}
