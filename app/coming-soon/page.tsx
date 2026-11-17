import type { Metadata } from 'next'
import { Meander } from '../components/stars'
import { TiltCoin } from './tilt-coin'
import s from './coming-soon.module.css'

export const metadata: Metadata = {
  title: "Coming soon | Caesar's Boxing Gym",
  description:
    "The new Caesar's Boxing Gym website is on its way. The gym is open Monday to Thursday at 266A Shaftmoor Lane, Birmingham.",
}

const MAPS =
  'https://www.google.com/maps/search/Caesar%27s+Boxing+Gym+266A+Shaftmoor+Ln+Birmingham'
const INSTAGRAM = 'https://instagram.com/caesarsboxing'
const FACEBOOK = 'https://www.facebook.com/p/Caesars-Boxing-Gym-Birmingham-61581157987666/'

const RING_TEXT =
  "COMING SOON ✦ CAESAR'S COMMUNITY BOXING GYM ✦ BIRMINGHAM ✦ VENI · VIDI · VICI ✦ "

export default function ComingSoon() {
  return (
    <main className={s.page}>
      <div className={s.embers} aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} />
        ))}
      </div>

      <Meander />

      <div className={s.body}>
        <div className={s.stage}>
          {/* lettering that turns slowly around the rim, like a coin legend */}
          <svg className={s.ring} viewBox="0 0 400 400" aria-hidden="true">
            <defs>
              <path
                id="cs-rim"
                d="M200,200 m-187,0 a187,187 0 1,1 374,0 a187,187 0 1,1 -374,0"
              />
            </defs>
            <text>
              <textPath href="#cs-rim" textLength={1168} lengthAdjust="spacing">
                {RING_TEXT}
              </textPath>
            </text>
          </svg>

          <TiltCoin className={s.coin} glareClassName={s.glare}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Caesar's Boxing Gym medallion" width={560} height={560} />
          </TiltCoin>
        </div>

        <div className={s.copy}>
          <p className={s.kicker}>
            <span>Seconds out</span>
          </p>

          <h1 className={s.title}>
            Coming <span>Soon</span>
          </h1>

          <p className={s.sub}>
            The gym is open. The new website is still lacing up &mdash; online booking is on
            its way. Until then, turn up and pay at the door.
          </p>

          <div className={s.cta}>
            <a className="btn btn-solid" href={MAPS} target="_blank" rel="noreferrer">
              Find the gym
            </a>
            <a className="btn btn-ghost" href={INSTAGRAM} target="_blank" rel="noreferrer">
              Follow on Instagram
            </a>
          </div>

          <ul className={s.facts}>
            <li>
              <b>Mon&ndash;Thu</b> evenings
            </li>
            <li>
              <b>&pound;3</b> kids
            </li>
            <li>
              <b>&pound;5</b> a session
            </li>
            <li>
              <b>&pound;10</b> a week
            </li>
          </ul>
        </div>
      </div>

      <footer className={s.foot}>
        <Meander />
        <p>
          266A Shaftmoor Lane, Birmingham B28 8ST &middot;{' '}
          <a href="tel:+447568402875">07568 402875</a> &middot;{' '}
          <a href={FACEBOOK} target="_blank" rel="noreferrer">
            Facebook
          </a>
        </p>
      </footer>
    </main>
  )
}
