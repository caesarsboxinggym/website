import type { NextConfig } from 'next'

/**
 * Static export: `next build` writes plain HTML/CSS/JS to ./out, which GitHub
 * Pages serves as-is. There is no server — every page talks to Supabase from
 * the browser, and row-level security is what protects the data.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  // /book -> /book/index.html, which is the layout GitHub Pages serves cleanly
  trailingSlash: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
}

export default nextConfig
