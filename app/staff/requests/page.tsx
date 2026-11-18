'use client'

import { createClient } from '@/lib/supabase/client'
import { useData } from '@/lib/use-data'
import { PaneLoading } from '../pane-loading'
import { one } from '@/lib/pg'
import { BookingRequestList, type BookingRequest, type MemberOption } from './booking-review'
import { ReviewList, type Submission } from './registration-review'

function bandOf(dob: string | null, override: string | null): MemberOption['band'] {
  if (override) return override as MemberOption['band']
  if (!dob) return 'adult'
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.2425 * 864e5))
  return age < 13 ? 'kid' : age <= 16 ? 'teen' : 'adult'
}

async function load() {
  const supabase = createClient()

  const [{ data: bookingRows, error: bookErr }, { data: regRows }, { data: memberRows }, { data: availRows }] =
    await Promise.all([
      supabase
        .from('booking_requests')
        .select(
          'id, session_id, member_id, first_name, last_name, phone, email, date_of_birth, note, requested_at, sessions (session_date, starts, class_types (name))'
        )
        .eq('status', 'new')
        .order('requested_at'),
      supabase
        .from('registration_submissions')
        .select('*')
        .eq('status', 'new')
        .order('submitted_at'),
      supabase
        .from('members')
        .select('*')
        .eq('archived', false)
        .order('first_name'),
      supabase.from('session_availability').select('id, capacity, places_left'),
    ])

  const avail = new Map(
    (availRows ?? []).map((a) => [a.id as string, a as { capacity: number; places_left: number }])
  )

  const requests: BookingRequest[] = (bookingRows ?? []).map((r) => {
    const sess = one(r.sessions) as
      | { session_date: string; starts: string; class_types: unknown }
      | null
    const a = avail.get(r.session_id as string)
    return {
      id: r.id as string,
      session_id: r.session_id as string,
      member_id: (r.member_id as string) ?? null,
      first_name: r.first_name as string,
      last_name: (r.last_name as string) ?? null,
      phone: r.phone as string,
      email: (r.email as string) ?? null,
      date_of_birth: (r.date_of_birth as string) ?? null,
      note: (r.note as string) ?? null,
      requested_at: r.requested_at as string,
      session_date: sess?.session_date ?? '',
      starts: sess?.starts ?? '',
      class_name: (one(sess?.class_types) as { name: string } | null)?.name ?? 'Session',
      places_left: a?.places_left ?? 0,
      capacity: a?.capacity ?? 25,
    }
  })

  const members: MemberOption[] = (memberRows ?? []).map((m) => ({
    id: m.id as string,
    member_no: (m.member_no as number) ?? null,
    first_name: m.first_name as string,
    last_name: (m.last_name as string) ?? null,
    phone: (m.phone as string) ?? null,
    band: bandOf(m.date_of_birth as string | null, m.band_override as string | null),
  }))

  const registrations = (regRows ?? []) as Submission[]
  const nothing = requests.length === 0 && registrations.length === 0

  return { bookErr, requests, members, registrations, nothing }
}

export default function RequestsPage() {
  const { data } = useData(load)
  if (!data) return <PaneLoading />
  const { bookErr, requests, members, registrations, nothing } = data

  return (
    <section className="pane on">
      <div className="pane-head">
        <h2 className="pane-title">Requests</h2>
        <p className="pane-sub">
          Places asked for from the website, and new registrations. Both need a coach to approve.
        </p>
      </div>

      {bookErr && (
        <div className="locked">
          <h3>Could not load booking requests</h3>
          <p>{bookErr.message}</p>
        </div>
      )}

      {nothing && !bookErr && (
        <div className="locked">
          <h3>Nothing waiting</h3>
          <p>
            Places asked for at <code>/book</code> and registrations from <code>/register</code>{' '}
            land here.
          </p>
        </div>
      )}

      {requests.length > 0 && (
        <>
          <p className="queue-head">
            Booking requests <span>{requests.length}</span>
          </p>
          <BookingRequestList requests={requests} members={members} />
        </>
      )}

      {registrations.length > 0 && (
        <>
          <p className="queue-head">
            New registrations <span>{registrations.length}</span>
          </p>
          <ReviewList submissions={registrations} />
        </>
      )}
    </section>
  )
}
