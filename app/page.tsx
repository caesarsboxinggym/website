import { Home } from './home'
import ComingSoon from './coming-soon/page'

/**
 * The front door. While NEXT_PUBLIC_COMING_SOON=1 (set in .env.production)
 * visitors get the coming soon page and the full home page waits at /preview.
 * Remove that line and push to launch.
 */
export default function Page() {
  return process.env.NEXT_PUBLIC_COMING_SOON === '1' ? <ComingSoon /> : <Home />
}
