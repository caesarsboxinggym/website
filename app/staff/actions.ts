'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getStaff } from '@/lib/supabase/server'

type Result = { ok: true } | { ok: false; error: string }

/**
 * Materialise dated sessions from the weekly pattern. Admin only — the RPC
 * enforces that too, this is just so the UI can hide the button.
 */
export async function generateSessions(weeks = 8): Promise<Result> {
  const staff = await getStaff()
  if (staff?.role !== 'admin') return { ok: false, error: 'Admins only.' }

  const supabase = await createClient()
  const from = new Date()
  const to = new Date()
  to.setDate(to.getDate() + weeks * 7)

  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const { error } = await supabase.rpc('generate_sessions', {
    p_from: iso(from),
    p_to: iso(to),
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/staff')
  revalidatePath('/staff/week')
  return { ok: true }
}

/** Add an existing member to a session. Price is snapshotted by the RPC. */
export async function bookMember(sessionId: string, memberId: string): Promise<Result> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('book_member', {
    p_session_id: sessionId,
    p_member_id: memberId,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/staff')
  revalidatePath('/staff/week')
  return { ok: true }
}

export type NewMember = {
  first_name: string
  last_name?: string
  phone?: string
  email?: string
  date_of_birth?: string
}

/**
 * The quick add a coach uses at the door. Deliberately minimal — the full
 * registration form with next of kin and guardian consent is separate.
 *
 * Date of birth is required because it decides the rate. Without it the
 * system would silently charge a nine-year-old the adult price.
 */
export async function createMemberAndBook(
  sessionId: string,
  member: NewMember
): Promise<Result & { memberId?: string }> {
  if (!member.first_name?.trim()) {
    return { ok: false, error: 'A first name is needed.' }
  }
  if (!member.date_of_birth) {
    return { ok: false, error: 'Date of birth is needed — it decides the rate.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .insert({
      first_name: member.first_name.trim(),
      last_name: member.last_name?.trim() || null,
      phone: member.phone?.trim() || null,
      email: member.email?.trim() || null,
      date_of_birth: member.date_of_birth,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  const booked = await bookMember(sessionId, data.id)
  if (!booked.ok) return booked

  revalidatePath('/staff')
  return { ok: true, memberId: data.id }
}

/**
 * Record a payment. Amount and period are computed inside record_payment(),
 * so nothing here decides what anything costs.
 */
export async function takePayment(
  memberId: string,
  kind: 'single' | 'week' | 'month',
  method: 'cash' | 'card',
  bookingId: string | null,
  sumupRef?: string
): Promise<Result> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('record_payment', {
    p_member_id: memberId,
    p_kind: kind,
    p_method: method,
    p_booking_id: kind === 'single' ? bookingId : null,
    p_sumup_ref: sumupRef?.trim() || null,
    p_note: null,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/staff')
  revalidatePath('/staff/week')
  revalidatePath('/staff/balances')
  return { ok: true }
}

export async function setBookingStatus(
  bookingId: string,
  status: 'booked' | 'attended' | 'no_show' | 'cancelled'
): Promise<Result> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('set_booking_status', {
    p_booking_id: bookingId,
    p_status: status,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/staff')
  revalidatePath('/staff/week')
  return { ok: true }
}
