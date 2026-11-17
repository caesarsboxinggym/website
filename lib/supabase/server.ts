import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side client for server components, route handlers and server actions.
 *
 * Still uses the publishable key, so every query runs as the signed-in user and
 * RLS applies exactly as it does in the browser. Nothing here bypasses policy.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a server component, where cookies are read-only.
            // The middleware refreshes the session instead, so this is fine.
          }
        },
      },
    }
  )
}

/**
 * The signed-in staff member's profile, or null.
 *
 * Reads the profiles table under RLS, so a signed-out visitor gets null and a
 * signed-in user only ever sees their own row.
 */
export async function getStaff() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role, active')
    .eq('id', user.id)
    .single()

  if (!data || !data.active) return null

  return { ...data, email: user.email as string | undefined }
}
