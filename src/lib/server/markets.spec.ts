import { describe, expect, it } from 'vitest';
import {
	buildMarketStatus,
	buildMarketTransitions,
	buildWatchedMarketStatuses,
	getCalendarYear,
	type ConfiguredMarket,
	type MarketStatus,
	type WatchedMarketStatus
} from './markets';
import type { MarketWatchlist, SupportedMarket } from '#lib/server/db/schema.js';

type SessionWindow = {
	startTime: string;
	endTime: string;
	sortOrder: number;
};

type CalendarRule = {
	rule: string;
	kind: 'closed' | 'session' | 'ignore';
	reason: string;
	sortOrder: number;
	startTime: string | null;
	endTime: string | null;
};

type ScheduleFixture = SupportedMarket & {
	sessions: SessionWindow[];
	rules: CalendarRule[];
};

function createMarket(overrides: Partial<SupportedMarket> = {}): SupportedMarket {
	return {
		id: 1,
		slug: 'nyse',
		title: 'NYSE',
		city: 'New York',
		country: 'United States',
		timezone: 'America/New_York',
		holidayCalendarCode: null,
		weekendDays: ['sat', 'sun'],
		...overrides
	};
}

function createScheduleFixture(
	marketOverrides: Partial<SupportedMarket>,
	sessions: SessionWindow[],
	rules: CalendarRule[] = []
): ScheduleFixture {
	return {
		...createMarket(marketOverrides),
		sessions,
		rules
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

function closedRule(rule: string, reason: string): CalendarRule {
	return { rule, kind: 'closed', reason, sortOrder: 0, startTime: null, endTime: null };
}

const nyse = createScheduleFixture(
	{},
	[{ startTime: '09:30', endTime: '16:00', sortOrder: 0 }],
	[
		closedRule('easter -2', 'Good Friday'),
		closedRule(
			'07-04 and if saturday then previous friday if sunday then next monday',
			'Independence Day'
		),
		{
			rule: 'friday after 4th thursday in November',
			kind: 'session',
			reason: 'Day after Thanksgiving early close',
			sortOrder: 0,
			startTime: '09:30',
			endTime: '13:00'
		},
		{
			rule: '07-03',
			kind: 'session',
			reason: 'Independence Day early close',
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
	[{ startTime: '09:00', endTime: '15:30', sortOrder: 0 }],
	[
		{
			rule: 'korean 01-0-01 P3D',
			kind: 'ignore',
			reason: 'Misaligned Seollal span in the public calendar',
			sortOrder: 0,
			startTime: null,
			endTime: null
		},
		closedRule('korean 01-0-00 P3D', 'Seollal')
	]
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

	it('keeps rule-only markets open on public holidays they do not observe', () => {
		// Columbus Day: a US federal holiday, but a regular NYSE trading day.
		const status = buildMarketStatus(nyse, new Date('2026-10-12T17:00:00.000Z'));

		expectStatus(status, { currentStatus: 'open', countdownLabel: 'Closes in 3h 00m' });
	});

	it('applies recurring rules in every year without date-specific rows', () => {
		const calendar2027 = getCalendarYear(nyse, 2027);
		const calendar2028 = getCalendarYear(nyse, 2028);

		expect(calendar2027.closures.get('2027-03-26')).toBe('Good Friday');
		expect(calendar2028.closures.get('2028-04-14')).toBe('Good Friday');
		expect(calendar2027.specialSessions.get('2027-11-26')?.reason).toBe(
			'Day after Thanksgiving early close'
		);
	});

	it('lets an observed closure win over an early-close rule on the same day', () => {
		// July 4, 2026 is a Saturday, so Friday July 3 is the observed closure.
		const status = buildMarketStatus(nyse, new Date('2026-07-03T15:00:00.000Z'));

		expectStatus(status, {
			currentStatus: 'closed',
			supplementalDetail: 'Closed for Independence Day.'
		});
	});

	it('replaces ignored public holiday rules and expands multi-day holidays', () => {
		const calendar = getCalendarYear(krx, 2026);

		expect(calendar.closures.has('2026-02-16')).toBe(true);
		expect(calendar.closures.has('2026-02-18')).toBe(true);
		expect(calendar.closures.has('2026-02-19')).toBe(false);
		expect(calendar.holidays.has('2026-02-19')).toBe(false);
		// Chuseok spans three public holidays.
		expect(calendar.holidays.has('2026-09-24')).toBe(true);
		expect(calendar.holidays.has('2026-09-25')).toBe(true);
		expect(calendar.holidays.has('2026-09-26')).toBe(true);
	});

	it('rejects calendar rules that date-holidays cannot parse', () => {
		const broken = createScheduleFixture({ slug: 'broken' }, nyse.sessions, [
			closedRule('not a rule', 'Broken')
		]);

		expect(() => getCalendarYear(broken, 2026)).toThrow('Invalid calendar rule');
	});
});
