'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getStaff } from '@/lib/staff'
import { LOGO } from '@/lib/base'

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Only ever send people to a page on this site.
  const wanted = params.get('next')
  const next = wanted && wanted.startsWith('/') && !wanted.startsWith('//') ? wanted : '/staff'

  // Already signed in as staff: skip the form.
  useEffect(() => {
    getStaff().then((staff) => {
      if (staff) router.replace(next)
    })
  }, [router, next])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Turn the two errors that actually happen into something actionable.
      const code = (error as { code?: string }).code
      setError(
        code === 'invalid_credentials'
          ? 'That email and password do not match an account.'
          : code === 'email_not_confirmed'
            ? 'This account has not been confirmed yet. An admin can confirm it under Authentication → Users in Supabase.'
            : error.message
      )
      setBusy(false)
      return
    }

    router.replace(next)
  }

  return (
    <form className="login" onSubmit={onSubmit}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="login-mark" src={LOGO} alt="" width={56} height={56} />
      <h2>Staff sign in</h2>

      <div className="field">
        <label htmlFor="em">Email</label>
        <input
          id="em"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="pw">Password</label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      {error && <p className="sheet-warn">{error}</p>}

      <button className="btn-record" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="login-note">Accounts are created by an admin. There is no public sign-up.</p>
      <p className="login-note">
        <Link href="/" style={{ color: 'var(--bronze-lit)' }}>
          Back to the website
        </Link>
      </p>
    </form>
  )
}
