import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { setMode } from 'mode-watcher';
import WebsiteIcon from './WebsiteIcon.svelte';

describe('WebsiteIcon.svelte', () => {
	const icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';
	const lightSrc = `${icon}#light`;
	const darkSrc = `${icon}#dark`;

	afterEach(() => {
		cleanup();
	});

	it('renders only the icon for the resolved theme', async () => {
		setMode('light');
		render(WebsiteIcon, { lightSrc, darkSrc });

		await expect.element(page.getByAltText('')).toHaveAttribute('src', lightSrc);
		expect(document.querySelectorAll('img')).toHaveLength(1);

		setMode('dark');

		await expect.element(page.getByAltText('')).toHaveAttribute('src', darkSrc);
		expect(document.querySelectorAll('img')).toHaveLength(1);
	});
});
