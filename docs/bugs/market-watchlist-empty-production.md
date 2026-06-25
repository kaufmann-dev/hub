# Market watchlist empty in production

## Symptom

The admin Markets tab showed `Markets (0)` and "No markets configured" in production after the
market-status feature was deployed.

## Root Cause

The first implementation created the `market_watchlist` table and seeded rows locally, but production
only runs Drizzle migrations on deploy. The market rows were not created by the migration, and the
admin UI did not provide a way to add or delete market watchlist entries.

## Fix

- Replaced provider-loaded market discovery with a migration-managed canonical exchange catalog in
  the database.
- Added an Admin Add Market page that reads the canonical exchange list directly from the database.
- Added a Markets tab "Import all canonical markets" action that inserts every canonical exchange not
  already configured.
- Added delete support for market watchlist rows.
- Kept individual market edit, hide/show, and drag reorder support.
- Removed the API-dependent market source entirely; the homepage now computes market state from
  local exchange metadata, country holidays, and explicit override rows.
