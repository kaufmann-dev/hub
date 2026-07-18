# Browser test reloaded during dependency optimization

- Date: 2026-07-18 10:14:24 CEST (+0200)
- Baseline commit: `9d32b6ceae5af02b2faddcc6a2c5a388b3caa1fa`

## Symptom

The first browser test importing the shared Sonner component failed before collecting any tests.
Vitest reported that Vite unexpectedly reloaded the page after discovering and optimizing
`svelte-sonner` and the toast component's Lucide icon imports.

## Root Cause

The browser runner started before those dependencies were present in Vite's optimized dependency
set. Discovering them while the test was loading triggered a dependency rebuild and page reload,
invalidating the dynamically imported test module. A warm-cache rerun passed, which showed that the
failure depended on dependency discovery rather than the test behavior.

## Fix

- Added `svelte-sonner` and the five deep Lucide icon imports used by the shared toast component to
  `optimizeDeps.include` in `vite.config.ts`.
- Cleared the Vitest cache and reran the browser regression from a fresh optimizer state.
- Confirmed the test loaded without a mid-run reload and passed its layout-stability assertion.
