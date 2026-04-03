# Shared Layouts

## `app/(app)/layout.tsx`

Primary authenticated shell for application routes.

### Key UI Characteristics

- Fixed left sidebar on desktop (`lg:flex`) with collapsible widths: `w-64` expanded, `w-24` collapsed.
- Sidebar contains:
  - collapse button
  - profile card
  - optional gameplan module
  - main navigation links including `/technique-library`
- Content area is offset by sidebar width via `lg:pl-64` or `lg:pl-24`.
- Sidebar styling already matches the visual tone needed for a filter rail:
  - dark gradient background
  - subtle border
  - soft backdrop blur
  - layered cards inside

### Implication For Technique Library

- The route already lives inside one sidebar system.
- Any new "sidebar filters" for the page should not visually compete with or duplicate the app shell sidebar.
- The safest implementation path is a secondary in-page filter column inside the route content, with a mobile drawer/sheet fallback.
