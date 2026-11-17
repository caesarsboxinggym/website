'use client'

import { createContext, useContext } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Staff = {
  id: string
  full_name: string
  role: string
  active: boolean
  email?: string
}

/**
 * The signed-in staff member's profile, or null.
 *
 * Reads the profiles table under RLS, so a signed-out visitor gets null and a
 * signed-in user only ever sees their own row.
 */
export async function getStaff(): Promise<Staff | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role, active')
    .eq('id', user.id)
    .single()

  if (!data || !data.active) return null

  return { ...(data as Omit<Staff, 'email'>), email: user.email }
}

/** Set by the staff layout once the sign-in has been checked. */
export const StaffContext = createContext<Staff | null>(null)

export const useStaff = () => useContext(StaffContext)
