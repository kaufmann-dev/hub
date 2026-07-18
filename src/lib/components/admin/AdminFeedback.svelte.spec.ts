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

	it('shows failures without shifting page content', async () => {
		render(AdminFeedbackTest);
		const anchor = page.getByText('Stable admin content').element();
		const before = anchor.getBoundingClientRect();

		await page.getByRole('button', { name: 'Show reorder failure' }).click();

		await expect
			.element(page.getByText('Order could not be saved. The previous order was restored.'))
			.toBeVisible();
		const after = anchor.getBoundingClientRect();
		expect(after.top).toBe(before.top);
		expect(after.left).toBe(before.left);
	});
});
