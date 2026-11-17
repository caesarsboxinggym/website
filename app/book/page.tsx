import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '../components/site-header'
import { Meander } from '../components/stars'
import { Booker, type Slot } from './booker'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Book a session | Caesar's Boxing Gym",
  description:
    'Ask for a place in a session at Caesar’s Boxing Gym, Birmingham. A coach confirms it; pay on the night.',
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default async function BookPage() {
  const supabase = await createClient()

  const from = new Date()
  const to = new Date()
  to.setDate(to.getDate() + 13)

  const { data, error } = await supabase
    .from('session_availability')
    .select('id, session_date, starts, ends, class_name, min_age, max_age, capacity, places_left')
    .gte('session_date', iso(from))
    .lte('session_date', iso(to))
    .order('session_date')
    .order('starts')

  const slots = (data ?? []) as Slot[]

  return (
    <>
      <SiteHeader />

      <main className="band">
        <div className="shell reg-shell">
          <div className="band-head">
            <p className="eyebrow">Book a session</p>
            <h1 className="sect-title">Pick a session, we&rsquo;ll save you a spot</h1>
            <p className="lede">
              The next two weeks. Every session takes 25, so places are shown as they go. A coach
              confirms your place &mdash; nothing to pay until you turn up.
            </p>
          </div>

          {error ? (
            <div className="note">
              <b>Could not load the sessions.</b> Ring the gym on 07568 402875 and a coach will
              sort you out.
            </div>
          ) : (
            <Booker slots={slots} />
          )}
        </div>
      </main>

      <Meander />

      <footer className="foot">
        <div className="shell foot-in">
          <span>Caesar&rsquo;s Boxing Gym</span>
          <span>266A Shaftmoor Lane, Birmingham B28 8ST &middot; 07568 402875</span>
          <span>
            <a href="/">Back to the website</a>
          </span>
        </div>
      </footer>
    </>
  )
}
