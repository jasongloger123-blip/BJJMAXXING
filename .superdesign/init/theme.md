# Theme Summary

## Global Fonts

- `app/globals.css` imports `Clash Grotesk` and `Plus Jakarta Sans`.
- Tailwind `fontFamily.sans` and `fontFamily.display` still point to `Inter`, so most app UI currently renders in an Inter/system stack unless explicit utility classes are added.

## Tailwind Brand Tokens

- `bjj-bg`: `#11161f`
- `bjj-surface`: `#161d29`
- `bjj-panel`: `#1c2432`
- `bjj-card`: `#20293a`
- `bjj-border`: `#313d54`
- `bjj-orange`: `#c56b46`
- `bjj-orange-dark`: `#8c4a2f`
- `bjj-orange-light`: `#de8a61`
- `bjj-gold`: `#d4875f`
- `bjj-coal`: `#10151f`
- `bjj-text`: `#eef2f8`
- `bjj-muted`: `#9aa7bd`
- `bjj-green`: `#22c55e`
- `bjj-locked`: `#374151`

## Existing Visual Language

- Dark martial-arts dashboard aesthetic with layered gradients and glassy panels.
- Borders are usually low-contrast white alpha strokes (`border-white/5`, `border-white/10`).
- Rounded corners are aggressive: `rounded-xl` up to `rounded-[1.8rem]` and `rounded-3xl`.
- Accent color is warm orange/gold, used for CTA fills, status pills, and hover/focus emphasis.
- Body background is assembled from multiple radial and linear gradients in `app/globals.css`.

## Relevant Global CSS

- `body` owns the ambient background and grid-like overlay.
- Shared utility surfaces: `.glass`, `.fluid-panel`, `.fluid-surface`, `.fluid-stage`, `.fluid-node`.
- Motion is subtle and mostly fade/float/shimmer based.
