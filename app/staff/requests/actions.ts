import { createClient } from '@/lib/supabase/client'
import { refresh } from '@/lib/use-data'

type Result = { ok: true } | { ok: false; error: string }

/**
 * Approve a request and book the member in. Pass null for the member when
 * they are not on the system yet: the request's own details become a new
 * member, booked into the session they asked for, in one step.
 *
 * Capacity and the age group are enforced inside accept_booking_request(),
 * which locks the session row — so two coaches approving at the same moment
 * cannot push a session past 25.
 */
export async function acceptBookingRequest(id: string, memberId: string | null): Promise<Result> {
  const supabase = createClient()

  const { error } = await supabase.rpc('accept_booking_request', {
    p_request_id: id,
    p_member_id: memberId,
  })

  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}

export async function rejectBookingRequest(id: string): Promise<Result> {
  const supabase = createClient()

  const { error } = await supabase.rpc('reject_booking_request', { p_request_id: id })

  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}

export async function acceptRegistration(id: string): Promise<Result> {
  const supabase = createClient()

  const { error } = await supabase.rpc('accept_registration', { p_submission_id: id })

  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}

export async function rejectRegistration(id: string): Promise<Result> {
  const supabase = createClient()

  const { error } = await supabase
    .from('registration_submissions')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}
