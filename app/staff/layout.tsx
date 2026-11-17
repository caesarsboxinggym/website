import { redirect } from 'next/navigation'
import { createClient, getStaff } from '@/lib/supabase/server'
import { SignOutButton } from './sign-out'
import { StaffTabs } from './tabs'

export default async function StaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const staff = await getStaff()

  // No profile row means the account exists in auth but was never made staff.
  // Worth saying so plainly rather than showing empty screens.
  if (!staff) redirect('/login')

  // Badge the tab so nothing waiting gets missed.
  const supabase = await createClient()
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
  const count = (regs ?? 0) + (books ?? 0)

  return (
    <div className="staff-shell">
      <div className="sbar">
        <div className="shell sbar-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="sbar-mark" src="/logo.png" alt="" width={28} height={28} />
          <span className="sbar-title">Caesar&rsquo;s &middot; Staff</span>
          <span className="chip">
            {staff.full_name} &middot; {staff.role}
          </span>
          <SignOutButton />
        </div>
      </div>

      <StaffTabs role={staff.role} pending={count ?? 0} />

      <div className="shell">{children}</div>
    </div>
  )
}
