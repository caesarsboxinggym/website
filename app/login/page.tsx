import { Suspense } from 'react'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <div className="login-wrap">
      {/* LoginForm reads ?next= from the URL, so it needs a boundary to
          prerender behind. */}
      <Suspense fallback={<div className="login" style={{ minHeight: 320 }} />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
