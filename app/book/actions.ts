import { createClient } from '@/lib/supabase/client'
import { refresh } from '@/lib/use-data'
import { validDob } from '@/lib/age'

export type BookingInput = {
  session_id: string
  first_name: string
  last_name?: string
  phone: string
  email?: string
  date_of_birth: string
  note?: string
  privacy_agreed: boolean
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
  if (!validDob(input.date_of_birth)) {
    return { ok: false, error: 'Please give the date of birth of the person training.' }
  }
  if (!input.privacy_agreed) {
    return { ok: false, error: 'Please tick the box to agree to the gym keeping these details.' }
  }

  const supabase = createClient()

  const { error } = await supabase.from('booking_requests').insert({
    session_id: input.session_id,
    first_name: input.first_name.trim(),
    last_name: trim(input.last_name),
    phone: input.phone.trim(),
    email: trim(input.email),
    date_of_birth: input.date_of_birth,
    note: trim(input.note),
  })

  if (error) {
    // The unique index, and the capacity and age checks in the policy, all surface here.
    if (error.code === '23505' || error.message.includes('booking_requests_no_dupes')) {
      return {
        ok: false,
        error: 'That number has already asked for a place in this session. A coach will be in touch.',
      }
    }
    if (error.code === '42501') {
      return {
        ok: false,
        error:
          'That session has just filled up, or is not open to that age group. Pick another one, or ring the gym on 07568 402875.',
      }
    }
    return {
      ok: false,
      error: 'Something went wrong. Try again, or ring the gym on 07568 402875.',
    }
  }

  refresh()
  return { ok: true }
}

// ---------------------------------------------------------------------
// Booking with a member number
// ---------------------------------------------------------------------

export const validMemberNo = (v: string) => /^[1-9]\d{3}$/.test(v.trim())

/**
 * Whether a member number trains with the kids or the adults, so the page
 * can show the right classes. Null means the number is not in use. Nothing
 * else about the member ever comes back to the browser.
 */
export async function memberGroup(
  memberNo: string
): Promise<{ ok: true; group: 'kid' | 'adult' | null } | { ok: false }> {
  if (!validMemberNo(memberNo)) return { ok: true, group: null }
  const supabase = createClient()
  const { data, error } = await supabase.rpc('member_group', { p_member_no: Number(memberNo) })
  if (error) return { ok: false }
  return { ok: true, group: data === 'kid' || data === 'adult' ? data : null }
}

const NUMBER_ERRORS: Record<string, string> = {
  not_found: 'That member number is not on the system. Check it, or book with a date of birth instead.',
  gone: 'That session is no longer running. Pick another one.',
  invite: 'That class is by invitation. A coach will invite you.',
  full: 'That session has just filled up. Pick another one, or ring the gym on 07568 402875.',
  age: 'That class is not open to your age group. Pick another one.',
  already: 'You have already asked for, or been given, a place in this session.',
}

export async function requestPlaceByNumber(
  sessionId: string,
  memberNo: string
): Promise<BookResult> {
  if (!validMemberNo(memberNo)) {
    return { ok: false, error: 'A member number is four digits.' }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('request_place_by_number', {
    p_session_id: sessionId,
    p_member_no: Number(memberNo),
  })

  if (error || typeof data !== 'string') {
    return { ok: false, error: 'Something went wrong. Try again, or ring the gym on 07568 402875.' }
  }
  if (data !== 'ok') {
    return { ok: false, error: NUMBER_ERRORS[data] ?? 'Something went wrong. Try again.' }
  }

  refresh()
  return { ok: true }
}
