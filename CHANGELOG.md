# Changelog

## M1 — Skeleton and design tokens

Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4.

- `styles/tokens.css`: section 8 tokens (warm paper ground, shu vermilion accent,
  radii, shadows, blur, type scale, spring easings) with light/dark and a
  `prefers-reduced-motion` path.
- `app/globals.css`: Tailwind theme bridge onto the tokens, base typography,
  `.frosted` / `.pulse-once` / `.shimmer` utilities, minimal print rules.
- Home screen: oversized "Where is…" field, quiet ground, two 56 px round
  targets in the thumb zone (Scan, Add) with Add in the single accent.
- PWA: `app/manifest.ts`, generated icon set (`scripts/make-icons.mjs`, no
  image dependencies), hand-rolled `public/sw.js` (shell precache, network-first
  navigations, cache-first build assets, `/api/*` never cached).
- `lib/store.ts` (Zustand: UI state only), `lib/role.tsx` (`useRole` + `<Can>`)
  wired early so later milestones never scatter role checks.
