import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
	const env: Record<string, string | undefined> = {};
	let cached: { key: string; data: unknown; fetchedAt: Date } | undefined;
	const upserts: unknown[] = [];

	const db = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => (cached ? [cached] : []))
				}))
			}))
		})),
		insert: vi.fn(() => ({
			values: vi.fn((value: { key: string; data: unknown; fetchedAt: Date }) => ({
				onConflictDoUpdate: vi.fn(async () => {
					cached = value;
					upserts.push(value);
				})
			}))
		}))
	};

	return {
		db,
		env,
		upserts,
		get cached() {
			return cached;
		},
		setCached(value: typeof cached) {
			cached = value;
		}
	};
});

vi.mock('$env/dynamic/private', () => ({ env: mock.env }));
vi.mock('$lib/server/db', () => ({ db: mock.db }));

const {
	buildWatchedMarketStatuses,
	getMarketStatuses,
	MARKET_STATUS_CACHE_KEY,
	marketDisplayName,
	parseMarketStatusResponse,
	unconfiguredMarketStatuses
} = await import('./markets');

const payload = {
	endpoint: 'Global Market Open & Close Status',
	markets: [
		{
			market_type: 'Equity',
			region: 'United States',
			primary_exchanges: 'NASDAQ, NYSE, AMEX, BATS',
			local_open: '09:30',
			local_close: '16:15',
			current_status: 'closed',
			notes: ''
		},
		{
			market_type: 'Equity',
			region: 'United Kingdom',
			primary_exchanges: 'London',
			local_open: '08:00',
			local_close: '16:30',
			current_status: 'open',
			notes: ''
		}
	]
};

describe('market status', () => {
	beforeEach(() => {
		mock.env.ALPHA_VANTAGE_API_KEY = 'test-key';
		mock.setCached(undefined);
		mock.upserts.length = 0;
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	it('parses Alpha Vantage market status responses', () => {
		expect(parseMarketStatusResponse(payload)).toEqual([
			{
				marketType: 'Equity',
				region: 'United States',
				primaryExchanges: 'NASDAQ, NYSE, AMEX, BATS',
				localOpen: '09:30',
				localClose: '16:15',
				currentStatus: 'closed',
				notes: ''
			},
			{
				marketType: 'Equity',
				region: 'United Kingdom',
				primaryExchanges: 'London',
				localOpen: '08:00',
				localClose: '16:30',
				currentStatus: 'open',
				notes: ''
			}
		]);
	});

	it('uses fresh cached market status without fetching', async () => {
		mock.setCached({
			key: MARKET_STATUS_CACHE_KEY,
			data: payload,
			fetchedAt: new Date()
		});
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const result = await getMarketStatuses();

		expect(result.stale).toBe(false);
		expect(result.markets).toHaveLength(2);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(mock.upserts).toHaveLength(0);
	});

	it('fetches and caches market status when cache is stale', async () => {
		mock.setCached({
			key: MARKET_STATUS_CACHE_KEY,
			data: payload,
			fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
		});
		const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload)));
		vi.stubGlobal('fetch', fetchMock);

		const result = await getMarketStatuses();

		expect(result.stale).toBe(false);
		expect(result.markets[0].region).toBe('United States');
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(mock.upserts).toHaveLength(1);
	});

	it('falls back to stale cache when Alpha Vantage fetch fails', async () => {
		mock.setCached({
			key: MARKET_STATUS_CACHE_KEY,
			data: payload,
			fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('rate limit', { status: 429 }))
		);

		const result = await getMarketStatuses();

		expect(result.stale).toBe(true);
		expect(result.error).toContain('429');
		expect(result.markets).toHaveLength(2);
		expect(mock.upserts).toHaveLength(0);
	});

	it('does not fetch without an API key and no cache', async () => {
		mock.env.ALPHA_VANTAGE_API_KEY = '';
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const result = await getMarketStatuses();

		expect(result).toEqual({
			markets: [],
			fetchedAt: null,
			stale: true,
			error: 'missing-api-key'
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('matches watchlist rows by market type and region', () => {
		const watched = buildWatchedMarketStatuses(
			[
				{
					id: 1,
					marketType: 'Equity',
					region: 'United Kingdom',
					displayName: 'London',
					hidden: false,
					sortOrder: 0,
					createdAt: new Date(),
					updatedAt: new Date()
				}
			],
			parseMarketStatusResponse(payload)
		);

		expect(watched).toEqual([
			expect.objectContaining({
				id: 1,
				displayName: 'London',
				region: 'United Kingdom',
				currentStatus: 'open',
				isOpen: true,
				isUnknown: false
			})
		]);
	});

	it('keeps configured watchlist rows visible when live status is unavailable', () => {
		const watched = buildWatchedMarketStatuses(
			[
				{
					id: 2,
					marketType: 'Equity',
					region: 'Germany',
					displayName: 'Germany',
					hidden: false,
					sortOrder: 1,
					createdAt: new Date(),
					updatedAt: new Date()
				}
			],
			[]
		);

		expect(watched).toEqual([
			expect.objectContaining({
				id: 2,
				displayName: 'Germany',
				currentStatus: 'unavailable',
				primaryExchanges: 'Status unavailable',
				isUnknown: true
			})
		]);
	});

	it('surfaces Alpha Vantage error payload messages', () => {
		expect(() =>
			parseMarketStatusResponse({
				Information: 'The standard API rate limit is 25 requests per day.'
			})
		).toThrow('The standard API rate limit is 25 requests per day.');
	});

	it('uses market type as display name for global Alpha Vantage rows', () => {
		expect(marketDisplayName({ marketType: 'Forex', region: 'Global' })).toBe('Forex');
		expect(marketDisplayName({ marketType: 'Equity', region: 'Germany' })).toBe('Germany');
	});

	it('filters out already configured Alpha Vantage market rows', () => {
		const missing = unconfiguredMarketStatuses(
			[{ marketType: 'Equity', region: 'United States' }],
			parseMarketStatusResponse(payload)
		);

		expect(missing).toEqual([
			expect.objectContaining({
				marketType: 'Equity',
				region: 'United Kingdom'
			})
		]);
	});
});
