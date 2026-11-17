import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Caesar's Boxing Gym | Birmingham",
  description:
    'Community boxing gym on Shaftmoor Lane, Birmingham. Kids, teenagers, fighters and adults, Monday to Thursday. £5 a session or £10 for the week.',
  openGraph: {
    title: "Caesar's Boxing Gym",
    description:
      'Community boxing gym in Birmingham. Kids from six, fighters, adults, circuits and a ladies bootcamp.',
    type: 'website',
    locale: 'en_GB',
  },
}

export const viewport: Viewport = {
  themeColor: '#120E0A',
  width: 'device-width',
  initialScale: 1,
}

/** Drawn once, referenced by every divider and star on the site. */
function SvgDefs() {
  return (
    <svg width={0} height={0} aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        {/* Greek-key fret, lifted from the medallion's rim */}
        <pattern id="fret" patternUnits="userSpaceOnUse" width={24} height={16}>
          <path
            d="M2 14 V2 H20 V11 H9 V7 H15"
            fill="none"
            stroke="#7A5A31"
            strokeWidth={1.6}
            strokeLinecap="square"
          />
        </pattern>
        <symbol id="star" viewBox="0 0 16 16">
          <path d="M8 1.1l2.05 4.16 4.59.67-3.32 3.24.78 4.57L8 11.55l-4.1 2.19.78-4.57L1.36 5.93l4.59-.67z" />
        </symbol>
      </defs>
    </svg>
  )
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>
        <SvgDefs />
        {children}
      </body>
    </html>
  )
}
