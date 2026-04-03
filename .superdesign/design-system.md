# BJJMAXXING Design System Notes

## Brand Direction

- Dark, technical, competitive training product.
- Interfaces mix premium dashboard surfaces with fight-camp energy.
- Accent color family leans orange, gold, and warm clay rather than neon purple or generic SaaS blue.

## Surface Rules

- Prefer layered dark backgrounds over flat fills.
- Use subtle white-alpha borders to separate cards without killing contrast.
- Cards often combine:
  - dark fill
  - faint inset highlight
  - medium-large radius
  - warm hover accent

## Typography

- Headlines skew bold/black, uppercase, and compressed via tracking tweaks.
- Supporting text uses softer white alpha and compact copy blocks.
- Existing app could be more consistent about applying `Clash Grotesk` / `Plus Jakarta Sans`; new UI should stay compatible with current Tailwind setup unless the route intentionally opts into those classes.

## Interaction Rules

- Hover motion is small and directional, usually `-translate-y-1`.
- CTA emphasis uses fill color first, not giant glow effects.
- Search and filter controls should feel tactile and dense, more like a control room than a marketing page.

## Route-Specific Guidance For Technique Library

- Keep the current product-shell aesthetic.
- Build filters as a structured tool panel, not decorative chips scattered through the page.
- Mobile must preserve filter access via an explicit drawer/sheet or stacked collapsible block.
