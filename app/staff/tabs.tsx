'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function StaffTabs({ role, pending }: { role: string; pending: number }) {
  // the static build serves /staff/week/, the tabs link to /staff/week
  const path = usePathname().replace(/\/$/, '') || '/'

  const tabs = [
    { href: '/staff', label: 'Tonight' },
    { href: '/staff/week', label: 'This week' },
    { href: '/staff/members', label: 'Members' },
    { href: '/staff/requests', label: 'Requests', badge: pending },
    ...(role === 'admin'
      ? [
          { href: '/staff/balances', label: 'Balances' },
          { href: '/staff/timetable', label: 'Timetable' },
        ]
      : []),
  ]

  return (
    <div className="tabs">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="tab"
          aria-current={path === t.href ? 'page' : undefined}
        >
          {t.label}
          {'badge' in t && t.badge ? <span className="tab-badge">{t.badge}</span> : null}
        </Link>
      ))}
    </div>
  )
}
