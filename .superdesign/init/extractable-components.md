# Extractable Components

## High-Value Candidates

### App Sidebar Shell

- Source: `app/(app)/layout.tsx`
- Why: already establishes the authenticated dashboard visual language.
- Extractability: medium
- Note: probably not needed for this specific task because the route already renders inside it.

### Technique Filter Sidebar

- Source today: `app/(app)/technique-library/page.tsx`
- Why: clear standalone panel with repeated filter-row/button patterns.
- Extractability: high
- Suggested future component: `TechniqueLibraryFilterSidebar`

### Technique Card

- Source today: `app/(app)/technique-library/page.tsx`
- Why: self-contained media card repeated in a responsive grid.
- Extractability: high
- Suggested future component: `TechniqueLibraryCard`

### Creator Plan Card

- Source today: `app/(app)/technique-library/page.tsx`
- Why: repeated merchandising card block with common structure.
- Extractability: high
- Suggested future component: `CreatorGameplanCard`
