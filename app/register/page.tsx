import type { Metadata } from 'next'
import { SiteHeader } from '../components/site-header'
import Link from 'next/link'
import { Meander } from '../components/stars'
import { RegisterForm } from './form'

export const metadata: Metadata = {
  title: "Register | Caesar's Boxing Gym",
  description:
    'Register with Caesar’s Boxing Gym in Birmingham. Takes two minutes; a coach checks it over and adds you to the system.',
}

export default function RegisterPage() {
  return (
    <>
      <SiteHeader />

      <main className="band">
        <div className="shell reg-shell">
          <div className="band-head">
            <p className="eyebrow">Registration</p>
            <h1 className="sect-title">Register with the gym</h1>
            <p className="lede">
              Two minutes, once. It replaces the paper form, and means a coach has your emergency
              contact to hand if it is ever needed.
            </p>
          </div>

          <RegisterForm />
        </div>
      </main>

      <Meander />

      <footer className="foot">
        <div className="shell foot-in">
          <span>Caesar&rsquo;s Boxing Gym</span>
          <span>266A Shaftmoor Lane, Birmingham B28 8ST &middot; 07568 402875</span>
          <span>
            <Link href="/">Back to the website</Link> &middot; <Link href="/privacy">Privacy</Link>
          </span>
        </div>
      </footer>
    </>
  )
}
