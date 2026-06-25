import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
	const env: Record<string, string | undefined> = {};
	type CacheRow = { key: string; data: unknown; fetchedAt: Date };
	let selectResults: (CacheRow | undefined)[] = [];
	const upserts: unknown[] = [];

	const db = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => {
						const selected = selectResults.length ? selectResults.shift() : undefined;
						return selected ? [selected] : [];
					})
				}))
			}))
		})),
		insert: vi.fn(() => ({
			values: vi.fn((value: { key: string; data: unknown; fetchedAt: Date }) => ({
				onConflictDoUpdate: vi.fn(async () => {
					upserts.push(value);
				})
			}))
		}))
	};

	return {
		db,
		env,
		upserts,
		setSelectResults(values: (CacheRow | undefined)[]) {
			selectResults = [...values];
		}
	};
});

vi.mock('$env/dynamic/private', () => ({ env: mock.env }));
vi.mock('$lib/server/db', () => ({ db: mock.db }));

const {
	buildScheduledMarketStatus,
	buildWatchedMarketStatuses,
	getHolidays,
	getMarketStatuses,
	MARKET_STATUS_CACHE_KEY,
	marketDisplayName,
	parseMarketStatusResponse,
	SCHEDULE_MARKETS,
	unconfiguredMarketStatuses
} = await import('./markets');

// SCHEDULE_MARKETS order: South Korea (KRX), then Taiwan (TWSE).
const [krxMarket, twseMarket] = SCHEDULE_MARKETS;

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

function cacheRow(
	key: string,
	data: unknown,
	fetchedAt = new Date()
): { key: string; data: unknown; fetchedAt: Date } {
	return { key, data, fetchedAt };
}

describe('market status', () => {
	beforeEach(() => {
		mock.env.ALPHA_VANTAGE_API_KEY = 'test-key';
		mock.setSelectResults([]);
		mock.upserts.length = 0;
		vi.clearAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
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
				notes: '',
				statusSource: 'live'
			},
			{
				marketType: 'Equity',
				region: 'United Kingdom',
				primaryExchanges: 'London',
				localOpen: '08:00',
				localClose: '16:30',
				currentStatus: 'open',
				notes: '',
				statusSource: 'live'
			}
		]);
	});

	it('uses fresh cached market status without fetching', async () => {
		mock.setSelectResults([cacheRow(MARKET_STATUS_CACHE_KEY, payload)]);
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const result = await getMarketStatuses();

		expect(result.stale).toBe(false);
		expect(result.markets).toHaveLength(4);
		expect(result.markets.slice(-2)).toEqual([
			expect.objectContaining({
				region: 'South Korea',
				primaryExchanges: 'Korea Exchange (KRX)',
				statusSource: 'schedule'
			}),
			expect.objectContaining({
				region: 'Taiwan',
				primaryExchanges: 'Taiwan Stock Exchange (TWSE)',
				statusSource: 'schedule'
			})
		]);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(mock.upserts).toHaveLength(0);
	});

	it('fetches and caches market status when cache is stale', async () => {
		mock.setSelectResults([
			cacheRow(MARKET_STATUS_CACHE_KEY, payload, new Date(Date.now() - 2 * 60 * 60 * 1000))
		]);
		const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload)));
		vi.stubGlobal('fetch', fetchMock);

		const result = await getMarketStatuses();

		expect(result.stale).toBe(false);
		expect(result.markets[0].region).toBe('United States');
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(mock.upserts).toHaveLength(1);
	});

	it('falls back to stale cache when Alpha Vantage fetch fails', async () => {
		mock.setSelectResults([
			cacheRow(MARKET_STATUS_CACHE_KEY, payload, new Date(Date.now() - 2 * 60 * 60 * 1000))
		]);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('rate limit', { status: 429 }))
		);

		const result = await getMarketStatuses();

		expect(result.stale).toBe(true);
		expect(result.error).toContain('429');
		expect(result.markets).toHaveLength(4);
		expect(mock.upserts).toHaveLength(0);
	});

	it('does not fetch Alpha Vantage without an API key and no Alpha cache', async () => {
		mock.env.ALPHA_VANTAGE_API_KEY = '';
		mock.setSelectResults([undefined]);
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const result = await getMarketStatuses();

		expect(result.stale).toBe(true);
		expect(result.error).toBe('missing-api-key');
		expect(result.markets).toEqual([
			expect.objectContaining({ region: 'South Korea', statusSource: 'schedule' }),
			expect.objectContaining({ region: 'Taiwan', statusSource: 'schedule' })
		]);
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
				statusSource: 'unavailable',
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

	it('uses region as the display name and market type for global rows', () => {
		expect(marketDisplayName({ marketType: 'Forex', region: 'Global' })).toBe('Forex');
		expect(marketDisplayName({ marketType: 'Equity', region: 'Germany' })).toBe('Germany');
		expect(marketDisplayName({ marketType: 'Equity', region: 'South Korea' })).toBe('South Korea');
		expect(marketDisplayName({ marketType: 'Equity', region: 'Taiwan' })).toBe('Taiwan');
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

	it('marks KRX open during regular weekday trading hours', () => {
		const status = buildScheduledMarketStatus(krxMarket, new Date('2026-06-25T01:00:00.000Z'), {
			dates: new Set(),
			available: true
		});

		expect(status).toEqual(
			expect.objectContaining({
				region: 'South Korea',
				localOpen: '09:00',
				localClose: '15:30',
				currentStatus: 'open',
				statusSource: 'schedule'
			})
		);
	});

	it('marks KRX closed before open and after close', () => {
		const holidays = { dates: new Set<string>(), available: true };

		expect(
			buildScheduledMarketStatus(krxMarket, new Date('2026-06-24T23:30:00.000Z'), holidays)
		).toEqual(expect.objectContaining({ currentStatus: 'closed' }));
		expect(
			buildScheduledMarketStatus(krxMarket, new Date('2026-06-25T07:00:00.000Z'), holidays)
		).toEqual(expect.objectContaining({ currentStatus: 'closed' }));
	});

	it('marks KRX closed on weekends', () => {
		const status = buildScheduledMarketStatus(krxMarket, new Date('2026-06-28T01:00:00.000Z'), {
			dates: new Set(),
			available: true
		});

		expect(status.currentStatus).toBe('closed');
	});

	it('marks KRX closed on South Korea public holidays', () => {
		const status = buildScheduledMarketStatus(krxMarket, new Date('2026-06-25T01:00:00.000Z'), {
			dates: new Set(['2026-06-25']),
			available: true
		});

		expect(status.currentStatus).toBe('closed');
	});

	it('marks KRX unknown when holiday data is unavailable during potential open hours', () => {
		const status = buildScheduledMarketStatus(krxMarket, new Date('2026-06-25T01:00:00.000Z'), {
			dates: new Set(),
			available: false
		});

		expect(status).toEqual(
			expect.objectContaining({
				currentStatus: 'unknown',
				notes: 'Schedule-based · holiday lookup unavailable'
			})
		);
	});

	it('marks TWSE open during regular weekday trading hours', () => {
		// 2026-06-25T01:00Z === 09:00 Asia/Taipei on a Thursday.
		const status = buildScheduledMarketStatus(twseMarket, new Date('2026-06-25T01:00:00.000Z'), {
			dates: new Set(),
			available: true
		});

		expect(status).toEqual(
			expect.objectContaining({
				region: 'Taiwan',
				localOpen: '09:00',
				localClose: '13:30',
				currentStatus: 'open',
				statusSource: 'schedule'
			})
		);
	});

	it('marks TWSE closed before open and after close', () => {
		const holidays = { dates: new Set<string>(), available: true };

		// 08:30 Asia/Taipei (before open)
		expect(
			buildScheduledMarketStatus(twseMarket, new Date('2026-06-24T23:30:00.000Z'), holidays)
		).toEqual(expect.objectContaining({ currentStatus: 'closed' }));
		// 15:00 Asia/Taipei (after 13:30 close)
		expect(
			buildScheduledMarketStatus(twseMarket, new Date('2026-06-25T07:00:00.000Z'), holidays)
		).toEqual(expect.objectContaining({ currentStatus: 'closed' }));
	});

	it('marks TWSE closed on weekends', () => {
		// 2026-06-28 is a Sunday.
		const status = buildScheduledMarketStatus(twseMarket, new Date('2026-06-28T01:00:00.000Z'), {
			dates: new Set(),
			available: true
		});

		expect(status.currentStatus).toBe('closed');
	});

	it('marks TWSE closed on Taiwan public holidays', () => {
		const status = buildScheduledMarketStatus(twseMarket, new Date('2026-06-25T01:00:00.000Z'), {
			dates: new Set(['2026-06-25']),
			available: true
		});

		expect(status.currentStatus).toBe('closed');
	});

	it('marks TWSE unknown when holiday data is unavailable during potential open hours', () => {
		const status = buildScheduledMarketStatus(twseMarket, new Date('2026-06-25T01:00:00.000Z'), {
			dates: new Set(),
			available: false
		});

		expect(status).toEqual(
			expect.objectContaining({
				currentStatus: 'unknown',
				notes: 'Schedule-based · holiday lookup unavailable'
			})
		);
	});

	it('keeps schedule-based markets available when Alpha Vantage fetch fails without cached data', async () => {
		mock.setSelectResults([undefined]);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('upstream error', { status: 502 }))
		);

		const result = await getMarketStatuses();

		expect(result.stale).toBe(true);
		expect(result.error).toContain('502');
		expect(result.markets).toEqual([
			expect.objectContaining({ region: 'South Korea', statusSource: 'schedule' }),
			expect.objectContaining({ region: 'Taiwan', statusSource: 'schedule' })
		]);
	});

	it('filters out already configured schedule-based markets from Add Market options', () => {
		const missing = unconfiguredMarketStatuses(
			[{ marketType: 'Equity', region: 'South Korea' }],
			[
				...parseMarketStatusResponse(payload),
				buildScheduledMarketStatus(krxMarket, new Date('2026-06-25T01:00:00.000Z'), {
					dates: new Set(),
					available: true
				})
			]
		);

		expect(missing.some((status) => status.region === 'South Korea')).toBe(false);
		expect(missing).toHaveLength(2);
	});

	it('resolves public holidays offline for South Korea and Taiwan', () => {
		const korea = getHolidays('KR', 2026, 'Asia/Seoul');
		const taiwan = getHolidays('TW', 2026, 'Asia/Taipei');

		expect(korea.available).toBe(true);
		expect(taiwan.available).toBe(true);
		expect(korea.dates.size).toBeGreaterThan(0);
		expect(taiwan.dates.size).toBeGreaterThan(0);
		// New Year's Day / Founding Day is a public holiday in both.
		expect(korea.dates.has('2026-01-01')).toBe(true);
		expect(taiwan.dates.has('2026-01-01')).toBe(true);
	});
});
