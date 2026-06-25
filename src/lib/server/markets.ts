import { env } from '$env/dynamic/private';
import { eq } from 'drizzle-orm';
import Holidays from 'date-holidays';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { marketStatusCache, type MarketWatchlist } from '$lib/server/db/schema';

export const MARKET_STATUS_CACHE_KEY = 'alpha-vantage-market-status';
export const MARKET_STATUS_MAX_AGE_MS = 65 * 60 * 1000;

type ScheduleMarket = {
	marketType: string;
	region: string;
	shortName: string;
	primaryExchanges: string;
	localOpen: string;
	localClose: string;
	timeZone: string;
	/** date-holidays country code, e.g. 'KR', 'TW' */
	countryCode: string;
	notes: string;
};

/** Markets whose open/closed status is computed locally from the clock + public holidays. */
export const SCHEDULE_MARKETS: ScheduleMarket[] = [
	{
		marketType: 'Equity',
		region: 'South Korea',
		shortName: 'KRX',
		primaryExchanges: 'Korea Exchange (KRX)',
		localOpen: '09:00',
		localClose: '15:30',
		timeZone: 'Asia/Seoul',
		countryCode: 'KR',
		notes: 'Schedule-based · South Korea holidays considered'
	},
	{
		marketType: 'Equity',
		region: 'Taiwan',
		shortName: 'TWSE',
		primaryExchanges: 'Taiwan Stock Exchange (TWSE)',
		localOpen: '09:00',
		localClose: '13:30',
		timeZone: 'Asia/Taipei',
		countryCode: 'TW',
		notes: 'Schedule-based · Taiwan holidays considered'
	}
];

const alphaVantageMarketSchema = z.object({
	market_type: z.string(),
	region: z.string(),
	primary_exchanges: z.string(),
	local_open: z.string(),
	local_close: z.string(),
	current_status: z.string(),
	notes: z.string().optional().default('')
});

const alphaVantageMarketStatusSchema = z.object({
	markets: z.array(alphaVantageMarketSchema)
});

const alphaVantageErrorSchema = z
	.object({
		Information: z.string().optional(),
		Note: z.string().optional(),
		'Error Message': z.string().optional()
	})
	.passthrough();

export type MarketStatusSource = 'live' | 'schedule' | 'unavailable';

export type MarketStatus = {
	marketType: string;
	region: string;
	primaryExchanges: string;
	localOpen: string;
	localClose: string;
	currentStatus: string;
	notes: string;
	statusSource: MarketStatusSource;
};

export type MarketStatusResult = {
	markets: MarketStatus[];
	fetchedAt: Date | null;
	stale: boolean;
	error?: string;
};

export type WatchedMarketStatus = MarketStatus & {
	id: number;
	displayName: string;
	sortOrder: number;
	hidden: boolean;
	isOpen: boolean;
	isUnknown: boolean;
};

export type HolidayLookup = {
	dates: Set<string>;
	available: boolean;
};

export function parseMarketStatusResponse(payload: unknown): MarketStatus[] {
	const parsed = alphaVantageMarketStatusSchema.safeParse(payload);
	if (!parsed.success) {
		const errorPayload = alphaVantageErrorSchema.safeParse(payload);
		const message = errorPayload.success
			? (errorPayload.data.Information ??
				errorPayload.data.Note ??
				errorPayload.data['Error Message'])
			: undefined;
		throw new Error(message ?? 'Alpha Vantage market status response did not include markets');
	}

	return parsed.data.markets.map((market) => ({
		marketType: market.market_type,
		region: market.region,
		primaryExchanges: market.primary_exchanges,
		localOpen: market.local_open,
		localClose: market.local_close,
		currentStatus: market.current_status.toLowerCase(),
		notes: market.notes,
		statusSource: 'live'
	}));
}

export function marketStatusKey(marketType: string, region: string): string {
	return `${marketType.trim().toLowerCase()}::${region.trim().toLowerCase()}`;
}

export function marketDisplayName(status: Pick<MarketStatus, 'marketType' | 'region'>): string {
	const scheduled = SCHEDULE_MARKETS.find(
		(market) =>
			market.marketType.toLowerCase() === status.marketType.toLowerCase() &&
			market.region.toLowerCase() === status.region.toLowerCase()
	);
	if (scheduled) return scheduled.shortName;
	if (status.region.toLowerCase() === 'global') return status.marketType;
	return status.region;
}

export function marketOptionLabel(status: MarketStatus): string {
	return `${status.marketType} · ${status.region} · ${status.primaryExchanges}`;
}

export function unconfiguredMarketStatuses(
	watchlist: Pick<MarketWatchlist, 'marketType' | 'region'>[],
	statuses: MarketStatus[]
): MarketStatus[] {
	const configuredKeys = new Set(
		watchlist.map((market) => marketStatusKey(market.marketType, market.region))
	);
	return statuses.filter(
		(status) => !configuredKeys.has(marketStatusKey(status.marketType, status.region))
	);
}

export function buildWatchedMarketStatuses(
	watchlist: MarketWatchlist[],
	statuses: MarketStatus[]
): WatchedMarketStatus[] {
	const statusesByKey = new Map(
		statuses.map((status) => [marketStatusKey(status.marketType, status.region), status])
	);

	return watchlist.flatMap((market) => {
		const status = statusesByKey.get(marketStatusKey(market.marketType, market.region));
		if (!status) {
			return [
				{
					id: market.id,
					displayName: market.displayName,
					sortOrder: market.sortOrder,
					hidden: market.hidden,
					marketType: market.marketType,
					region: market.region,
					primaryExchanges: 'Status unavailable',
					localOpen: '--:--',
					localClose: '--:--',
					currentStatus: 'unavailable',
					notes: '',
					statusSource: 'unavailable',
					isOpen: false,
					isUnknown: true
				}
			];
		}

		const currentStatus = status.currentStatus.toLowerCase();
		return [
			{
				...status,
				id: market.id,
				displayName: market.displayName,
				sortOrder: market.sortOrder,
				hidden: market.hidden,
				isOpen: currentStatus === 'open',
				isUnknown: currentStatus !== 'open' && currentStatus !== 'closed'
			}
		];
	});
}

export async function getMarketStatuses(
	maxAgeMs = MARKET_STATUS_MAX_AGE_MS
): Promise<MarketStatusResult> {
	const requestNow = new Date();
	const [cached] = await db
		.select()
		.from(marketStatusCache)
		.where(eq(marketStatusCache.key, MARKET_STATUS_CACHE_KEY))
		.limit(1);

	const now = Date.now();
	const cachedFetchedAt = cached?.fetchedAt ?? null;
	if (cached && cachedFetchedAt && now - cachedFetchedAt.getTime() < maxAgeMs) {
		try {
			return withScheduledMarkets(
				{
					markets: parseMarketStatusResponse(cached.data),
					fetchedAt: cachedFetchedAt,
					stale: false
				},
				requestNow
			);
		} catch {
			// Ignore invalid cached payloads and try a live refresh below.
		}
	}

	const apiKey = env.ALPHA_VANTAGE_API_KEY?.trim();
	if (!apiKey) {
		return withScheduledMarkets(fallbackMarketStatus(cached, 'missing-api-key'), requestNow);
	}

	try {
		const url = new URL('https://www.alphavantage.co/query');
		url.searchParams.set('function', 'MARKET_STATUS');
		url.searchParams.set('apikey', apiKey);

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Alpha Vantage returned HTTP ${response.status}`);
		}

		const payload: unknown = await response.json();
		const markets = parseMarketStatusResponse(payload);
		const fetchedAt = new Date();

		await db
			.insert(marketStatusCache)
			.values({ key: MARKET_STATUS_CACHE_KEY, data: payload, fetchedAt })
			.onConflictDoUpdate({
				target: marketStatusCache.key,
				set: { data: payload, fetchedAt }
			});

		return withScheduledMarkets({ markets, fetchedAt, stale: false }, requestNow);
	} catch (error) {
		return withScheduledMarkets(
			fallbackMarketStatus(
				cached,
				error instanceof Error ? error.message : 'market-status-fetch-failed'
			),
			requestNow
		);
	}
}

function fallbackMarketStatus(
	cached: typeof marketStatusCache.$inferSelect | undefined,
	error: string
): MarketStatusResult {
	if (!cached) {
		return { markets: [], fetchedAt: null, stale: true, error };
	}

	try {
		return {
			markets: parseMarketStatusResponse(cached.data),
			fetchedAt: cached.fetchedAt,
			stale: true,
			error
		};
	} catch {
		return { markets: [], fetchedAt: cached.fetchedAt, stale: true, error };
	}
}

function withScheduledMarkets(result: MarketStatusResult, now: Date): MarketStatusResult {
	const scheduled = SCHEDULE_MARKETS.map((market) => {
		const { year } = localDateTimeParts(now, market.timeZone);
		return buildScheduledMarketStatus(
			market,
			now,
			getHolidays(market.countryCode, year, market.timeZone)
		);
	});
	return {
		...result,
		markets: [...result.markets, ...scheduled]
	};
}

export function buildScheduledMarketStatus(
	market: ScheduleMarket,
	now: Date,
	holidays: HolidayLookup
): MarketStatus {
	const local = localDateTimeParts(now, market.timeZone);
	const isWeekend = local.weekday === 'Sat' || local.weekday === 'Sun';
	const isHoliday = holidays.available && holidays.dates.has(local.date);
	const isPotentiallyOpen =
		minutesFromTime(market.localOpen) <= local.minutes &&
		local.minutes <= minutesFromTime(market.localClose);

	let currentStatus = 'closed';
	let notes: string = market.notes;

	if (!isWeekend && isPotentiallyOpen) {
		if (!holidays.available) {
			currentStatus = 'unknown';
			notes = 'Schedule-based · holiday lookup unavailable';
		} else if (!isHoliday) {
			currentStatus = 'open';
		}
	}

	return {
		marketType: market.marketType,
		region: market.region,
		primaryExchanges: market.primaryExchanges,
		localOpen: market.localOpen,
		localClose: market.localClose,
		currentStatus,
		notes,
		statusSource: 'schedule'
	};
}

const holidayCache = new Map<string, HolidayLookup>();

/**
 * Resolve public holidays for a country/year offline via `date-holidays`.
 * Only `public` holidays are treated as market closures (observances are ignored).
 */
export function getHolidays(countryCode: string, year: number, timeZone: string): HolidayLookup {
	const cacheKey = `${countryCode}-${year}`;
	const cached = holidayCache.get(cacheKey);
	if (cached) return cached;

	try {
		const hd = new Holidays(countryCode, { timezone: timeZone });
		const dates = new Set(
			hd
				.getHolidays(year)
				.filter((holiday) => holiday.type === 'public')
				.map((holiday) => holiday.date.slice(0, 10))
		);
		const lookup: HolidayLookup = { dates, available: true };
		holidayCache.set(cacheKey, lookup);
		return lookup;
	} catch {
		return { dates: new Set(), available: false };
	}
}

function localDateTimeParts(
	date: Date,
	timeZone: string
): {
	year: number;
	date: string;
	weekday: string;
	minutes: number;
} {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		weekday: 'short',
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
		year,
		date: `${year}-${month}-${day}`,
		weekday: byType.weekday,
		minutes: hour * 60 + minute
	};
}

function minutesFromTime(value: string): number {
	const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
	return hours * 60 + minutes;
}
