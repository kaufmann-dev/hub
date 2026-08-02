# Protected website health check returns 401

- Timestamp: 2026-08-02 13:49:42 UTC (+0000)
- Git commit: f48f5c05630e7823683e5bcf46e2938278c6887c

## Symptom

Hub marked EdgeLab unavailable with HTTP 401 even though EdgeLab was running and its application
login screen was reachable in a browser.

## Confirmed root cause

Hub's website health checker sent only its user-agent header. EdgeLab distinguishes document
navigations from API-like requests through the `Accept` header: unauthenticated requests that
accept HTML are redirected to its application-owned login screen, while requests without an HTML
acceptance signal correctly receive HTTP 401.

The deployed EdgeLab URL returned 401 for Hub's exact old request. Adding `Accept: text/html` to
the same request produced a 303 redirect to `/auth/login` followed by a 200 HTML response. The
availability request therefore did not describe the representation Hub intended to check.

## Changes

- Added `Accept: text/html` to every outbound website health-check request while retaining Hub's
  explicit user agent, manual redirect handling, redirect URL validation, timeout, and response
  body cancellation.
- Added a regression assertion that verifies the health checker sends the HTML acceptance header.

## Verification

- The deployed EdgeLab request with the new headers completed through `/auth/login` with HTTP 200.
- The focused website-health suite passed all seven tests.
- `pnpm check`, `pnpm lint`, `pnpm test`, and `pnpm build` passed.
