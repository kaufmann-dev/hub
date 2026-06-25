import { describe, expect, it } from 'vitest';
import {
	buildMarketStatus,
	buildMarketTransitions,
	buildWatchedMarketStatuses,
	getHolidays,
	type ConfiguredMarket,
	type MarketStatus,
	type WatchedMarketStatus
} from './markets';
import type { MarketWatchlist, SupportedMarket } from '$lib/server/db/schema';

type SessionWindow = {
	startTime: string;
	endTime: string;
	sortOrder: number;
};

type ClosureOverride = {
	closureDate: string;
	kind: 'closed' | 'session';
	reason: string;
	sortOrder: number;
	startTime: string | null;
	endTime: string | null;
};

type ScheduleFixture = SupportedMarket & {
	sessions: SessionWindow[];
	closures: ClosureOverride[];
};

function createMarket(overrides: Partial<SupportedMarket> = {}): SupportedMarket {
	return {
		id: 1,
		slug: 'nyse',
		title: 'NYSE',
		city: 'New York',
		country: 'United States',
		timezone: 'America/New_York',
		holidayCalendarCode: 'US',
		weekendDays: ['sat', 'sun'],
		...overrides
	};
}

function createScheduleFixture(
	marketOverrides: Partial<SupportedMarket>,
	sessions: SessionWindow[],
	closures: ClosureOverride[] = []
): ScheduleFixture {
	return {
		...createMarket(marketOverrides),
		sessions,
		closures
	};
}

function createWatchlistRow(
	id: number,
	market: SupportedMarket,
	overrides: Partial<MarketWatchlist> = {}
): ConfiguredMarket {
	return {
		id,
		supportedMarketId: market.id,
		hidden: false,
		sortOrder: id - 1,
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		updatedAt: new Date('2026-01-01T00:00:00.000Z'),
		...overrides,
		market
	};
}

function expectStatus(
	status: MarketStatus | WatchedMarketStatus,
	values: Partial<MarketStatus | WatchedMarketStatus>
) {
	expect(status).toEqual(expect.objectContaining(values));
}

const nyse = createScheduleFixture(
	{},
	[{ startTime: '09:30', endTime: '16:00', sortOrder: 0 }],
	[
		{
			closureDate: '2026-04-03',
			kind: 'closed',
			reason: 'Good Friday',
			sortOrder: 0,
			startTime: null,
			endTime: null
		},
		{
			closureDate: '2026-11-27',
			kind: 'session',
			reason: 'Day after Thanksgiving early close',
			sortOrder: 0,
			startTime: '09:30',
			endTime: '13:00'
		}
	]
);

const tokyo = createScheduleFixture(
	{
		id: 4,
		slug: 'tokyo-stock-exchange',
		title: 'Tokyo Stock Exchange',
		city: 'Tokyo',
		country: 'Japan',
		timezone: 'Asia/Tokyo',
		holidayCalendarCode: 'JP'
	},
	[
		{ startTime: '09:00', endTime: '11:30', sortOrder: 0 },
		{ startTime: '12:30', endTime: '15:30', sortOrder: 1 }
	]
);

const krx = createScheduleFixture(
	{
		id: 8,
		slug: 'korea-exchange',
		title: 'Korea Exchange',
		city: 'Seoul',
		country: 'South Korea',
		timezone: 'Asia/Seoul',
		holidayCalendarCode: 'KR'
	},
	[{ startTime: '09:00', endTime: '15:30', sortOrder: 0 }]
);

describe('market schedule engine', () => {
	it('reports an open single-session market with a close countdown', () => {
		const status = buildMarketStatus(nyse, new Date('2026-06-25T18:00:00.000Z'));

		expectStatus(status, {
			title: 'NYSE',
			currentStatus: 'open',
			nextTransitionKind: 'close',
			countdownLabel: 'Closes in 2h 00m',
			hoursLabel: '09:30-16:00',
			supplementalDetail: null
		});
	});

	it('reports a closed market before open with an open countdown', () => {
		const status = buildMarketStatus(nyse, new Date('2026-06-25T12:00:00.000Z'));

		expectStatus(status, {
			currentStatus: 'closed',
			nextTransitionKind: 'open',
			countdownLabel: 'Opens in 1h 30m'
		});
	});

	it('skips to the next trading day after close', () => {
		const status = buildMarketStatus(nyse, new Date('2026-06-26T21:00:00.000Z'));

		expectStatus(status, {
			currentStatus: 'closed',
			nextTransitionKind: 'open',
			countdownLabel: 'Opens in 64h 30m',
			supplementalDetail: 'Weekend closure.'
		});
	});

	it('reports an intraday break as a reopen countdown', () => {
		const status = buildMarketStatus(tokyo, new Date('2026-06-25T03:00:00.000Z'));

		expectStatus(status, {
			currentStatus: 'closed',
			nextTransitionKind: 'reopen',
			countdownLabel: 'Reopens in 0h 30m',
			hoursLabel: '09:00-11:30 · 12:30-15:30',
			supplementalDetail: 'Midday break 11:30-12:30 local time.'
		});
	});

	it('uses country holidays to skip to the next valid session', () => {
		const status = buildMarketStatus(krx, new Date('2026-01-01T01:00:00.000Z'));

		expectStatus(status, {
			currentStatus: 'closed',
			nextTransitionKind: 'open',
			countdownLabel: 'Opens in 23h 00m'
		});
		expect(status.supplementalDetail).toContain('Closed for');
	});

	it('skips weekends to the next valid session', () => {
		const status = buildMarketStatus(krx, new Date('2026-06-28T02:00:00.000Z'));

		expectStatus(status, {
			currentStatus: 'closed',
			nextTransitionKind: 'open',
			countdownLabel: 'Opens in 22h 00m',
			supplementalDetail: 'Weekend closure.'
		});
	});

	it('lets explicit closure overrides win over regular weekday hours', () => {
		const status = buildMarketStatus(nyse, new Date('2026-04-03T14:00:00.000Z'));

		expectStatus(status, {
			currentStatus: 'closed',
			nextTransitionKind: 'open',
			countdownLabel: 'Opens in 71h 30m',
			supplementalDetail: 'Closed for Good Friday.'
		});
	});

	it('uses special-session overrides instead of the regular hours', () => {
		const status = buildMarketStatus(nyse, new Date('2026-11-27T17:00:00.000Z'));

		expectStatus(status, {
			currentStatus: 'open',
			nextTransitionKind: 'close',
			countdownLabel: 'Closes in 1h 00m',
			hoursLabel: '09:30-13:00',
			supplementalDetail: 'Special session: Day after Thanksgiving early close.'
		});
	});

	it('resolves watchlist rows against canonical market rows', () => {
		const watchlist = [
			createWatchlistRow(10, nyse, { sortOrder: 3 }),
			createWatchlistRow(11, tokyo, { hidden: true, sortOrder: 4 })
		];
		const schedules = new Map([
			[nyse.id, nyse],
			[tokyo.id, tokyo]
		]);

		const statuses = buildWatchedMarketStatuses(
			watchlist,
			schedules,
			new Date('2026-06-25T18:00:00.000Z')
		);

		expect(statuses).toHaveLength(2);
		expectStatus(statuses[0]!, {
			id: 10,
			title: 'NYSE',
			sortOrder: 3,
			hidden: false
		});
		expectStatus(statuses[1]!, {
			id: 11,
			title: 'Tokyo Stock Exchange',
			hidden: true
		});
	});

	it('emits the next close as the first transition while a market is open', () => {
		const now = new Date('2026-06-25T18:00:00.000Z');
		const transitions = buildMarketTransitions(nyse, now);

		expect(transitions.every((transition) => transition.at > now.getTime())).toBe(true);
		// NYSE 09:30-16:00 EDT closes at 20:00Z, then reopens next day at 13:30Z.
		expect(transitions[0]).toEqual({ at: Date.UTC(2026, 5, 25, 20, 0), kind: 'close' });
		expect(transitions[1]).toEqual({ at: Date.UTC(2026, 5, 26, 13, 30), kind: 'open' });
	});

	it('emits a reopen transition across a midday break', () => {
		const now = new Date('2026-06-25T03:00:00.000Z');
		const transitions = buildMarketTransitions(tokyo, now);

		// Tokyo 12:30-15:30 JST second session reopens at 03:30Z, closes at 06:30Z.
		expect(transitions[0]).toEqual({ at: Date.UTC(2026, 5, 25, 3, 30), kind: 'reopen' });
		expect(transitions[1]).toEqual({ at: Date.UTC(2026, 5, 25, 6, 30), kind: 'close' });
	});

	it('loads public holidays for the country-based calendars used by the schedule engine', () => {
		const korea = getHolidays('KR', 2026, 'Asia/Seoul');
		const taiwan = getHolidays('TW', 2026, 'Asia/Taipei');

		expect(korea.available).toBe(true);
		expect(taiwan.available).toBe(true);
		expect(korea.namesByDate.has('2026-01-01')).toBe(true);
		expect(taiwan.namesByDate.has('2026-01-01')).toBe(true);
	});
});
