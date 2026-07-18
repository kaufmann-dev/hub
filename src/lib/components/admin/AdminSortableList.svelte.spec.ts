import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import AdminSortableListTest from './AdminSortableListTest.svelte';

describe('AdminSortableList', () => {
	afterEach(() => cleanup());

	it('uses the full left gutter as its handle without moving row content', async () => {
		render(AdminSortableListTest);

		const handle = page.getByRole('button', { name: 'Reorder Alpha' }).element();
		const row = handle.closest('[data-sort-item]');
		expect(row).toBeInstanceOf(HTMLElement);

		const handleRect = handle.getBoundingClientRect();
		const rowRect = (row as HTMLElement).getBoundingClientRect();
		expect(handleRect.width).toBe(48);
		expect(Math.abs(handleRect.height - rowRect.height)).toBeLessThanOrEqual(2);
		expect(Math.abs(handleRect.left - rowRect.left)).toBeLessThanOrEqual(1);
	});

	it('keeps row actions independent from the drag handle', async () => {
		render(AdminSortableListTest);

		await page.getByRole('button', { name: 'Edit Alpha' }).click();

		await expect.element(page.getByLabelText('Action count')).toHaveTextContent('1');
		await expect
			.element(page.getByLabelText('Primary order'))
			.toHaveTextContent('Alpha,Bravo,Charlie');
	});

	it('reorders items with the keyboard', async () => {
		render(AdminSortableListTest);
		const handle = page.getByRole('button', { name: 'Reorder Alpha' });
		handle.element().focus();

		await userEvent.keyboard('{Enter}');
		await userEvent.keyboard('{ArrowDown}{Enter}');

		await expect
			.element(page.getByLabelText('Primary order'))
			.toHaveTextContent('Bravo,Alpha,Charlie');
	});

	it('moves an item into an empty destination with pointer drag and drop', async () => {
		render(AdminSortableListTest);

		await userEvent.dragAndDrop(
			page.getByRole('button', { name: 'Reorder Alpha' }),
			page.getByRole('list', { name: 'Secondary' })
		);

		await expect.element(page.getByLabelText('Primary order')).toHaveTextContent('Bravo,Charlie');
		await expect.element(page.getByLabelText('Secondary order')).toHaveTextContent('Alpha');
	});
});
