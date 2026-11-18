'use client'

import { createClient } from '@/lib/supabase/client'
import { useData } from '@/lib/use-data'
import { PaneLoading } from '../pane-loading'
import { MemberList } from './member-list'
import type { Member } from './actions'

async function load() {
  const { data, error } = await createClient()
    .from('members')
    .select('*')
    .order('first_name')
    .order('last_name')

  return { members: (data ?? []) as Member[], error }
}

export default function MembersPage() {
  const { data } = useData(load)
  if (!data) return <PaneLoading />

  return (
    <section className="pane on">
      <div className="pane-head">
        <h2 className="pane-title">Members</h2>
        <p className="pane-sub">Contact and emergency details. Tap a name to see or change them.</p>
      </div>

      {data.error ? (
        <div className="locked">
          <h3>Could not load the members</h3>
          <p>{data.error.message}</p>
        </div>
      ) : (
        <MemberList members={data.members} />
      )}
    </section>
  )
}
