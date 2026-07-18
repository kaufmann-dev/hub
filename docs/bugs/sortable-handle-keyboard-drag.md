# Sortable handle did not start keyboard dragging

- Date: 2026-07-18 09:51:28 CEST (+0200)
- Baseline commit: `c2642366a360d89312a8b3c310ef63c31cba1790`

## Symptom

Pressing Enter on an admin list's reorder handle changed its cursor to the active dragging state,
but emitted no drag event and did not allow the row to move with the arrow keys. Pointer dragging
worked normally.

## Root Cause

The `svelte-dnd-action` `dragHandle` action was attached to a native `button`. The library's keyboard
zone intentionally ignores events originating from nested native controls, including elements with a
`disabled` property. Its drag-handle action expects a neutral element and supplies the button role,
tab index, and keyboard behavior itself. The handle action enabled dragging, but the parent zone then
filtered the same key event before it could start the drag.

## Fix

- Attached `dragHandle` to a neutral handle element and let the library provide its accessible button
  semantics.
- Preserved disabled styling and exposed `aria-disabled` while the order is being saved.
- Added browser coverage for keyboard reordering, full-gutter handle geometry, independent row
  actions, and pointer movement into an empty destination zone.
- Loaded the application stylesheet in the browser test fixture so geometry assertions exercise the
  actual Tailwind layout.
