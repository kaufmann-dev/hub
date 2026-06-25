import { asc, eq, inArray } from 'drizzle-orm';
import Holidays from 'date-holidays';
import { db } from '$lib/server/db';
import {
	marketWatchlist,
	supportedMarket,
	supportedMarketClosure,
	supportedMarketSession,
	type MarketWatchlist,
	type SupportedMarket
} from '$lib/server/db/schema';

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

type ScheduleDefinition = SupportedMarket & {
	sessions: SessionWindow[];
	closures: ClosureOverride[];
};

type DaySchedule = {
	date: string;
	sessions: SessionWindow[];
	source: 'regular' | 'special-session' | 'holiday' | 'weekend' | 'closed';
	reason: string | null;
};

export type ConfiguredMarket = MarketWatchlist & {
	market: SupportedMarket;
};

export type MarketStatus = {
	supportedMarketId: number;
	title: string;
	city: string;
	country: string;
	description: string;
	timezone: string;
	currentStatus: 'open' | 'closed';
	countdownLabel: string;
	nextTransitionKind: 'open' | 'close' | 'reopen';
	hoursLabel: string;
	supplementalDetail: string | null;
};

export type WatchedMarketStatus = MarketStatus & {
	id: number;
	hidden: boolean;
	sortOrder: number;
};

export type HolidayLookup = {
	namesByDate: Map<string, string>;
	available: boolean;
};

const holidayCache = new Map<string, HolidayLookup>();
const weekdayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export async function getConfiguredMarkets(includeHidden = true): Promise<ConfiguredMarket[]> {
	const rows = includeHidden
		? await db
				.select({ watchlist: marketWatchlist, market: supportedMarket })
				.from(marketWatchlist)
				.innerJoin(supportedMarket, eq(marketWatchlist.supportedMarketId, supportedMarket.id))
				.orderBy(asc(marketWatchlist.sortOrder), asc(supportedMarket.title))
		: await db
				.select({ watchlist: marketWatchlist, market: supportedMarket })
				.from(marketWatchlist)
				.innerJoin(supportedMarket, eq(marketWatchlist.supportedMarketId, supportedMarket.id))
				.where(eq(marketWatchlist.hidden, false))
				.orderBy(asc(marketWatchlist.sortOrder), asc(supportedMarket.title));

	return rows.map(({ watchlist, market }) => ({ ...watchlist, market }));
}

export async function getSupportedMarkets(): Promise<SupportedMarket[]> {
	return db.select().from(supportedMarket).orderBy(asc(supportedMarket.title));
}

export function unconfiguredSupportedMarkets(
	watchlist: Pick<MarketWatchlist, 'supportedMarketId'>[],
	markets: SupportedMarket[]
): SupportedMarket[] {
	const configuredIds = new Set(watchlist.map((market) => market.supportedMarketId));
	return markets.filter((market) => !configuredIds.has(market.id));
}

export function marketOptionLabel(market: SupportedMarket): string {
	return `${market.title} · ${market.city}, ${market.country}`;
}

export async function getWatchedMarketStatuses(now = new Date()): Promise<WatchedMarketStatus[]> {
	const configuredMarkets = await getConfiguredMarkets(false);
	return buildWatchedMarketStatuses(
		configuredMarkets,
		await loadScheduleDefinitions(configuredMarkets.map((market) => market.supportedMarketId)),
		now
	);
}

export async function loadScheduleDefinitions(
	marketIds: number[]
): Promise<Map<number, ScheduleDefinition>> {
	if (marketIds.length === 0) return new Map();

	const [markets, sessions, closures] = await Promise.all([
		db.select().from(supportedMarket).where(inArray(supportedMarket.id, marketIds)),
		db
			.select()
			.from(supportedMarketSession)
			.where(inArray(supportedMarketSession.marketId, marketIds))
			.orderBy(asc(supportedMarketSession.marketId), asc(supportedMarketSession.sortOrder)),
		db
			.select()
			.from(supportedMarketClosure)
			.where(inArray(supportedMarketClosure.marketId, marketIds))
			.orderBy(
				asc(supportedMarketClosure.marketId),
				asc(supportedMarketClosure.closureDate),
				asc(supportedMarketClosure.sortOrder)
			)
	]);

	const sessionsByMarket = new Map<number, SessionWindow[]>();
	for (const session of sessions) {
		const rows = sessionsByMarket.get(session.marketId) ?? [];
		rows.push({
			startTime: session.startTime,
			endTime: session.endTime,
			sortOrder: session.sortOrder
		});
		sessionsByMarket.set(session.marketId, rows);
	}

	const closuresByMarket = new Map<number, ClosureOverride[]>();
	for (const closure of closures) {
		const rows = closuresByMarket.get(closure.marketId) ?? [];
		rows.push({
			closureDate: closure.closureDate,
			kind: closure.kind as ClosureOverride['kind'],
			reason: closure.reason,
			sortOrder: closure.sortOrder,
			startTime: closure.startTime,
			endTime: closure.endTime
		});
		closuresByMarket.set(closure.marketId, rows);
	}

	return new Map(
		markets.map((market) => [
			market.id,
			{
				...market,
				sessions: sessionsByMarket.get(market.id) ?? [],
				closures: closuresByMarket.get(market.id) ?? []
			}
		])
	);
}

export function buildWatchedMarketStatuses(
	watchlist: ConfiguredMarket[],
	schedules: Map<number, ScheduleDefinition>,
	now = new Date()
): WatchedMarketStatus[] {
	return watchlist.map((entry) => {
		const schedule = schedules.get(entry.supportedMarketId);
		if (!schedule) {
			throw new Error(
				`Missing schedule definition for supported market ${entry.supportedMarketId}`
			);
		}

		const status = buildMarketStatus(schedule, now);
		return {
			...status,
			id: entry.id,
			hidden: entry.hidden,
			sortOrder: entry.sortOrder
		};
	});
}

export function buildMarketStatus(market: ScheduleDefinition, now: Date): MarketStatus {
	const local = localDateTimeParts(now, market.timezone);
	const today = dayScheduleForDate(market, local.date);
	const displaySessions = today.sessions.length > 0 ? today.sessions : market.sessions;
	const hoursLabel = formatHoursLabel(displaySessions);

	for (let index = 0; index < today.sessions.length; index += 1) {
		const session = today.sessions[index];
		const startMinutes = minutesFromTime(session.startTime);
		const endMinutes = minutesFromTime(session.endTime);

		if (local.minutes < startMinutes) {
			return {
				supportedMarketId: market.id,
				title: market.title,
				city: market.city,
				country: market.country,
				description: market.description,
				timezone: market.timezone,
				currentStatus: 'closed',
				countdownLabel: countdownLabel(
					index === 0 ? 'open' : 'reopen',
					zonedDateTimeToUtc(today.date, session.startTime, market.timezone),
					now
				),
				nextTransitionKind: index === 0 ? 'open' : 'reopen',
				hoursLabel,
				supplementalDetail:
					index === 0
						? detailForToday(today)
						: breakDetail(today.sessions[index - 1]!.endTime, session.startTime)
			};
		}

		if (local.minutes < endMinutes) {
			return {
				supportedMarketId: market.id,
				title: market.title,
				city: market.city,
				country: market.country,
				description: market.description,
				timezone: market.timezone,
				currentStatus: 'open',
				countdownLabel: countdownLabel(
					'close',
					zonedDateTimeToUtc(today.date, session.endTime, market.timezone),
					now
				),
				nextTransitionKind: 'close',
				hoursLabel,
				supplementalDetail: detailForOpenSession(today, index)
			};
		}
	}

	const nextOpening = findNextOpening(market, addDays(today.date, 1));
	const skippedDetail = nextOpening.firstSkippedReason
		? closureDetail(nextOpening.firstSkippedReason)
		: null;

	return {
		supportedMarketId: market.id,
		title: market.title,
		city: market.city,
		country: market.country,
		description: market.description,
		timezone: market.timezone,
		currentStatus: 'closed',
		countdownLabel: countdownLabel(
			'open',
			zonedDateTimeToUtc(nextOpening.date, nextOpening.session.startTime, market.timezone),
			now
		),
		nextTransitionKind: 'open',
		hoursLabel,
		supplementalDetail: today.sessions.length === 0 ? detailForToday(today) : skippedDetail
	};
}

export function getHolidays(
	holidayCalendarCode: string,
	year: number,
	timeZone: string
): HolidayLookup {
	const cacheKey = `${holidayCalendarCode}-${year}`;
	const cached = holidayCache.get(cacheKey);
	if (cached) return cached;

	try {
		const hd = new Holidays(holidayCalendarCode, { timezone: timeZone });
		const namesByDate = new Map<string, string>();

		for (const holiday of hd.getHolidays(year)) {
			if (holiday.type !== 'public') continue;
			if (!namesByDate.has(holiday.date.slice(0, 10))) {
				namesByDate.set(holiday.date.slice(0, 10), holiday.name);
			}
		}

		const lookup = { namesByDate, available: true };
		holidayCache.set(cacheKey, lookup);
		return lookup;
	} catch {
		return { namesByDate: new Map(), available: false };
	}
}

function dayScheduleForDate(market: ScheduleDefinition, date: string): DaySchedule {
	const overrides = market.closures.filter((closure) => closure.closureDate === date);
	const specialSessions = overrides
		.filter((closure) => closure.kind === 'session')
		.map((closure) => ({
			startTime: closure.startTime ?? '00:00',
			endTime: closure.endTime ?? '00:00',
			sortOrder: closure.sortOrder
		}))
		.sort((left, right) => left.sortOrder - right.sortOrder);

	if (specialSessions.length > 0) {
		return {
			date,
			sessions: specialSessions,
			source: 'special-session',
			reason: overrides[0]?.reason ?? null
		};
	}

	const closedOverride = overrides.find((closure) => closure.kind === 'closed');
	if (closedOverride) {
		return {
			date,
			sessions: [],
			source: 'closed',
			reason: closedOverride.reason
		};
	}

	const weekend = weekdayNames[weekdayNumber(date)];
	if (market.weekendDays.includes(weekend)) {
		return {
			date,
			sessions: [],
			source: 'weekend',
			reason: 'Weekend closure'
		};
	}

	const holidayName = holidayNameForDate(market, date);
	if (holidayName) {
		return {
			date,
			sessions: [],
			source: 'holiday',
			reason: holidayName
		};
	}

	return {
		date,
		sessions: [...market.sessions].sort((left, right) => left.sortOrder - right.sortOrder),
		source: 'regular',
		reason: null
	};
}

function findNextOpening(
	market: ScheduleDefinition,
	startDate: string
): { date: string; session: SessionWindow; firstSkippedReason: string | null } {
	let firstSkippedReason: string | null = null;

	for (let offset = 0; offset < 400; offset += 1) {
		const date = addDays(startDate, offset);
		const schedule = dayScheduleForDate(market, date);

		if (schedule.sessions.length > 0) {
			return {
				date,
				session: schedule.sessions[0]!,
				firstSkippedReason
			};
		}

		if (!firstSkippedReason && schedule.reason) {
			firstSkippedReason = schedule.reason;
		}
	}

	throw new Error(`No upcoming session found for supported market ${market.slug}`);
}

function holidayNameForDate(market: ScheduleDefinition, date: string): string | null {
	const year = Number.parseInt(date.slice(0, 4), 10);
	const holidays = getHolidays(market.holidayCalendarCode, year, market.timezone);
	return holidays.namesByDate.get(date) ?? null;
}

function detailForToday(schedule: DaySchedule): string | null {
	if (schedule.source === 'special-session' && schedule.reason) {
		return `Special session: ${schedule.reason}.`;
	}

	if (schedule.source === 'holiday' && schedule.reason) {
		return `Closed for ${schedule.reason}.`;
	}

	if (schedule.source === 'closed' && schedule.reason) {
		return `Closed for ${schedule.reason}.`;
	}

	if (schedule.source === 'weekend') {
		return 'Weekend closure.';
	}

	if (schedule.sessions.length > 1) {
		return firstBreakDetail(schedule.sessions);
	}

	return null;
}

function detailForOpenSession(schedule: DaySchedule, sessionIndex: number): string | null {
	if (schedule.source === 'special-session' && schedule.reason) {
		return `Special session: ${schedule.reason}.`;
	}

	if (schedule.sessions.length > sessionIndex + 1) {
		return breakDetail(
			schedule.sessions[sessionIndex]!.endTime,
			schedule.sessions[sessionIndex + 1]!.startTime
		);
	}

	if (schedule.sessions.length > 1) {
		return firstBreakDetail(schedule.sessions);
	}

	return null;
}

function firstBreakDetail(sessions: SessionWindow[]): string | null {
	if (sessions.length < 2) return null;
	return breakDetail(sessions[0]!.endTime, sessions[1]!.startTime);
}

function breakDetail(endTime: string, startTime: string): string {
	return `Midday break ${endTime}-${startTime} local time.`;
}

function closureDetail(reason: string): string {
	return reason === 'Weekend closure' ? 'Weekend closure.' : `Closed for ${reason}.`;
}

function countdownLabel(kind: 'open' | 'close' | 'reopen', target: Date, now: Date): string {
	const prefix = kind === 'close' ? 'Closes' : kind === 'reopen' ? 'Reopens' : 'Opens';
	return `${prefix} in ${formatCountdown(target.getTime() - now.getTime())}`;
}

function formatCountdown(milliseconds: number): string {
	const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

function formatHoursLabel(sessions: SessionWindow[]): string {
	return sessions.map((session) => `${session.startTime}-${session.endTime}`).join(' · ');
}

function minutesFromTime(value: string): number {
	const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
	return hours * 60 + minutes;
}

function localDateTimeParts(
	date: Date,
	timeZone: string
): {
	date: string;
	minutes: number;
} {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(date);
	const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	const year = Number.parseInt(byType.year, 10);
	const month = byType.month;
	const day = byType.day;
	const hour = Number.parseInt(byType.hour, 10);
	const minute = Number.parseInt(byType.minute, 10);

	return {
		date: `${year}-${month}-${day}`,
		minutes: hour * 60 + minute
	};
}

function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
	const [year, month, day] = date.split('-').map((part) => Number.parseInt(part, 10));
	const [hour, minute] = time.split(':').map((part) => Number.parseInt(part, 10));
	const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute);
	const firstPass = new Date(
		naiveUtcMs - timeZoneOffsetMinutes(new Date(naiveUtcMs), timeZone) * 60_000
	);
	const correctedOffset = timeZoneOffsetMinutes(firstPass, timeZone);
	return new Date(naiveUtcMs - correctedOffset * 60_000);
}

function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		timeZoneName: 'shortOffset',
		hour: '2-digit',
		minute: '2-digit'
	}).formatToParts(date);
	const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
	if (offset === 'GMT') return 0;

	const match = /^GMT(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?$/.exec(offset);
	if (!match?.groups) return 0;

	const hours = Number.parseInt(match.groups.hours, 10);
	const minutes = Number.parseInt(match.groups.minutes ?? '0', 10);
	const total = hours * 60 + minutes;
	return match.groups.sign === '-' ? -total : total;
}

function weekdayNumber(date: string): number {
	const [year, month, day] = date.split('-').map((part) => Number.parseInt(part, 10));
	return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(date: string, days: number): string {
	const [year, month, day] = date.split('-').map((part) => Number.parseInt(part, 10));
	const value = new Date(Date.UTC(year, month - 1, day));
	value.setUTCDate(value.getUTCDate() + days);

	return [
		value.getUTCFullYear(),
		String(value.getUTCMonth() + 1).padStart(2, '0'),
		String(value.getUTCDate()).padStart(2, '0')
	].join('-');
}
