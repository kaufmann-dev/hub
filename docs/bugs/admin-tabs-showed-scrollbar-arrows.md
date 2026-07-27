# Admin tabs showed vertical scrollbar arrows

- Date: 2026-07-27 09:49:49 UTC (+0000)
- Baseline commit: `ac010cdb66d3db79788d5c8778ef2a385013dc5d`

## Symptom

The admin tab strip showed stacked up and down scrollbar arrows at its right edge.

## Root Cause

The tab strip used `overflow-x-auto` to remain horizontally scrollable on narrow screens. CSS
computes `overflow-y: visible` to `auto` when the other overflow axis is `auto`, so the fixed-height
tab list also became a vertical scroll container. Chromium exposed that container's native vertical
scrollbar controls.

## Fix

- Explicitly hid vertical overflow on the tab list.
- Preserved horizontal scrolling so all tabs remain reachable on narrow screens.
