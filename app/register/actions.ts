import { createClient } from '@/lib/supabase/client'

export type RegistrationInput = {
  first_name: string
  last_name?: string
  date_of_birth: string
  phone?: string
  email?: string
  address?: string
  health_notes?: string
  next_of_kin_name?: string
  next_of_kin_phone?: string
  next_of_kin_relationship?: string
  guardian_name?: string
  guardian_phone?: string
  guardian_relationship?: string
  consent_given: boolean
  media_consent: boolean
}

export type SubmitResult = { ok: true } | { ok: false; error: string }

function isMinor(dob: string) {
  const d = new Date(dob + 'T00:00:00')
  const eighteen = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate())
  return eighteen > new Date()
}

const trim = (v?: string) => {
  const s = v?.trim()
  return s ? s : null
}

export async function submitRegistration(input: RegistrationInput): Promise<SubmitResult> {
  // Checked here so the visitor gets a clear message. The database is what
  // actually enforces the rules — this runs in the browser.
  if (!input.first_name?.trim()) {
    return { ok: false, error: 'Please give a first name.' }
  }
  if (!input.date_of_birth) {
    return { ok: false, error: 'Please give a date of birth.' }
  }

  const dob = new Date(input.date_of_birth + 'T00:00:00')
  if (Number.isNaN(dob.getTime()) || dob > new Date()) {
    return { ok: false, error: 'That date of birth is not a real date in the past.' }
  }

  const minor = isMinor(input.date_of_birth)

  if (minor && !input.guardian_name?.trim()) {
    return { ok: false, error: 'Under 18s need a parent or guardian name.' }
  }
  if (minor && !input.consent_given) {
    return {
      ok: false,
      error: 'A parent or guardian needs to agree to the consent before we can register a under-18.',
    }
  }

  const supabase = createClient()

  const { error } = await supabase.from('registration_submissions').insert({
    first_name: input.first_name.trim(),
    last_name: trim(input.last_name),
    date_of_birth: input.date_of_birth,
    phone: trim(input.phone),
    email: trim(input.email),
    address: trim(input.address),
    health_notes: trim(input.health_notes),
    next_of_kin_name: trim(input.next_of_kin_name),
    next_of_kin_phone: trim(input.next_of_kin_phone),
    next_of_kin_relationship: trim(input.next_of_kin_relationship),
    guardian_name: minor ? trim(input.guardian_name) : null,
    guardian_phone: minor ? trim(input.guardian_phone) : null,
    guardian_relationship: minor ? trim(input.guardian_relationship) : null,
    consent_given: input.consent_given,
    media_consent: input.media_consent,
  })

  if (error) {
    return {
      ok: false,
      error:
        'Something went wrong saving that. Try again, or ring the gym on 07568 402875 and a coach will take your details.',
    }
  }

  return { ok: true }
}
