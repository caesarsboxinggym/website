/**
 * Prefix for anything Next does not rewrite itself (plain <img> and <a>).
 *
 * Empty on a custom domain. On the default GitHub Pages address the site
 * lives under /<repo>, and the deploy workflow sets this to match.
 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const LOGO = `${BASE}/logo.png`
