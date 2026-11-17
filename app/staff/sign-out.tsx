'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()

  return (
    <button
      className="btn-out"
      type="button"
      onClick={async () => {
        await createClient().auth.signOut()
        router.replace('/login')
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}
