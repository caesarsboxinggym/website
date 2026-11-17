'use client'

import { createClient } from '@/lib/supabase/client'
import { useData } from '@/lib/use-data'
import { Booker, type Slot } from './booker'

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

async function load() {
  const from = new Date()
  const to = new Date()
  to.setDate(to.getDate() + 13)

  const { data, error } = await createClient()
    .from('session_availability')
    .select('id, session_date, starts, ends, class_name, min_age, max_age, capacity, places_left')
    .gte('session_date', iso(from))
    .lte('session_date', iso(to))
    .order('session_date')
    .order('starts')

  return { slots: (data ?? []) as Slot[], failed: Boolean(error) }
}

/** Fetches the next two weeks of sessions in the browser, then hands over to the Booker. */
export function BookLoader() {
  const { data } = useData(load)

  if (!data) return <p className="lede">Loading sessions&hellip;</p>

  if (data.failed) {
    return (
      <div className="note">
        <b>Could not load the sessions.</b> Ring the gym on 07568 402875 and a coach will sort
        you out.
      </div>
    )
  }

  return <Booker slots={data.slots} />
}
