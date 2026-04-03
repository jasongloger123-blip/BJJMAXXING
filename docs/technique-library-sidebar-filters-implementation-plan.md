# Technique Library Sidebar Filters Implementation Plan

## Status

- Requested design source:
  - Project ID: `4ccad302-012d-4555-b5b6-65c4bd549ff2`
  - Draft ID: `e3f29154-cf35-4560-92bc-b5fcfe0abbbe`
- Superdesign CLI is installed locally (`0.3.3`).
- Fetch attempt is currently blocked by Superdesign permissions:
  - `API key does not have access to this project`

This plan is therefore based on the current codebase structure and the known target scope ("Technik Bibliothek - Sidebar Filters"), and should be reconciled against the actual draft once project access is available.

## Current Baseline In Code

- Route: `app/(app)/technique-library/page.tsx`
- Existing filter UX:
  - desktop-only left rail
  - stage buttons
  - fighter dropdown
  - top search input
  - placeholder sort button
- Existing data model:
  - `activeFilter` for stage
  - `fighterFilter`
  - `query`

## Implementation Goal

Turn the route into a cohesive filter-driven library page where sidebar filters feel like a first-class navigation/control system instead of a partial desktop add-on.

## Proposed Scope

### 1. Refactor UI into Smaller Route Components

- Extract the current inline page into focused pieces:
  - `components/technique-library/TechniqueLibraryFilterSidebar.tsx`
  - `components/technique-library/TechniqueLibraryToolbar.tsx`
  - `components/technique-library/TechniqueLibraryGrid.tsx`
  - `components/technique-library/CreatorPlansStrip.tsx`
- Keep route assembly in `app/(app)/technique-library/page.tsx`.

### 2. Unify Filter State

- Replace ad-hoc local state with a single filter object, for example:
  - `stage`
  - `fighter`
  - `query`
  - `sort`
  - `showLocked` or `availability`
- Centralize derived collections:
  - unique fighter list
  - counts per stage
  - active filter chips
  - filtered result count

### 3. Build a Real Sidebar Filter System

- Sidebar should own all filtering controls, not just stage and fighter.
- Recommended sections:
  - result summary
  - search
  - stage filters
  - fighter filters
  - availability / locked toggle
  - sort options
  - reset filters action
- Keep the current creator marketplace promo separate from pure filters, either:
  - as a footer block below controls, or
  - moved out of the filter rail if the design prioritizes utility density

### 4. Add Mobile Filter Access

- Current `aside` is hidden below `lg`.
- Introduce a mobile trigger near the header:
  - `Filters`
  - active filter count badge
- Reuse the same filter content in:
  - desktop sticky sidebar
  - mobile slide-over / drawer / accordion panel

### 5. Improve Filtering Feedback

- Show active filter chips above the grid.
- Add clear empty-state copy when no techniques match.
- Add a visible result count tied to the active filter set.
- Make reset action always one click away.

### 6. Reduce Heuristic Fragility

- Current stage and fighter mapping is guessed from title strings.
- If this page will keep growing, move toward explicit taxonomy fields on technique data rather than relying on `guessStage()` and `guessFighter()`.
- Short-term:
  - keep heuristics but isolate them in route-level helpers
- Mid-term:
  - add explicit metadata in `lib/nodes.ts` or a library-specific adapter layer

## Recommended File Changes

- Update `app/(app)/technique-library/page.tsx`
- Add `components/technique-library/TechniqueLibraryFilterSidebar.tsx`
- Add `components/technique-library/TechniqueLibraryToolbar.tsx`
- Add `components/technique-library/TechniqueLibraryGrid.tsx`
- Add `components/technique-library/ActiveTechniqueFilters.tsx`
- Optional: add `components/technique-library/CreatorPlansStrip.tsx`

## Styling Direction

- Stay inside the established BJJMAXXING shell:
  - dark layered surfaces
  - subtle borders
  - orange/gold active accents
  - bold uppercase control labels
- Make the filter rail feel denser and more structured than the current loose card stack.
- Prefer sticky behavior on desktop if the draft supports it.

## Delivery Sequence

1. Extract current page UI into components without changing behavior.
2. Consolidate filter state and derived selectors.
3. Rebuild the sidebar around the consolidated filter schema.
4. Add mobile filter drawer using the same filter content component.
5. Add active-chip row, reset action, and empty state.
6. Reconcile spacing, hierarchy, and merchandising placement against the real Superdesign draft once access is restored.

## Open Dependencies

- Need access to the Superdesign project/draft to verify:
  - exact section order
  - mobile behavior
  - filter categories beyond stage/fighter/search
  - whether the creator marketplace block stays inside the sidebar
  - spacing, sticky behavior, and CTA treatment
