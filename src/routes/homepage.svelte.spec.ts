import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HomepageTest from './homepage-test.svelte';

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
						description: 'New York Stock Exchange',
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
						description: 'Tokyo Stock Exchange cash equities',
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
						description: 'Korea Exchange cash market',
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
