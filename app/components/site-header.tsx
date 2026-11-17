'use client'

import { useState } from 'react'
import Link from 'next/link'

const LINKS = [
  { href: '/#classes', label: 'Timetable' },
  { href: '/#offer', label: 'What we do' },
  { href: '/book', label: 'Book' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#reviews', label: 'Reviews' },
  { href: '/register', label: 'Register' },
  { href: '/#contact', label: 'Contact' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="topbar">
      <div className="shell topbar-in">
        <Link className="brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mark" src="/logo.png" alt="" width={40} height={40} />
          <span className="brand-name">
            Caesar&rsquo;s<span>Boxing Gym</span>
          </span>
        </Link>

        <nav className="nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <Link className="btn-staff" href="/staff">
          Staff login
        </Link>

        <button
          className="btn-burger"
          type="button"
          aria-expanded={open}
          aria-controls="drawer"
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width={18} height={14} viewBox="0 0 18 14" fill="none" aria-hidden="true">
            <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth={1.6} />
          </svg>
        </button>
      </div>

      <nav className={open ? 'drawer open' : 'drawer'} id="drawer">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
