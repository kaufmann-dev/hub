import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import HomepageTest from './homepage-test.svelte';

vi.mock('$lib/favicon', () => ({
	faviconUrls: () => ({
		light: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
		dark: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'
	})
}));

beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(null, { status: 503 }))
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('hub homepage markets', () => {
	it('renders single-session, split-session, and holiday-closed exchange cards', async () => {
		render(HomepageTest, {
			data: {
				websites: [],
				projects: [],
				cities: [],
				weatherByCity: {},
				markets: [
					{
						id: 1,
						supportedMarketId: 1,
						title: 'NYSE',
						city: 'New York',
						country: 'United States',
						timezone: 'America/New_York',
						currentStatus: 'open',
						countdownLabel: 'Closes in 2h 00m',
						nextTransitionKind: 'close',
						hoursLabel: '09:30-16:00',
						supplementalDetail: null,
						hidden: false,
						sortOrder: 0
					},
					{
						id: 2,
						supportedMarketId: 4,
						title: 'Tokyo Stock Exchange',
						city: 'Tokyo',
						country: 'Japan',
						timezone: 'Asia/Tokyo',
						currentStatus: 'closed',
						countdownLabel: 'Reopens in 0h 30m',
						nextTransitionKind: 'reopen',
						hoursLabel: '09:00-11:30 · 12:30-15:30',
						supplementalDetail: 'Midday break 11:30-12:30 local time.',
						hidden: false,
						sortOrder: 1
					},
					{
						id: 3,
						supportedMarketId: 8,
						title: 'Korea Exchange',
						city: 'Seoul',
						country: 'South Korea',
						timezone: 'Asia/Seoul',
						currentStatus: 'closed',
						countdownLabel: 'Opens in 23h 00m',
						nextTransitionKind: 'open',
						hoursLabel: '09:00-15:30',
						supplementalDetail: "Closed for New Year's Day.",
						hidden: false,
						sortOrder: 2
					}
				]
			}
		});

		await expect.element(page.getByText('NYSE')).toBeInTheDocument();
		await expect.element(page.getByText('New York, United States')).toBeInTheDocument();
		await expect.element(page.getByText('Closes in 2h 00m')).toBeInTheDocument();

		await expect
			.element(page.getByText('Tokyo Stock Exchange', { exact: true }))
			.toBeInTheDocument();
		await expect.element(page.getByText('09:00-11:30 · 12:30-15:30')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Schedule detail for Tokyo Stock Exchange' }))
			.toBeInTheDocument();

		await expect.element(page.getByText('Korea Exchange', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Opens in 23h 00m')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Schedule detail for Korea Exchange' }))
			.toBeInTheDocument();
	});
});

describe('hub homepage website availability', () => {
	it('renders cached states and updates an unchecked website after the background refresh', async () => {
		let finishRefresh: ((response: Response) => void) | undefined;
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Promise<Response>((resolve) => {
						finishRefresh = resolve;
					})
			)
		);

		const createdAt = new Date('2026-07-18T10:00:00Z');
		render(HomepageTest, {
			data: {
				websites: [
					{
						id: 1,
						title: 'Available site',
						url: 'https://available.example.com',
						description: null,
						kind: 'personal',
						hidden: false,
						sortOrder: 0,
						createdAt,
						updatedAt: createdAt,
						faviconCheckedAt: null,
						health: {
							state: 'healthy',
							statusCode: 200,
							failureKind: null,
							checkedAt: '2026-07-18T12:00:00.000Z'
						}
					},
					{
						id: 2,
						title: 'Unavailable site',
						url: 'https://unavailable.example.com',
						description: null,
						kind: 'personal',
						hidden: false,
						sortOrder: 1,
						createdAt,
						updatedAt: createdAt,
						faviconCheckedAt: null,
						health: {
							state: 'unhealthy',
							statusCode: 503,
							failureKind: 'http',
							checkedAt: '2026-07-18T12:01:00.000Z'
						}
					},
					{
						id: 3,
						title: 'Unchecked site',
						url: 'https://unchecked.example.com',
						description: null,
						kind: 'personal',
						hidden: false,
						sortOrder: 2,
						createdAt,
						updatedAt: createdAt,
						faviconCheckedAt: null,
						health: null
					},
					{
						id: 4,
						title: 'Third-party site',
						url: 'https://third-party.example.com',
						description: null,
						kind: 'third_party',
						hidden: false,
						sortOrder: 3,
						createdAt,
						updatedAt: createdAt,
						faviconCheckedAt: null,
						health: {
							state: 'unhealthy',
							statusCode: 403,
							failureKind: 'http',
							checkedAt: '2026-07-18T12:01:00.000Z'
						}
					}
				],
				projects: [],
				cities: [],
				weatherByCity: {},
				markets: []
			}
		});

		await expect
			.element(page.getByRole('img', { name: /Available — HTTP 200/ }))
			.toHaveAttribute('data-health-status', 'healthy');
		await expect
			.element(page.getByRole('img', { name: /Unavailable — HTTP 503/ }))
			.toHaveAttribute('data-health-status', 'unhealthy');
		await expect
			.element(page.getByRole('img', { name: 'Status not checked yet' }))
			.toHaveAttribute('data-health-status', 'unknown');
		expect(document.querySelectorAll('[data-health-status]')).toHaveLength(3);
		expect(
			document
				.querySelector<HTMLAnchorElement>('a[href="https://third-party.example.com"]')!
				.querySelector('[data-health-status]')
		).toBeNull();
		finishRefresh?.(
			new Response(
				JSON.stringify({
					healthByWebsiteId: {
						'3': {
							state: 'healthy',
							statusCode: 204,
							failureKind: null,
							checkedAt: '2026-07-18T12:02:00.000Z'
						}
					}
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		);

		await expect
			.element(page.getByRole('img', { name: /Available — HTTP 204/ }))
			.toHaveAttribute('data-health-status', 'healthy');
		const refreshedDot = document.querySelector<HTMLElement>(
			'[data-health-status="healthy"][aria-label*="HTTP 204"]'
		)!;
		expect(refreshedDot.parentElement?.classList.contains('justify-between')).toBe(true);
		expect(refreshedDot.parentElement?.lastElementChild).toBe(refreshedDot);
	});
});
