import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import WebsiteIcon from './WebsiteIcon.svelte';

describe('WebsiteIcon.svelte', () => {
	const icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';
	const lightSrc = `${icon}#light`;
	const darkSrc = `${icon}#dark`;

	afterEach(() => {
		cleanup();
	});

	it('renders both static theme icons for CSS-controlled first paint', () => {
		render(WebsiteIcon, { lightSrc, darkSrc });

		const icons = [...document.querySelectorAll('img')];
		expect(icons).toHaveLength(2);
		expect(icons[0]).toHaveAttribute('src', lightSrc);
		expect(icons[0]).toHaveClass('dark:hidden');
		expect(icons[1]).toHaveAttribute('src', darkSrc);
		expect(icons[1]).toHaveClass('hidden', 'dark:block');
	});
});
