'use client'

import { useState, useTransition } from 'react'
import { saveMember, setArchived, type Band, type Member, type MemberInput } from './actions'

const BAND_LABEL: Record<Band, string> = { kid: 'Kid', teen: 'Teen', adult: 'Adult' }
const BAND_RATE: Record<Band, string> = {
  kid: 'Kids rate',
  teen: 'Teenager rate',
  adult: 'Adult rate',
}

function ageOf(dob: string | null) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.2425 * 864e5))
}

/** Mirrors member_band_on() in SQL. */
function bandOf(m: Pick<Member, 'date_of_birth' | 'band_override'>): Band {
  if (m.band_override) return m.band_override
  const age = ageOf(m.date_of_birth)
  if (age === null) return 'adult'
  return age < 13 ? 'kid' : age <= 16 ? 'teen' : 'adult'
}

const isMinor = (dob: string | null) => {
  const age = ageOf(dob)
  return age !== null && age < 18
}

const fullName = (m: Pick<Member, 'first_name' | 'last_name'>) =>
  `${m.first_name} ${m.last_name ?? ''}`.trim()

const longDate = (s: string) =>
  new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

const tel = (p: string) => `tel:${p.replace(/\s/g, '')}`

export function MemberList({ members }: { members: Member[] }) {
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4500)
  }

  const active = members.filter((m) => !m.archived)
  const archived = members.filter((m) => m.archived)
  const pool = showArchived ? archived : active

  const q = query.trim().toLowerCase()
  const digits = q.replace(/\D/g, '')
  const shown = q
    ? pool.filter(
        (m) =>
          fullName(m).toLowerCase().includes(q) ||
          (digits.length >= 3 && (m.phone ?? '').replace(/\D/g, '').includes(digits))
      )
    : pool

  // Looked up fresh each render, so the sheet shows saved changes straight away.
  const open = openId ? (members.find((m) => m.id === openId) ?? null) : null

  return (
    <>
      <div className="mem-bar">
        <div className="field field-light">
          <label htmlFor="mq">Search</label>
          <input
            id="mq"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or phone"
            autoComplete="off"
          />
        </div>
        <button className="btn-record" type="button" onClick={() => setAdding(true)}>
          Add member
        </button>
      </div>

      <div className="sess">
        <div className="sess-head">
          <span className="sess-name">{showArchived ? 'Archived' : 'Current members'}</span>
          <span className="sess-coach" style={{ marginLeft: 'auto' }}>
            {q ? `${shown.length} of ${pool.length}` : pool.length}
          </span>
        </div>

        <div className="rows">
          {shown.length === 0 && (
            <div className="row" style={{ borderLeftColor: 'var(--hairline)' }}>
              <span className="row-body">
                <span className="row-name" style={{ color: '#7A6A59', fontWeight: 400 }}>
                  {q
                    ? 'Nobody matches that search.'
                    : showArchived
                      ? 'Nobody has been archived.'
                      : 'No members yet. Add the first one, or accept a registration.'}
                </span>
              </span>
            </div>
          )}

          {shown.map((m) => {
            const band = bandOf(m)
            const minor = isMinor(m.date_of_birth)
            return (
              <button
                className="row mem-row"
                key={m.id}
                type="button"
                onClick={() => setOpenId(m.id)}
              >
                <span className="row-body">
                  <span className="row-name">{fullName(m)}</span>
                  <span className="row-meta">
                    {band !== 'adult' && (
                      <span className="chip chip-junior">{BAND_LABEL[band]}</span>
                    )}
                    {m.phone && <span className="chip">{m.phone}</span>}
                    {m.health_notes && (
                      <span className="chip" style={{ color: 'var(--oxide-ink)' }}>
                        Health note
                      </span>
                    )}
                    {!m.next_of_kin_name && !m.guardian_name && (
                      <span className="chip" style={{ color: 'var(--oxide-ink)' }}>
                        No emergency contact
                      </span>
                    )}
                    {minor && !m.consent_at && (
                      <span className="chip" style={{ color: 'var(--oxide-ink)' }}>
                        No consent on file
                      </span>
                    )}
                    {!m.date_of_birth && <span className="chip">No date of birth</span>}
                  </span>
                </span>
                <span className="row-caret" aria-hidden="true">
                  <svg width={8} height={13} viewBox="0 0 8 13" fill="none">
                    <path d="M1 1l6 5.5L1 12" stroke="currentColor" strokeWidth={1.6} />
                  </svg>
                </span>
              </button>
            )
          })}
        </div>

        <div className="sess-foot">
          <span>
            <b>{active.length}</b> current &middot; <b>{archived.length}</b> archived
          </span>
          {(archived.length > 0 || showArchived) && (
            <button className="btn-add" type="button" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Show current' : 'Show archived'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <MemberSheet
          key={open.id}
          member={open}
          onClose={() => setOpenId(null)}
          onDone={(msg, close) => {
            if (close) setOpenId(null)
            flash(msg)
          }}
        />
      )}

      {adding && (
        <Sheet title="Add member" sub="Straight onto the list, no approval step" onClose={() => setAdding(false)}>
          <MemberForm
            onCancel={() => setAdding(false)}
            onSaved={(name) => {
              setAdding(false)
              flash(`${name} added to the members list.`)
            }}
          />
        </Sheet>
      )}

      <div className={toast ? 'toast show' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

function Sheet({
  title,
  sub,
  onClose,
  children,
}: {
  title: string
  sub?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="scrim open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <div>
            <h3>{title}</h3>
            {sub && <p className="sheet-sub">{sub}</p>}
          </div>
          <button className="btn-x" type="button" onClick={onClose} aria-label="Close">
            <svg width={13} height={13} viewBox="0 0 13 13" aria-hidden="true">
              <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth={1.6} fill="none" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Detail({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="det">
      <span className="det-k">{k}</span>
      <span className="det-v">{children}</span>
    </div>
  )
}

const missing = <span style={{ color: '#A2907C' }}>Not on file</span>

/** Name, relationship and a tap-to-call number for a next of kin or guardian. */
function Contact({
  name,
  relationship,
  phone,
}: {
  name: string | null
  relationship: string | null
  phone: string | null
}) {
  if (!name && !phone) return missing
  const who = [name, relationship].filter(Boolean).join(' · ')
  return (
    <>
      {who}
      {phone && (
        <>
          {who ? ' · ' : ''}
          <a className="mem-link" href={tel(phone)}>
            {phone}
          </a>
        </>
      )}
    </>
  )
}

function MemberSheet({
  member: m,
  onClose,
  onDone,
}: {
  member: Member
  onClose: () => void
  onDone: (msg: string, close: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const name = fullName(m)
  const band = bandOf(m)
  const age = ageOf(m.date_of_birth)
  const minor = isMinor(m.date_of_birth)

  function archive(to: boolean) {
    setError(null)
    start(async () => {
      const res = await setArchived(m.id, to)
      if (!res.ok) return setError(res.error)
      onDone(to ? `${name} archived.` : `${name} is back on the current list.`, true)
    })
  }

  if (editing) {
    return (
      <Sheet title={`Edit ${m.first_name}`} sub={name} onClose={onClose}>
        <MemberForm
          existing={m}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            onDone(`${name}'s details saved.`, false)
          }}
        />
      </Sheet>
    )
  }

  return (
    <Sheet
      title={name}
      sub={`${BAND_RATE[band]}${m.band_override ? ' (set by hand)' : ''}${m.archived ? ' · Archived' : ''}`}
      onClose={onClose}
    >
      {m.health_notes && (
        <p className="sheet-warn" style={{ whiteSpace: 'pre-wrap' }}>
          <b>Health:</b> {m.health_notes}
        </p>
      )}

      <div className="det-grid mem-det">
        <Detail k="Phone">
          {m.phone ? (
            <a className="mem-link" href={tel(m.phone)}>
              {m.phone}
            </a>
          ) : (
            missing
          )}
        </Detail>
        <Detail k="Email">
          {m.email ? (
            <a className="mem-link" href={`mailto:${m.email}`}>
              {m.email}
            </a>
          ) : (
            <span style={{ color: '#A2907C' }}>None — chase in person</span>
          )}
        </Detail>
        <Detail k="Address">{m.address ?? missing}</Detail>
        <Detail k="Date of birth">
          {m.date_of_birth ? `${longDate(m.date_of_birth)} · age ${age}` : missing}
        </Detail>
        <Detail k="Next of kin">
          <Contact
            name={m.next_of_kin_name}
            relationship={m.next_of_kin_relationship}
            phone={m.next_of_kin_phone}
          />
        </Detail>
        {(minor || m.guardian_name) && (
          <Detail k="Parent or guardian">
            <Contact
              name={m.guardian_name}
              relationship={m.guardian_relationship}
              phone={m.guardian_phone}
            />
          </Detail>
        )}
        <Detail k="Photos">{m.media_consent ? 'Happy to appear' : 'Prefers not to appear'}</Detail>
        <Detail k="On the system since">{longDate(m.created_at)}</Detail>
      </div>

      {minor && (
        <div className="det-flags" style={{ padding: 0 }}>
          <span className={m.consent_at ? 'pill pill-paid' : 'pill pill-unpaid'}>
            {m.consent_at
              ? `Consent given ${longDate(m.consent_at)}${m.consent_by ? ` by ${m.consent_by}` : ''}`
              : 'No guardian consent on file'}
          </span>
        </div>
      )}

      {error && <p className="sheet-warn">{error}</p>}

      {!confirmArchive && (
        <div className="pair">
          {m.archived ? (
            <button className="btn-ghost-light" type="button" disabled={pending} onClick={() => archive(false)}>
              {pending ? 'Restoring…' : 'Restore'}
            </button>
          ) : (
            <button className="btn-ghost-light" type="button" onClick={() => setConfirmArchive(true)}>
              Archive
            </button>
          )}
          <button className="btn-record" type="button" onClick={() => setEditing(true)}>
            Edit details
          </button>
        </div>
      )}

      {confirmArchive && (
        <div className="sheet-danger">
          <p className="sheet-note" style={{ margin: 0 }}>
            Archiving takes {m.first_name} off this list and out of the roll call picker. Their
            bookings and payments are kept, and you can restore them at any time.
          </p>
          <div className="pair">
            <button className="btn-ghost-light" type="button" disabled={pending} onClick={() => setConfirmArchive(false)}>
              Keep
            </button>
            <button className="btn-danger" type="button" disabled={pending} onClick={() => archive(true)}>
              {pending ? 'Archiving…' : 'Archive'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */

function blank(m?: Member): MemberInput {
  return {
    first_name: m?.first_name ?? '',
    last_name: m?.last_name ?? '',
    phone: m?.phone ?? '',
    email: m?.email ?? '',
    address: m?.address ?? '',
    date_of_birth: m?.date_of_birth ?? '',
    band_override: m?.band_override ?? '',
    health_notes: m?.health_notes ?? '',
    next_of_kin_name: m?.next_of_kin_name ?? '',
    next_of_kin_phone: m?.next_of_kin_phone ?? '',
    next_of_kin_relationship: m?.next_of_kin_relationship ?? '',
    guardian_name: m?.guardian_name ?? '',
    guardian_phone: m?.guardian_phone ?? '',
    guardian_relationship: m?.guardian_relationship ?? '',
    consent: Boolean(m?.consent_at),
    media_consent: m?.media_consent ?? false,
  }
}

function MemberForm({
  existing,
  onCancel,
  onSaved,
}: {
  existing?: Member
  onCancel: () => void
  onSaved: (name: string) => void
}) {
  const [f, setF] = useState<MemberInput>(() => blank(existing))
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const minor = isMinor(f.date_of_birth || null)

  function text(key: keyof MemberInput, label: string, type = 'text') {
    const id = `mf-${key}`
    return (
      <div className="field field-light">
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          type={type}
          value={f[key] as string}
          onChange={(e) => setF((v) => ({ ...v, [key]: e.target.value }))}
          autoComplete="off"
        />
      </div>
    )
  }

  function save() {
    setError(null)
    start(async () => {
      const res = await saveMember(f, existing)
      if (!res.ok) return setError(res.error)
      onSaved(`${f.first_name.trim()} ${f.last_name.trim()}`.trim())
    })
  }

  return (
    <>
      <div className="sheet-group">
        <span className="sheet-label">Who they are</span>
        <div className="pair">
          {text('first_name', 'First name')}
          {text('last_name', 'Last name')}
        </div>
        {text('date_of_birth', 'Date of birth', 'date')}
        <div className="field field-light">
          <label htmlFor="mf-band">Rate</label>
          <select
            id="mf-band"
            value={f.band_override}
            onChange={(e) => setF((v) => ({ ...v, band_override: e.target.value as Band | '' }))}
          >
            <option value="">Follow their age</option>
            <option value="kid">Always kids rate</option>
            <option value="teen">Always teenager rate</option>
            <option value="adult">Always adult rate</option>
          </select>
        </div>
      </div>

      <div className="sheet-group">
        <span className="sheet-label">Contact</span>
        {text('phone', 'Phone', 'tel')}
        {text('email', 'Email (optional)', 'email')}
        <div className="field field-light">
          <label htmlFor="mf-address">Address</label>
          <textarea
            id="mf-address"
            rows={2}
            value={f.address}
            onChange={(e) => setF((v) => ({ ...v, address: e.target.value }))}
          />
        </div>
      </div>

      <div className="sheet-group">
        <span className="sheet-label">Next of kin</span>
        <div className="pair">
          {text('next_of_kin_name', 'Name')}
          {text('next_of_kin_relationship', 'Relationship')}
        </div>
        {text('next_of_kin_phone', 'Phone', 'tel')}
      </div>

      {(minor || f.guardian_name) && (
        <div className="sheet-group">
          <span className="sheet-label">Parent or guardian</span>
          <div className="pair">
            {text('guardian_name', 'Name')}
            {text('guardian_relationship', 'Relationship')}
          </div>
          {text('guardian_phone', 'Phone', 'tel')}
          <label className="check check-light">
            <input
              type="checkbox"
              checked={f.consent}
              onChange={(e) => setF((v) => ({ ...v, consent: e.target.checked }))}
            />
            <span>The parent or guardian has given consent for them to train</span>
          </label>
        </div>
      )}

      <div className="sheet-group">
        <span className="sheet-label">Health and photos</span>
        <div className="field field-light">
          <label htmlFor="mf-health">Health notes</label>
          <textarea
            id="mf-health"
            rows={3}
            value={f.health_notes}
            onChange={(e) => setF((v) => ({ ...v, health_notes: e.target.value }))}
            placeholder="Asthma, injuries, medication — anything a coach should know"
          />
        </div>
        <label className="check check-light">
          <input
            type="checkbox"
            checked={f.media_consent}
            onChange={(e) => setF((v) => ({ ...v, media_consent: e.target.checked }))}
          />
          <span>Happy to appear in photos and videos the club posts</span>
        </label>
      </div>

      {minor && (!f.guardian_name.trim() || !f.consent) && (
        <p className="sheet-note">
          Under 18: a guardian name and consent should be on file. You can save without them and
          fill them in later.
        </p>
      )}

      {error && <p className="sheet-warn">{error}</p>}

      <div className="pair">
        <button className="btn-ghost-light" type="button" onClick={onCancel} disabled={pending}>
          {existing ? 'Back' : 'Cancel'}
        </button>
        <button className="btn-record" type="button" onClick={save} disabled={pending}>
          {pending ? 'Saving…' : existing ? 'Save changes' : 'Add member'}
        </button>
      </div>
    </>
  )
}
