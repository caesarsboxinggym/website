export function Stars({ rating = 5, label }: { rating?: number; label?: string }) {
  const filled = Math.round(rating)

  return (
    <span
      className="stars"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className={n <= filled ? undefined : 'dim'} aria-hidden="true">
          <use href="#star" />
        </svg>
      ))}
    </span>
  )
}

export function Meander() {
  return (
    <svg className="meander" aria-hidden="true">
      <rect width="100%" height={16} fill="url(#fret)" />
    </svg>
  )
}
