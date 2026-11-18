import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '../components/site-header'
import { Meander } from '../components/stars'

export const metadata: Metadata = {
  title: "Privacy notice | Caesar's Boxing Gym",
  description:
    'What Caesar’s Boxing Gym does with the details you give when you register or book a session, who sees them and how long they are kept.',
}

const UPDATED = '18 November 2026'
const EMAIL = 'contact@caesarsboxing.co.uk'

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />

      <main className="band">
        <div className="shell reg-shell">
          <div className="band-head">
            <p className="eyebrow">Privacy notice</p>
            <h1 className="sect-title">What we do with your details</h1>
            <p className="lede">
              The short version: your details stay with the gym. Coaches use them to run sessions
              and keep people safe. We never sell them or pass them on for marketing.
            </p>
          </div>

          <div className="prose">
            <h2>Who we are</h2>
            <p>
              Caesar&rsquo;s Boxing Gym, 266A Shaftmoor Lane, Birmingham B28 8ST. The gym is
              responsible for the details you give us (in data protection terms, the
              &ldquo;controller&rdquo;). For anything on this page, email{' '}
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>, ring{' '}
              <a href="tel:+447568402875">07568 402875</a> or speak to a coach.
            </p>

            <h2>What we collect</h2>
            <ul>
              <li>
                <b>When you ask for a place in a session:</b> name, date of birth, phone number,
                email if you give one, and anything you add in the note.
              </li>
              <li>
                <b>When you register:</b> the above plus address, an emergency contact, anything
                you tell us about health or injuries and, for under 18s, a parent or
                guardian&rsquo;s name, phone number and consent.
              </li>
              <li>
                <b>Once you train with us:</b> which sessions you booked and attended, and what
                you paid, when and how (cash or card). We never see or store card numbers; card
                payments are handled by SumUp.
              </li>
              <li>
                <b>Photos and video:</b> only if you have said yes on the registration form.
              </li>
            </ul>

            <h2>Why we need it</h2>
            <ul>
              <li>To hold your place in a session and keep a register of who is in the gym.</li>
              <li>To put you in the right class for your age.</li>
              <li>
                To contact you about a booking, a change to a session or money owed, and to send a
                welcome email when you join.
              </li>
              <li>
                To keep you safe: so a coach knows about an injury or condition, and who to ring
                in an emergency.
              </li>
              <li>To keep a record of payments, as any business has to.</li>
            </ul>
            <p>We do not send marketing emails or texts.</p>

            <h2>Our legal grounds</h2>
            <p>
              We use most of your details because we need them to provide the sessions you have
              asked for, and because the gym has a legitimate interest in running safely and
              keeping proper records. Health information, and photos or video, are only used with
              your consent, which you give on the form and can withdraw at any time by telling a
              coach. Payment records are kept because the law requires it.
            </p>

            <h2>Who sees it</h2>
            <p>
              The gym&rsquo;s coaches and the people who run the gym, through a staff login.
              Nobody else. A few companies store or carry the information on our behalf and only
              act on our instructions:
            </p>
            <ul>
              <li>Supabase, which hosts the secure database behind this website.</li>
              <li>Resend, which delivers our emails.</li>
              <li>SumUp, which takes card payments.</li>
              <li>GitHub, which hosts the website pages.</li>
            </ul>
            <p>
              Some of these companies may store information outside the UK. Where they do, it is
              covered by the safeguards UK law requires. We would only share details with anyone
              else if the law required it or someone&rsquo;s safety was at risk, for example with
              the emergency services.
            </p>

            <h2>Children</h2>
            <p>
              Many of our members are under 18. A parent or guardian should fill in the forms for
              a child, and we need a parent or guardian&rsquo;s consent on record before an under
              18 trains. Parents and guardians can ask to see, correct or delete their
              child&rsquo;s details at any time.
            </p>

            <h2>How long we keep it</h2>
            <ul>
              <li>
                <b>Member details:</b> while you train with us, and for up to two years after your
                last session, then deleted.
              </li>
              <li>
                <b>Requests that do not lead to membership:</b> deleted within twelve months.
              </li>
              <li>
                <b>Payment records:</b> six years, as tax law requires.
              </li>
            </ul>

            <h2>Your rights</h2>
            <p>
              You can ask us for a copy of what we hold about you, ask us to correct it or delete
              it, ask us to stop or limit how we use it, and withdraw any consent you have given.
              It is free, and we will reply within a month. Email{' '}
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a> or speak to a coach.
            </p>
            <p>
              If you are unhappy with how we have handled your details, please tell us first. You
              also have the right to complain to the Information Commissioner&rsquo;s Office at{' '}
              <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">
                ico.org.uk
              </a>{' '}
              or on 0303 123 1113.
            </p>

            <h2>Cookies</h2>
            <p>
              This website does not use advertising or tracking cookies. The only thing stored in
              a browser is what keeps a coach signed in to the staff area.
            </p>

            <h2>Changes</h2>
            <p>
              If we change how we use your details we will update this page. Last updated{' '}
              {UPDATED}.
            </p>
          </div>
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
