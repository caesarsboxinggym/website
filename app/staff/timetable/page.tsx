'use client'

import { createClient } from '@/lib/supabase/client'
import { useStaff } from '@/lib/staff'
import { useData } from '@/lib/use-data'
import { PaneLoading } from '../pane-loading'
import { TimetableEditor, type ClassOption } from './editor'
import type { Slot } from './actions'

async function load() {
  const supabase = createClient()

  const [{ data: slotRows, error }, { data: classRows }, { data: lastRows }] = await Promise.all([
    supabase
      .from('schedule_slots')
      .select('id, class_type_id, weekday, starts, ends, capacity')
      .eq('active', true)
      .order('weekday')
      .order('starts'),
    supabase.from('class_types').select('*').eq('active', true).order('sort'),
    supabase
      .from('sessions')
      .select('session_date')
      .neq('status', 'cancelled')
      .order('session_date', { ascending: false })
      .limit(1),
  ])

  const slots: Slot[] = (slotRows ?? []).map((s) => ({
    key: s.id as string,
    id: s.id as string,
    class_type_id: s.class_type_id as string,
    weekday: s.weekday as number,
    starts: (s.starts as string).slice(0, 5),
    ends: (s.ends as string).slice(0, 5),
    capacity: s.capacity as number,
  }))

  const classes: ClassOption[] = (classRows ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    invite_only: Boolean(c.invite_only),
  }))

  return {
    failed: Boolean(error),
    slots,
    classes,
    lastSession: (lastRows?.[0]?.session_date as string | undefined) ?? null,
  }
}

export default function TimetablePage() {
  const staff = useStaff()

  if (staff?.role !== 'admin') {
    return (
      <section className="pane on">
        <div className="pane-head">
          <h2 className="pane-title">Timetable</h2>
        </div>
        <div className="locked">
          <h3>Admin only</h3>
          <p>Only an admin can change the weekly timetable.</p>
        </div>
      </section>
    )
  }

  return <AdminTimetable />
}

function AdminTimetable() {
  const { data } = useData(load)

  if (!data) return <PaneLoading />

  if (data.failed) {
    return (
      <section className="pane on">
        <div className="locked">
          <h3>Could not load the timetable</h3>
          <p>Check the connection and reload the page.</p>
        </div>
      </section>
    )
  }

  return (
    <TimetableEditor
      // a fresh editor whenever the saved timetable changes underneath it
      key={JSON.stringify(data.slots)}
      saved={data.slots}
      classes={data.classes}
      lastSession={data.lastSession}
    />
  )
}
