import { createClient } from '@/lib/supabase/client'
import { refresh } from '@/lib/use-data'

/** One class on one day of the weekly pattern. `id` is null until it is saved. */
export type Slot = {
  key: string
  id: string | null
  class_type_id: string
  weekday: number
  /** HH:MM */
  starts: string
  ends: string
  capacity: number
}

export type SaveSummary = {
  added: number
  removed: number
  changed: number
  kept: number
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

/**
 * Save the whole week in one go. The database works out what changed,
 * updates the website timetable and brings the dated sessions into line.
 */
export async function saveTimetable(
  slots: Slot[],
  from: string
): Promise<Result<{ summary: SaveSummary }>> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('save_timetable', {
    p_slots: slots.map((s) => ({
      id: s.id,
      class_type_id: s.class_type_id,
      weekday: s.weekday,
      starts: s.starts,
      ends: s.ends,
      capacity: s.capacity,
    })),
    p_from: from,
  })

  if (error) {
    const missing = error.code === 'PGRST202' || /could not find the function/i.test(error.message)
    return {
      ok: false,
      error: missing
        ? 'The timetable editor has not been switched on in the database yet.'
        : error.message,
    }
  }

  refresh()
  return { ok: true, summary: data as SaveSummary }
}

/** Generate eight more weeks of sessions after the last one that exists. */
export async function extendSessions(lastDate: string | null): Promise<Result> {
  const supabase = createClient()

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const today = new Date()
  const last = lastDate ? new Date(lastDate + 'T00:00:00') : today
  const from = last > today ? last : today
  const to = new Date(from)
  to.setDate(to.getDate() + 56)

  const { error } = await supabase.rpc('generate_sessions', { p_from: iso(from), p_to: iso(to) })
  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}
