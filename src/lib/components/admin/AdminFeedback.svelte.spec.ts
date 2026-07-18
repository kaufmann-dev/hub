import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { toast } from 'svelte-sonner';
import AdminFeedbackTest from './AdminFeedbackTest.svelte';

describe('admin action feedback', () => {
	afterEach(() => {
		toast.dismiss('admin-feedback-test');
		cleanup();
	});

	it('identifies failed favicon websites without shifting page content', async () => {
		render(AdminFeedbackTest);
		const anchor = page.getByText('Stable admin content').element();
		const before = anchor.getBoundingClientRect();

		await page.getByRole('button', { name: 'Show favicon warning' }).click();

		await expect.element(page.getByText('Refreshed 17 icons; 1 failed.')).toBeVisible();
		await expect.element(page.getByText('Failed website: Authentik')).toBeVisible();
		const after = anchor.getBoundingClientRect();
		expect(after.top).toBe(before.top);
		expect(after.left).toBe(before.left);
	});
});
