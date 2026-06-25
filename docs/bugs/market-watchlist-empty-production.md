# Market watchlist empty in production

## Symptom

The admin Markets tab showed `Markets (0)` and "No markets configured" in production after the
market-status feature was deployed.

## Root Cause

The first implementation created the `market_watchlist` table and seeded rows locally, but production
only runs Drizzle migrations on deploy. The market rows were not created by the migration, and the
admin UI did not provide a way to add or delete market watchlist entries.

## Fix

- Added an Admin Add Market page that loads supported markets from Alpha Vantage `MARKET_STATUS`.
- Added a Markets tab "Import supported" action that inserts every Alpha Vantage-supported market not
  already configured.
- Added delete support for market watchlist rows.
- Kept individual market edit, hide/show, and drag reorder support.
