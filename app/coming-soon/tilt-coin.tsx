'use client'

import { useRef, type PointerEvent, type ReactNode } from 'react'

/**
 * The medallion leans toward the pointer and a highlight follows it across
 * the metal. Mouse only — on touch, and with reduced motion, it stays still
 * and the CSS light sweep does the work.
 */
export function TiltCoin({
  className,
  glareClassName,
  children,
}: {
  className: string
  glareClassName: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height

    el.style.setProperty('--ry', `${(x - 0.5) * 22}deg`)
    el.style.setProperty('--rx', `${(0.5 - y) * 22}deg`)
    el.style.setProperty('--gx', `${x * 100}%`)
    el.style.setProperty('--gy', `${y * 100}%`)
    el.style.setProperty('--glare', '1')
  }

  function onLeave() {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--glare', '0')
  }

  return (
    <div ref={ref} className={className} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
      <span className={glareClassName} aria-hidden="true" />
    </div>
  )
}
