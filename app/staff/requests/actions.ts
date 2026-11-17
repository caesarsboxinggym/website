'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Result = { ok: true } | { ok: false; error: string }

/**
 * Approve a request and book the member in. Capacity is enforced inside
 * accept_booking_request(), which locks the session row — so two coaches
 * approving at the same moment cannot push a session past 25.
 */
export async function acceptBookingRequest(id: string, memberId: string): Promise<Result> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('accept_booking_request', {
    p_request_id: id,
    p_member_id: memberId,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/staff/requests')
  revalidatePath('/staff')
  revalidatePath('/staff/week')
  revalidatePath('/book')
  return { ok: true }
}

export async function rejectBookingRequest(id: string): Promise<Result> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('reject_booking_request', { p_request_id: id })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/staff/requests')
  revalidatePath('/book')
  return { ok: true }
}

export async function acceptRegistration(id: string): Promise<Result> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('accept_registration', { p_submission_id: id })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/staff/requests')
  revalidatePath('/staff/members')
  return { ok: true }
}

export async function rejectRegistration(id: string): Promise<Result> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('registration_submissions')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/staff/requests')
  return { ok: true }
}
