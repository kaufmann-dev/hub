# Icon upload cleared the selected file

- Timestamp: 2026-10-11 09:41:51 UTC (+0000)
- Git commit: ff09bd4e548f9ff75307fb161aa65c40b93f6a52

## Symptom

On the admin website edit page, choosing a file in the Icon override form left the file input
showing "No file chosen". Uploading then saved nothing, and the discovered favicon stayed in place.

## Confirmed root cause

The local shadcn `Input` component's `type="file"` branch bound both `files` and `value`. After a
file was selected, Superforms ran client-side validation and Formsnap re-rendered the `Form.Control`
props that are spread into `Input`. That props update reset `Input`'s unbound `value` prop to
`undefined`, and the `bind:value` wrote it back to the element. Setting a file input's value to an
empty string clears its selected files.

The Superforms store still held the `File`. The submit uses the DOM form's `FormData`, though, so
the request carried no file.

Evidence from browser reproductions:

- A native `<input>` with `{...props}`, `bind:files`, and the Zod client validator kept the file.
- The shared `Input` without the validator also kept the file, because the props never changed.
- The shared `Input` with the validator cleared the file.
- A copy of `Input` without `bind:value` in its file branch kept the file.

## Changes

- Removed `bind:value` from the `type="file"` branch of `src/lib/components/ui/input/input.svelte`.
  A file input's value is read-only apart from clearing it, and the files are exposed through
  `bind:files`.
- Added `src/routes/admin/websites/[[id]]/IconOverrideForm.svelte.spec.ts`. The browser regression
  selects a file, waits for client-side validation, and asserts that the input and its `FormData`
  still contain the file. It fails without the fix.
