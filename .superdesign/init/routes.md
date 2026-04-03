# Route Inventory

- `/` -> `app/page.tsx`
- `/login` -> `app/login/page.tsx`
- `/register` -> `app/register/page.tsx`
- `/pricing` -> `app/pricing/page.tsx`
- `/archetype-test` -> `app/archetype-test/page.tsx`
- `/profile` -> `app/(app)/profile/page.tsx`
- `/gameplan` -> `app/(app)/gameplan/page.tsx`
- `/technique-library` -> `app/(app)/technique-library/page.tsx`
- `/node/[id]` -> `app/(app)/node/[id]/page.tsx`
- `/admin/reviews` -> `app/(app)/admin/reviews/page.tsx`

# Notes

- Authenticated application pages are wrapped by `app/(app)/layout.tsx`.
- `Technique Library` is a first-class nav item in the shared app sidebar.
- The requested design work targets the existing `/technique-library` route.
