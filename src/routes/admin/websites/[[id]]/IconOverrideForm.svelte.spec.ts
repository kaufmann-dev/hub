import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { defaults } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { websiteIconSchema } from '#lib/schemas.js';
import IconOverrideForm from './IconOverrideForm.svelte';

vi.mock('#lib/favicon.js', () => ({
	faviconUrls: () => ({
		light: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E#light',
		dark: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E#dark'
	})
}));

describe('IconOverrideForm.svelte', () => {
	afterEach(() => {
		cleanup();
	});

	it('keeps the selected file after client-side validation', async () => {
		render(IconOverrideForm, {
			iconForm: defaults(zod4(websiteIconSchema), { id: 'icon' }),
			websiteId: 1,
			iconVersion: null,
			hasIconOverride: false
		});
		const input = document.querySelector<HTMLInputElement>('input[type="file"][name="icon"]')!;
		const selection = new DataTransfer();
		selection.items.add(
			new File([new Uint8Array([0x89, 0x50])], 'icon.png', { type: 'image/png' })
		);

		input.files = selection.files;
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));

		// Let Superforms finish its asynchronous client-side validation and store updates.
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(input.files?.[0]?.name).toBe('icon.png');
		expect(new FormData(input.form!).get('icon')).toBeInstanceOf(File);
	});
});
