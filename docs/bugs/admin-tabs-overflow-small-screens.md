# Admin tabs overflowed on small screens

- Date: 2026-07-23 16:52:53 CEST (+0200)
- Baseline commit: `3ad3aaa73b4b03502e78e30496410ffc1c0b0a45`

## Symptom

The four admin navigation tabs extended beyond the available content width on very small screens,
clipping the Markets tab and widening the page.

## Root Cause

The shared tab list sizes itself to its contents with `w-fit`, while each tab label is kept on one
line with `whitespace-nowrap`. The combined intrinsic width of the four labels and their item counts
could therefore exceed the narrow viewport without an overflow boundary.

## Fix

- Constrained the admin tab list to the available content width.
- Kept the tabs left-aligned when their combined intrinsic width exceeds that boundary.
- Added horizontal scrolling inside the tab list so every tab remains reachable without causing
  page-level overflow.
