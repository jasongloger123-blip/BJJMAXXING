# UI Components Relevant To Technique Library

## Route-Level Component

### `app/(app)/technique-library/page.tsx`

Current page is a self-contained client component with:

- Local filter state:
  - `activeFilter`
  - `query`
  - `fighterFilter`
- Hardcoded stage metadata and creator marketplace cards.
- Technique cards generated from `LONG_FLEXIBLE_GUARD_NODES` plus `staticTechniques`.
- Existing desktop-only left filter rail:
  - stage filter buttons
  - fighter select
  - static creator marketplace promo

## Data / Content Sources

### `lib/nodes.ts`

- Supplies `LONG_FLEXIBLE_GUARD_NODES`.
- Provides node titles, level, videos, prerequisites, `isComingSoon`.
- Current library view derives stage/fighter heuristically from title strings instead of dedicated taxonomy fields.

## Shared App Shell

### `app/(app)/layout.tsx`

- Defines the persistent product sidebar and global navigation frame around the page.

## Observed Gaps In Current UI

- Filters are desktop-only and disappear entirely on smaller breakpoints.
- Stage filters, fighter select, search, and sort are visually split across two regions instead of forming one cohesive filtering system.
- Filter data model is narrow:
  - stage
  - fighter
  - free-text query
- No clear reset action, no active-filter summary, and no result count tied to the filter rail.
