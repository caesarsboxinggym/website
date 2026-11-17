import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side client. Safe to use in client components: the publishable key
 * is designed to ship to the browser, and row-level security is what actually
 * protects the data.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
