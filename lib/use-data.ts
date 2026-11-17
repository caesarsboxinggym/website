'use client'

import { useEffect, useRef, useState } from 'react'

const EVENT = 'cb:refresh'

/**
 * Tell every mounted useData() to fetch again. Called after anything that
 * writes to the database, so the screen catches up with what was saved.
 */
export function refresh() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

/**
 * Load data in the browser. `data` is undefined until the first load for the
 * current `key` lands; on a refresh the old data stays on screen until the
 * new data replaces it, so nothing flickers.
 */
export function useData<T>(load: () => Promise<T>, key = ''): { data: T | undefined } {
  const [state, setState] = useState<{ key: string; data: T }>()
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let live = true
    const run = () => {
      loadRef
        .current()
        .then((data) => {
          if (live) setState({ key, data })
        })
        .catch((err) => console.error('Could not load data', err))
    }
    run()
    window.addEventListener(EVENT, run)
    return () => {
      live = false
      window.removeEventListener(EVENT, run)
    }
  }, [key])

  return { data: state?.key === key ? state.data : undefined }
}
