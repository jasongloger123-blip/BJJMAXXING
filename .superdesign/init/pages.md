# Page Dependency Tree

## `/technique-library`

### Primary File

- `app/(app)/technique-library/page.tsx`

### Imported Local Dependencies

- `lib/nodes.ts`

### Shared Shell Dependencies

- `app/(app)/layout.tsx`
- `app/globals.css`
- `tailwind.config.js`

### UI Scope Notes

- The page currently contains all route-specific UI inline.
- There are no extracted filter or card subcomponents yet.
- Refactoring the sidebar filters is a good candidate for splitting into local components, for example:
  - `components/technique-library/FilterSidebar.tsx`
  - `components/technique-library/TechniqueToolbar.tsx`
  - `components/technique-library/ActiveFilterChips.tsx`
