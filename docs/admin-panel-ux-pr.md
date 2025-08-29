Title: Admin panel UX: tabbed layout, overview stats, CSV preview, user search, and safer delete dialogs

Summary
- Reorganizes the admin experience into clear tabs (Overview, Drawing, Inventory, Users).
- Adds a dashboard-style Overview with auction status and key stats.
- Improves CSV user import with preview-and-confirm and a template download.
- Adds live search for users and replaces browser confirms with AlertDialog.

Changes
- src/app/admin/page.tsx
  - Add Tabs (Overview | Drawing | Inventory | Users).
  - Overview: status badge and stat cards (Prizes, Tiers, Users, Tickets, Winners) with icons.
  - Users: CSV parsing on file select, preview (first 10 + total), Confirm Upload button, template download, search box, refined list display.
  - Minor copy/UX polish and toasts remain.
- src/components/FirebasePrizeManager.tsx
  - Replace confirm() prompts with AlertDialog for deleting prizes and tiers.

Rationale
- Makes admin actions discoverable, grouped, and safer.
- Reduces import mistakes via preview + template.
- Elevates key signals (auction state, totals) to the top.

Testing
- Verified type-check and build locally.
- Manual tests:
  - Load Overview: stats render as expected.
  - Drawing tab: existing WinnerDrawing behavior unchanged.
  - Inventory tab: Prize/Tier CRUD works; delete shows confirmation.
  - Users tab: CSV select -> preview renders; Confirm Upload writes users and refreshes list; search filters by name/employeeId/facility.

Notes
- Firestore rules must allow reads/writes as configured; public read on users is required for PIN login (or adapt login flow).
- If rules require auth, sign in via /firebase-login first.

Screenshots
- N/A (purely presentational updates based on existing components).

Checklist
- [x] No breaking API changes
- [x] UI consistent with existing design system
- [x] Accessible keyboard/focus behavior unchanged
