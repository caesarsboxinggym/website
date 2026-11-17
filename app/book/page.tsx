import type { Metadata } from 'next'
import { SiteHeader } from '../components/site-header'
import Link from 'next/link'
import { Meander } from '../components/stars'
import { BookLoader } from './book-loader'

export const metadata: Metadata = {
  title: "Book a session | Caesar's Boxing Gym",
  description:
    'Ask for a place in a session at Caesar’s Boxing Gym, Birmingham. A coach confirms it; pay on the night.',
}

export default function BookPage() {
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

          <BookLoader />
        </div>
      </main>

      <Meander />

      <footer className="foot">
        <div className="shell foot-in">
          <span>Caesar&rsquo;s Boxing Gym</span>
          <span>266A Shaftmoor Lane, Birmingham B28 8ST &middot; 07568 402875</span>
          <span>
            <Link href="/">Back to the website</Link>
          </span>
        </div>
      </footer>
    </>
  )
}
