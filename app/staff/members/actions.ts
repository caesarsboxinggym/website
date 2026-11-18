import { createClient } from '@/lib/supabase/client'
import { refresh } from '@/lib/use-data'

type Result = { ok: true } | { ok: false; error: string }

export type Band = 'kid' | 'teen' | 'adult'

/** A row of the members table, as staff see it. */
export type Member = {
  id: string
  first_name: string
  last_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  date_of_birth: string | null
  band_override: Band | null
  health_notes: string | null
  next_of_kin_name: string | null
  next_of_kin_phone: string | null
  next_of_kin_relationship: string | null
  guardian_name: string | null
  guardian_phone: string | null
  guardian_relationship: string | null
  consent_at: string | null
  consent_by: string | null
  media_consent: boolean
  media_consent_at: string | null
  archived: boolean
  created_at: string
}

/** What the add / edit form collects. Everything is text until it is saved. */
export type MemberInput = {
  first_name: string
  last_name: string
  phone: string
  email: string
  address: string
  date_of_birth: string
  band_override: Band | ''
  health_notes: string
  next_of_kin_name: string
  next_of_kin_phone: string
  next_of_kin_relationship: string
  guardian_name: string
  guardian_phone: string
  guardian_relationship: string
  consent: boolean
  media_consent: boolean
}

const trim = (v: string) => {
  const s = v.trim()
  return s ? s : null
}

/**
 * Add a member, or update one. `existing` is the row being edited, so that
 * consent keeps the date it was first given rather than being re-stamped on
 * every save.
 */
export async function saveMember(input: MemberInput, existing?: Member): Promise<Result> {
  if (!input.first_name.trim()) return { ok: false, error: 'A first name is needed.' }

  if (input.date_of_birth) {
    const dob = new Date(input.date_of_birth + 'T00:00:00')
    if (Number.isNaN(dob.getTime()) || dob > new Date()) {
      return { ok: false, error: 'That date of birth is not a real date in the past.' }
    }
  } else if (!existing) {
    return { ok: false, error: 'Date of birth is needed — it decides the rate.' }
  }

  const now = new Date().toISOString()
  const guardian = trim(input.guardian_name)

  const row = {
    first_name: input.first_name.trim(),
    last_name: trim(input.last_name),
    phone: trim(input.phone),
    email: trim(input.email),
    address: trim(input.address),
    date_of_birth: input.date_of_birth || null,
    band_override: input.band_override || null,
    health_notes: trim(input.health_notes),
    next_of_kin_name: trim(input.next_of_kin_name),
    next_of_kin_phone: trim(input.next_of_kin_phone),
    next_of_kin_relationship: trim(input.next_of_kin_relationship),
    guardian_name: guardian,
    guardian_phone: trim(input.guardian_phone),
    guardian_relationship: trim(input.guardian_relationship),
    consent_at: input.consent ? (existing?.consent_at ?? now) : null,
    consent_by: input.consent
      ? (existing?.consent_by ?? guardian ?? input.first_name.trim())
      : null,
    media_consent: input.media_consent,
    media_consent_at: input.media_consent ? (existing?.media_consent_at ?? now) : null,
  }

  const supabase = createClient()
  const { error } = existing
    ? await supabase.from('members').update(row).eq('id', existing.id)
    : await supabase.from('members').insert(row)

  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}

/**
 * Archiving hides a member from the roll call picker without touching their
 * history — past bookings and payments stay exactly as they were.
 */
export async function setArchived(id: string, archived: boolean): Promise<Result> {
  const { error } = await createClient().from('members').update({ archived }).eq('id', id)

  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}
