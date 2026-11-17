'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type BookingInput = {
  session_id: string
  first_name: string
  last_name?: string
  phone: string
  email?: string
  date_of_birth?: string
  note?: string
}

export type BookResult = { ok: true } | { ok: false; error: string }

const trim = (v?: string) => {
  const s = v?.trim()
  return s ? s : null
}

export async function requestPlace(input: BookingInput): Promise<BookResult> {
  if (!input.first_name?.trim()) return { ok: false, error: 'Please give a first name.' }
  if (!input.phone?.trim() || input.phone.replace(/\D/g, '').length < 6) {
    return { ok: false, error: 'Please give a phone number so a coach can confirm.' }
  }
  if (!input.session_id) return { ok: false, error: 'Please pick a session.' }

  const hdrs = await headers()
  const fwd = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd && /^[0-9a-fA-F.:]+$/.test(fwd) ? fwd : null

  const supabase = await createClient()

  const { error } = await supabase.from('booking_requests').insert({
    session_id: input.session_id,
    first_name: input.first_name.trim(),
    last_name: trim(input.last_name),
    phone: input.phone.trim(),
    email: trim(input.email),
    date_of_birth: input.date_of_birth || null,
    note: trim(input.note),
    submitted_ip: ip,
  })

  if (error) {
    // The unique index and the capacity check in the policy both surface here.
    if (error.code === '23505' || error.message.includes('booking_requests_no_dupes')) {
      return {
        ok: false,
        error: 'That number has already asked for a place in this session. A coach will be in touch.',
      }
    }
    if (error.code === '42501') {
      return {
        ok: false,
        error: 'That session just filled up. Pick another one, or ring the gym on 07568 402875.',
      }
    }
    return {
      ok: false,
      error: 'Something went wrong. Try again, or ring the gym on 07568 402875.',
    }
  }

  revalidatePath('/book')
  revalidatePath('/staff/requests')
  return { ok: true }
}
