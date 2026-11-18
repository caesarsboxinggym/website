'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { extendSessions, saveTimetable, type Slot } from './actions'

export type ClassOption = { id: string; name: string; invite_only: boolean }

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const longDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

const daysUntil = (iso: string) =>
  Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(todayIso() + 'T00:00:00').getTime()) / 86400000)

const same = (a: Slot, b: Slot) =>
  a.class_type_id === b.class_type_id &&
  a.weekday === b.weekday &&
  a.starts === b.starts &&
  a.ends === b.ends &&
  a.capacity === b.capacity

let seq = 0
const newKey = () => `new-${Date.now()}-${seq++}`

/** One hour on from a HH:MM time, capped at the end of the day. */
function hourAfter(t: string) {
  const [h, m] = t.split(':').map(Number)
  const end = Math.min(h * 60 + m + 60, 23 * 60 + 55)
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}

export function TimetableEditor({
  saved,
  classes,
  lastSession,
}: {
  saved: Slot[]
  classes: ClassOption[]
  lastSession: string | null
}) {
  // The draft: nothing touches the website until Save is pressed.
  const [slots, setSlots] = useState<Slot[]>(saved)
  const [editing, setEditing] = useState<Slot | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? 'Class'
  const savedByKey = useMemo(() => new Map(saved.map((s) => [s.key, s])), [saved])

  const added = slots.filter((s) => !s.id)
  const changed = slots.filter((s) => {
    const was = savedByKey.get(s.key)
    return was && !same(s, was)
  })
  const removed = saved.filter((s) => !slots.some((d) => d.key === s.key))
  const dirty = added.length + changed.length + removed.length

  // Don't let a stray tap on Back or Reload throw away an afternoon's edits.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 7000)
  }

  function put(slot: Slot) {
    setSlots((prev) =>
      prev.some((s) => s.key === slot.key)
        ? prev.map((s) => (s.key === slot.key ? slot : s))
        : [...prev, slot]
    )
    setEditing(null)
  }

  function remove(key: string) {
    setSlots((prev) => prev.filter((s) => s.key !== key))
    setEditing(null)
  }

  function addTo(weekday: number) {
    const day = slots.filter((s) => s.weekday === weekday).sort((a, b) => a.ends.localeCompare(b.ends))
    const starts = day.length ? day[day.length - 1].ends : '18:00'
    setEditing({
      key: newKey(),
      id: null,
      class_type_id: classes[0]?.id ?? '',
      weekday,
      starts,
      ends: hourAfter(starts),
      capacity: 25,
    })
  }

  const horizonDays = lastSession ? daysUntil(lastSession) : -1

  return (
    <section className="pane on">
      <div className="pane-head">
        <h2 className="pane-title">Weekly timetable</h2>
        <p className="pane-sub">
          Tap a session to change its time, day or class. Nothing changes on the website until you
          press Save.
        </p>
      </div>

      <div className="tt-week">
        {DAYS.map((name, i) => {
          const weekday = i + 1
          const day = slots
            .filter((s) => s.weekday === weekday)
            .sort((a, b) => a.starts.localeCompare(b.starts))
          return (
            <div className="sess tt-day" key={weekday}>
              <div className="sess-head">
                <span className="sess-name">{name}</span>
                <span className="chip" style={{ marginLeft: 'auto' }}>
                  {day.length === 0 ? 'Closed' : `${day.length} session${day.length === 1 ? '' : 's'}`}
                </span>
              </div>

              {day.map((s, n) => {
                const was = savedByKey.get(s.key)
                const prev = day[n - 1]
                const clash = prev && s.starts < prev.ends
                return (
                  <button
                    className="row tt-row"
                    key={s.key}
                    type="button"
                    onClick={() => setEditing(s)}
                  >
                    <span className="tt-time">
                      {s.starts}
                      <small>to {s.ends}</small>
                    </span>
                    <span className="row-body">
                      <span className="row-name">{className(s.class_type_id)}</span>
                      <span className="row-meta">
                        <span className="chip">{s.capacity} places</span>
                        {!s.id && <span className="chip chip-junior">New</span>}
                        {was && !same(s, was) && <span className="chip chip-junior">Changed</span>}
                        {clash && (
                          <span className="chip" style={{ color: 'var(--oxide-ink)' }}>
                            Overlaps {className(prev.class_type_id)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="tt-edit">Edit</span>
                  </button>
                )
              })}

              <div className="sess-foot">
                <button className="btn-add" type="button" onClick={() => addTo(weekday)}>
                  + Add a session
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {removed.length > 0 && (
        <p className="pane-sub tt-removed">
          Removed, not saved yet:{' '}
          {removed.map((s) => `${DAYS[s.weekday - 1]} ${s.starts} ${className(s.class_type_id)}`).join(', ')}
          .
        </p>
      )}

      <div className="locked tt-horizon">
        <h3>Sessions on the booking page</h3>
        {lastSession ? (
          <p>
            People can book up to <b>{longDate(lastSession)}</b>
            {horizonDays < 21 ? ' — that is running out, so add more now.' : '.'}
          </p>
        ) : (
          <p>There are no sessions to book yet. Add eight weeks to open the booking page.</p>
        )}
        <button
          className="btn-add"
          type="button"
          disabled={pending || dirty > 0}
          onClick={() =>
            start(async () => {
              const res = await extendSessions(lastSession)
              flash(res.ok ? 'Eight more weeks of sessions added.' : res.error)
            })
          }
        >
          {pending ? 'Working…' : 'Add 8 more weeks'}
        </button>
        {dirty > 0 && <p>Save or discard your timetable changes first.</p>}
      </div>

      {dirty > 0 && (
        <div className="tt-bar" role="region" aria-label="Unsaved changes">
          <span>
            <b>
              {dirty} unsaved change{dirty === 1 ? '' : 's'}
            </b>
            <small>The website still shows the old timetable.</small>
          </span>
          <button
            className="btn-ghost-light"
            type="button"
            disabled={pending}
            onClick={() => {
              setSlots(saved)
              setError(null)
            }}
          >
            Discard
          </button>
          <button className="btn-record" type="button" disabled={pending} onClick={() => setConfirming(true)}>
            Save timetable
          </button>
        </div>
      )}

      {editing && (
        <SlotSheet
          slot={editing}
          isNew={!slots.some((s) => s.key === editing.key)}
          classes={classes}
          onClose={() => setEditing(null)}
          onSave={put}
          onRemove={() => remove(editing.key)}
        />
      )}

      {confirming && (
        <ConfirmSheet
          counts={{ added: added.length, changed: changed.length, removed: removed.length }}
          error={error}
          pending={pending}
          onClose={() => {
            setConfirming(false)
            setError(null)
          }}
          onConfirm={(from) => {
            setError(null)
            start(async () => {
              const res = await saveTimetable(slots, from)
              if (!res.ok) return setError(res.error)
              setConfirming(false)
              const k = res.summary.kept
              flash(
                k > 0
                  ? `Saved. ${k} session${k === 1 ? ' already has' : 's already have'} people booked, so ${k === 1 ? 'it was' : 'they were'} left as ${k === 1 ? 'it was' : 'they were'} — check the roll call.`
                  : 'Saved. The website and the booking page now show the new timetable.'
              )
            })
          }}
        />
      )}

      <div className={toast ? 'toast show' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>
    </section>
  )
}

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

function SlotSheet({
  slot,
  isNew,
  classes,
  onClose,
  onSave,
  onRemove,
}: {
  slot: Slot
  isNew: boolean
  classes: ClassOption[]
  onClose: () => void
  onSave: (s: Slot) => void
  onRemove: () => void
}) {
  const [f, setF] = useState(slot)
  const [places, setPlaces] = useState(String(slot.capacity))
  const [error, setError] = useState<string | null>(null)

  const chosen = classes.find((c) => c.id === f.class_type_id)

  function done() {
    const capacity = Number(places)
    if (!f.class_type_id) return setError('Pick a class.')
    if (!f.starts || !f.ends) return setError('Set a start and a finish time.')
    if (f.ends <= f.starts) return setError('It has to finish after it starts.')
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
      return setError('Places has to be a whole number, at least 1.')
    }
    onSave({ ...f, capacity })
  }

  return (
    <Sheet
      title={isNew ? 'Add a session' : 'Edit session'}
      sub="Runs every week on this day"
      onClose={onClose}
    >
      <div className="field field-light">
        <label htmlFor="tt-class">Class</label>
        <select
          id="tt-class"
          value={f.class_type_id}
          onChange={(e) => setF({ ...f, class_type_id: e.target.value })}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.invite_only ? ' (invite only)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="field field-light">
        <label htmlFor="tt-day">Day</label>
        <select
          id="tt-day"
          value={f.weekday}
          onChange={(e) => setF({ ...f, weekday: Number(e.target.value) })}
        >
          {DAYS.map((d, i) => (
            <option key={d} value={i + 1}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="pair">
        <div className="field field-light">
          <label htmlFor="tt-starts">Starts</label>
          <input
            id="tt-starts"
            type="time"
            step={300}
            value={f.starts}
            onChange={(e) => setF({ ...f, starts: e.target.value })}
          />
        </div>
        <div className="field field-light">
          <label htmlFor="tt-ends">Finishes</label>
          <input
            id="tt-ends"
            type="time"
            step={300}
            value={f.ends}
            onChange={(e) => setF({ ...f, ends: e.target.value })}
          />
        </div>
      </div>

      <div className="field field-light">
        <label htmlFor="tt-places">Places</label>
        <input
          id="tt-places"
          type="text"
          inputMode="numeric"
          value={places}
          onChange={(e) => setPlaces(e.target.value.replace(/\D/g, '').slice(0, 3))}
        />
      </div>

      {chosen?.invite_only && (
        <p className="sheet-note">
          {chosen.name} is invite only: it shows on the timetable, but nobody can book it online.
        </p>
      )}

      {error && <p className="sheet-warn">{error}</p>}

      <div className="pair">
        {isNew ? (
          <button className="btn-ghost-light" type="button" onClick={onClose}>
            Cancel
          </button>
        ) : (
          <button className="btn-danger" type="button" onClick={onRemove}>
            Remove
          </button>
        )}
        <button className="btn-record" type="button" onClick={done}>
          {isNew ? 'Add' : 'Done'}
        </button>
      </div>
    </Sheet>
  )
}

function ConfirmSheet({
  counts,
  error,
  pending,
  onClose,
  onConfirm,
}: {
  counts: { added: number; changed: number; removed: number }
  error: string | null
  pending: boolean
  onClose: () => void
  onConfirm: (from: string) => void
}) {
  const today = todayIso()
  const [from, setFrom] = useState(today)

  const parts = [
    counts.added && `${counts.added} added`,
    counts.changed && `${counts.changed} changed`,
    counts.removed && `${counts.removed} removed`,
  ].filter(Boolean)

  return (
    <Sheet title="Save the new timetable?" sub={parts.join(' · ')} onClose={onClose}>
      <div className="field field-light">
        <label htmlFor="tt-from">Starts from</label>
        <input
          id="tt-from"
          type="date"
          value={from}
          min={today}
          onChange={(e) => setFrom(e.target.value || today)}
        />
      </div>

      <p className="sheet-note">
        The timetable on the website changes straight away. On the booking page and the roll
        call, sessions from {from === today ? 'today' : longDate(from)} onward change to match;
        anything before that stays as it is.
      </p>
      <p className="sheet-note">
        If a class only changes time, people already booked move with it. If a class is removed
        or moves to another day, any session that already has people booked is left alone for
        you to sort out with them.
      </p>

      {error && <p className="sheet-warn">{error}</p>}

      <div className="pair">
        <button className="btn-ghost-light" type="button" onClick={onClose} disabled={pending}>
          Not yet
        </button>
        <button className="btn-record" type="button" onClick={() => onConfirm(from)} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Sheet>
  )
}
