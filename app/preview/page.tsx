import type { Metadata } from 'next'
import { Home } from '../home'

/** The full home page, kept reachable while the front door shows coming soon. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function Preview() {
  return <Home />
}
