'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getStaff, StaffContext } from '@/lib/staff'
import { useData } from '@/lib/use-data'
import { LOGO } from '@/lib/base'
import { SignOutButton } from './sign-out'
import { StaffTabs } from './tabs'

/**
 * Guards /staff and badges the Requests tab.
 *
 * The redirect here is convenience, not security — the real protection is RLS.
 * Even if someone reached a staff page without a session, every query would
 * come back empty.
 */
async function load() {
  // No profile row means the account exists in auth but was never made staff.
  const staff = await getStaff()
  if (!staff) return { staff: null, count: 0 }

  // Badge the tab so nothing waiting gets missed.
  const supabase = createClient()
  const [{ count: regs }, { count: books }] = await Promise.all([
    supabase
      .from('registration_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase
      .from('booking_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),
  ])

  return { staff, count: (regs ?? 0) + (books ?? 0) }
}

export default function StaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter()
  const path = usePathname()
  const { data } = useData(load)

  const signedOut = data !== undefined && !data.staff

  useEffect(() => {
    if (signedOut) router.replace(`/login?next=${encodeURIComponent(path)}`)
  }, [signedOut, router, path])

  if (!data?.staff) {
    return (
      <div className="staff-shell">
        <div className="shell">
          <p className="pane-sub" style={{ padding: '40px 0' }}>
            {signedOut ? 'Taking you to sign in…' : 'Loading…'}
          </p>
        </div>
      </div>
    )
  }

  const { staff, count } = data

  return (
    <StaffContext.Provider value={staff}>
      <div className="staff-shell">
        <div className="sbar">
          <div className="shell sbar-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="sbar-mark" src={LOGO} alt="" width={28} height={28} />
            <span className="sbar-title">Caesar&rsquo;s &middot; Staff</span>
            <span className="chip">
              {staff.full_name} &middot; {staff.role}
            </span>
            <SignOutButton />
          </div>
        </div>

        <StaffTabs role={staff.role} pending={count} />

        <div className="shell">{children}</div>
      </div>
    </StaffContext.Provider>
  )
}
