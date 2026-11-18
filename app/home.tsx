'use client'

import { createClient } from '@/lib/supabase/client'
import { useData } from '@/lib/use-data'
import { SiteHeader } from './components/site-header'
import { Stars, Meander } from './components/stars'
import Link from 'next/link'
import { one } from '@/lib/pg'
import { LOGO } from '@/lib/base'

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** "18:00:00" -> "18:00" */
function hhmm(t: string) {
  return t.slice(0, 5)
}

type ClassRef = {
  name: string
  min_age: number | null
  max_age: number | null
  invite_only?: boolean
}

type Slot = {
  weekday: number
  starts: string
  ends: string
  class_types: ClassRef | ClassRef[] | null
}

function ageNote(min: number | null, max: number | null) {
  if (min && max) return `Ages ${min}–${max}`
  if (min) return `Ages ${min} and up`
  return null
}

type ClassType = { name: string; slug: string; description: string | null }

type Review = {
  id: string
  author_name: string
  rating: number
  body: string
  reviewed_on: string | null
}

/** The timetable, classes and reviews, read from Supabase in the browser. */
async function load() {
  const supabase = createClient()

  const [{ data: slots }, { data: classes }, { data: reviews }] = await Promise.all([
    supabase
      .from('schedule_slots')
      .select('weekday, starts, ends, class_types (*)')
      .eq('active', true)
      .order('weekday')
      .order('starts'),
    supabase
      .from('class_types')
      .select('name, slug, description')
      .eq('active', true)
      .order('sort'),
    supabase
      .from('google_reviews')
      .select('id, author_name, rating, body, reviewed_on')
      .eq('visible', true)
      .order('sort'),
  ])

  return {
    slots: (slots ?? []) as unknown as Slot[],
    classes: (classes ?? []) as ClassType[],
    reviews: (reviews ?? []) as Review[],
  }
}

export function Home() {
  // undefined until the data lands; the rest of the page is already on screen
  const { data } = useData(load)
  const slots = data?.slots
  const classes = data?.classes
  const reviews = data?.reviews

  // group the weekly pattern into day cards
  const byDay = new Map<number, Slot[]>()
  for (const s of slots ?? []) {
    if (!byDay.has(s.weekday)) byDay.set(s.weekday, [])
    byDay.get(s.weekday)!.push(s)
  }
  const days = [...byDay.entries()].sort((a, b) => a[0] - b[0])
  const sessionCount = (slots ?? []).length

  return (
    <>
      <SiteHeader />

      <main id="top">
        <section className="hero">
          <div className="shell hero-in">
            <div className="coin">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO} alt="Caesar's Boxing Gym medallion" width={560} height={560} />
            </div>
            <div className="hero-copy">
              <h1 className="hero-title">
                Caesar&rsquo;s<em>Boxing Gym</em>
              </h1>
              <p className="hero-sub">
                Boxing for kids, fighters and adults &mdash; plus circuits and a ladies
                bootcamp. Four nights a week on Shaftmoor Lane. Turn up, pay at the door.
              </p>
              <div className="hero-cta">
                <Link className="btn btn-solid" href="/book">
                  Book a session
                </Link>
                <a className="btn btn-ghost" href="#classes">
                  See the timetable
                </a>
              </div>
              {reviews && reviews.length > 0 && (
                <a className="hero-rating" href="#reviews">
                  <Stars rating={5} />
                  <span>5.0 from 7 Google reviews</span>
                </a>
              )}
              <div className="hero-strip">
                <div>
                  <b>&pound;3</b> kids
                </div>
                <div>
                  <b>&pound;5</b> a session
                </div>
                <div>
                  <b>&pound;10</b> a week
                </div>
              </div>
            </div>
          </div>
        </section>

        <Meander />

        {/* TIMETABLE */}
        <section className="band" id="classes">
          <div className="shell">
            <div className="band-head">
              <p className="eyebrow">Weekly timetable</p>
              <h2 className="sect-title">
                {slots
                  ? `${days.length} nights a week, ${sessionCount} sessions`
                  : 'Monday to Thursday'}
              </h2>
            </div>

            <div className="week">
              {days.map(([weekday, daySlots]) => (
                <div className="day" key={weekday}>
                  <div className="day-head">
                    <span className="day-name">{DAYS[weekday]}</span>
                    <span className="day-count">
                      {daySlots.length} session{daySlots.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {daySlots.map((s, i) => {
                    const ct = one(s.class_types)
                    const ages = ageNote(ct?.min_age ?? null, ct?.max_age ?? null)
                    return (
                      <div className="slot" key={i}>
                        <span className="slot-time">{hhmm(s.starts)}</span>
                        <span className="slot-body">
                          <span className="slot-name">{ct?.name}</span>
                          <span className="slot-meta">
                            {ages ? `${ages} · ` : ''}
                            until {hhmm(s.ends)}
                            {ct?.invite_only ? ' · invite only' : ''}
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHAT WE DO */}
        <section className="band band-alt" id="offer">
          <div className="shell">
            <div className="band-head">
              <p className="eyebrow">What we do</p>
              <h2 className="sect-title">
                {classes ? `${classes.length} classes, all` : 'All'} ages from six up
              </h2>
              <p className="lede">
                Class names and age bands are the club&rsquo;s own. The descriptions are draft copy.
                <span className="ph">draft copy</span>
              </p>
            </div>

            <div className="offer">
              {(classes ?? []).map((c) => (
                <div className="offer-card" key={c.slug}>
                  <span className="offer-name">{c.name}</span>
                  <p className="offer-copy">{c.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="band" id="pricing">
          <div className="shell">
            <div className="band-head">
              <p className="eyebrow">Pricing</p>
              <h2 className="sect-title">Pay at the door, or pay for the week</h2>
            </div>

            <div className="prices">
              <div className="price">
                <span className="price-name">Kids &middot; 6 to 12</span>
                <span className="price-fig">
                  &pound;3<small>per session</small>
                </span>
                <p className="price-copy">Any session a kid trains in. Pay on the night.</p>
              </div>
              <div className="price price-pick">
                <span className="price-name">Adults</span>
                <span className="price-fig">
                  &pound;5<small>per session</small>
                </span>
                <p className="price-copy">
                  Or <b style={{ color: 'var(--bronze-lit)' }}>&pound;10 for the whole week</b>{' '}
                  &mdash; every class in the week you buy it, including nights earlier that week you
                  haven&rsquo;t paid for yet.
                </p>
              </div>
              <div className="price">
                <span className="price-name">Ladies</span>
                <span className="price-fig">
                  &pound;5<small>per session</small>
                </span>
                <p className="price-copy">
                  The Wednesday bootcamp or any other session &mdash; the same rate.
                </p>
              </div>
            </div>

            <p className="note">
              <b>How the week pass works.</b> It covers the calendar week you buy it in, Monday to
              Sunday &mdash; not the next seven days. Buy one on Thursday and it still settles Monday
              and Tuesday. Cash or card, both taken at the gym; card goes through the club&rsquo;s
              SumUp reader. Monthly at <b>&pound;40</b> is available if you ask a coach.
            </p>
          </div>
        </section>

        {/* REVIEWS */}
        {reviews && reviews.length > 0 && (
          <section className="band band-reviews" id="reviews">
            <div className="shell">
              <div className="band-head">
                <p className="eyebrow">Reviews</p>
                <h2 className="sect-title">Five stars, every one of them</h2>
              </div>

              <div className="rev-score">
                <span className="rev-num">5.0</span>
                <span className="rev-score-body">
                  <Stars rating={5} label="5 out of 5" />
                  <span className="rev-count">
                    7 reviews on Google &middot;{' '}
                    <a
                      href="https://www.google.com/maps/search/Caesar%27s+Boxing+Gym+266A+Shaftmoor+Ln+Birmingham"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Read them on Google
                    </a>
                  </span>
                </span>
              </div>

              <div className="rev-track">
                {reviews.map((r) => (
                  <div className="rev-card" key={r.id}>
                    <Stars rating={r.rating} />
                    <p className="rev-quote">{r.body}</p>
                    <span className="rev-by">
                      <span className="rev-av" aria-hidden="true">
                        {r.author_name.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="rev-who">
                        <span className="rev-name">{r.author_name}</span>
                        <span className="rev-when">
                          {r.reviewed_on
                            ? new Date(r.reviewed_on).toLocaleDateString('en-GB', {
                                month: 'long',
                                year: 'numeric',
                              })
                            : ''}
                        </span>
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <p className="rev-foot">
                <span>Reviews from Google</span>
                <span aria-hidden="true">&middot;</span>
                <a
                  href="https://www.google.com/maps/search/Caesar%27s+Boxing+Gym+266A+Shaftmoor+Ln+Birmingham"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--bronze-lit)',
                    textDecoration: 'none',
                    borderBottom: '1px solid var(--bronze-deep)',
                  }}
                >
                  Leave a review
                </a>
              </p>
            </div>
          </section>
        )}

        <Meander />

        {/* REGISTER + CONTACT */}
        <section className="band band-alt" id="register">
          <div className="shell duo">
            <div>
              <div className="band-head">
                <p className="eyebrow">Registration</p>
                <h2 className="sect-title">One form, once</h2>
              </div>
              <ul className="reg-list">
                <li>Name, phone and address, so a coach can find you on the system.</li>
                <li>
                  Email is optional. Leave it out and we&rsquo;ll chase any unpaid sessions in
                  person, as now.
                </li>
                <li>Next of kin and an emergency contact number.</li>
                <li>Anything a coach should know &mdash; injuries, asthma, medication.</li>
                <li>Age, so the system knows the right class and the right price.</li>
                <li>
                  Under 18s: guardian name, guardian contact and consent, recorded with the date it
                  was given.
                </li>
              </ul>
              <div className="hero-cta" style={{ marginTop: 22 }}>
                <Link className="btn btn-solid" href="/register">
                  Open the form
                </Link>
              </div>
            </div>

            <div id="contact">
              <div className="band-head">
                <p className="eyebrow">Find us</p>
                <h2 className="sect-title">Contact</h2>
              </div>
              <div className="contact-rows">
                <div className="contact-row">
                  <span className="contact-k">Address</span>
                  <span className="contact-v">
                    266A Shaftmoor Lane
                    <br />
                    Birmingham B28 8ST
                  </span>
                </div>
                <div className="contact-row">
                  <span className="contact-k">Phone</span>
                  <span className="contact-v">
                    <a href="tel:+447568402875" style={{ color: 'inherit', textDecoration: 'none' }}>
                      07568 402875
                    </a>
                  </span>
                </div>
                <div className="contact-row">
                  <span className="contact-k">Instagram</span>
                  <span className="contact-v">
                    <a
                      href="https://instagram.com/caesarsboxing"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      @caesarsboxing
                    </a>
                  </span>
                </div>
                <div className="contact-row">
                  <span className="contact-k">Facebook</span>
                  <span className="contact-v">
                    <a
                      href="https://www.facebook.com/p/Caesars-Boxing-Gym-Birmingham-61581157987666/"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      Caesar&rsquo;s Boxing Gym Birmingham
                    </a>
                  </span>
                </div>
                <div className="contact-row">
                  <span className="contact-k">Sessions</span>
                  <span className="contact-v">Monday to Thursday evenings</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="shell foot-in">
          <span>Caesar&rsquo;s Boxing Gym</span>
          <span>266A Shaftmoor Lane, Birmingham B28 8ST &middot; 07568 402875</span>
          <span>
            <a href="https://instagram.com/caesarsboxing">Instagram</a> &middot;{' '}
            <a href="https://www.facebook.com/p/Caesars-Boxing-Gym-Birmingham-61581157987666/">
              Facebook
            </a>
          </span>
          <span>
            <a href="#top">Back to top</a> &middot; <Link href="/privacy">Privacy</Link> &middot;{' '}
            <Link href="/staff">Staff login</Link>
          </span>
        </div>
      </footer>
    </>
  )
}
