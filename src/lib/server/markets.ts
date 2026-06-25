import { env } from '$env/dynamic/private';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { marketStatusCache, type MarketWatchlist } from '$lib/server/db/schema';

export const MARKET_STATUS_CACHE_KEY = 'alpha-vantage-market-status';
export const MARKET_STATUS_MAX_AGE_MS = 65 * 60 * 1000;
export const KRX_HOLIDAY_CACHE_KEY_PREFIX = 'nager-date-holidays-KR';

const KRX_MARKET = {
	marketType: 'Equity',
	region: 'South Korea',
	primaryExchanges: 'Korea Exchange (KRX)',
	localOpen: '09:00',
	localClose: '15:30',
	timeZone: 'Asia/Seoul',
	countryCode: 'KR',
	notes: 'Schedule-based · South Korea holidays considered'
} as const;

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

const nagerHolidaySchema = z.array(
	z
		.object({
			date: z.string()
		})
		.passthrough()
);

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
	if (
		status.marketType.toLowerCase() === KRX_MARKET.marketType.toLowerCase() &&
		status.region.toLowerCase() === KRX_MARKET.region.toLowerCase()
	) {
		return 'KRX';
	}
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
	const krxNow = new Date();
	const [cached] = await db
		.select()
		.from(marketStatusCache)
		.where(eq(marketStatusCache.key, MARKET_STATUS_CACHE_KEY))
		.limit(1);

	const now = Date.now();
	const cachedFetchedAt = cached?.fetchedAt ?? null;
	if (cached && cachedFetchedAt && now - cachedFetchedAt.getTime() < maxAgeMs) {
		try {
			const holidays = await getKrxHolidays(krxNow);
			return {
				markets: [...parseMarketStatusResponse(cached.data), buildKrxMarketStatus(krxNow, holidays)],
				fetchedAt: cachedFetchedAt,
				stale: false
			};
		} catch {
			// Ignore invalid cached payloads and try a live refresh below.
		}
	}

	const apiKey = env.ALPHA_VANTAGE_API_KEY?.trim();
	if (!apiKey) {
		return withScheduledMarkets(await fallbackMarketStatus(cached, 'missing-api-key'), krxNow);
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

		return withScheduledMarkets({ markets, fetchedAt, stale: false }, krxNow);
	} catch (error) {
		return withScheduledMarkets(
			fallbackMarketStatus(
				cached,
				error instanceof Error ? error.message : 'market-status-fetch-failed'
			),
			krxNow
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

async function withScheduledMarkets(
	result: MarketStatusResult,
	now: Date
): Promise<MarketStatusResult> {
	const holidays = await getKrxHolidays(now);
	return {
		...result,
		markets: [...result.markets, buildKrxMarketStatus(now, holidays)]
	};
}

export function buildKrxMarketStatus(now: Date, holidays: HolidayLookup): MarketStatus {
	const local = localDateTimeParts(now, KRX_MARKET.timeZone);
	const isWeekend = local.weekday === 'Sat' || local.weekday === 'Sun';
	const isHoliday = holidays.available && holidays.dates.has(local.date);
	const isPotentiallyOpen =
		minutesFromTime(KRX_MARKET.localOpen) <= local.minutes &&
		local.minutes <= minutesFromTime(KRX_MARKET.localClose);

	let currentStatus = 'closed';
	let notes = KRX_MARKET.notes;

	if (!isWeekend && !isHoliday && isPotentiallyOpen) {
		currentStatus = holidays.available ? 'open' : 'unknown';
		if (!holidays.available) {
			notes = 'Schedule-based · holiday lookup unavailable';
		}
	} else if (!holidays.available && !isWeekend && isPotentiallyOpen) {
		currentStatus = 'unknown';
		notes = 'Schedule-based · holiday lookup unavailable';
	}

	return {
		marketType: KRX_MARKET.marketType,
		region: KRX_MARKET.region,
		primaryExchanges: KRX_MARKET.primaryExchanges,
		localOpen: KRX_MARKET.localOpen,
		localClose: KRX_MARKET.localClose,
		currentStatus,
		notes,
		statusSource: 'schedule'
	};
}

async function getKrxHolidays(now: Date): Promise<HolidayLookup> {
	const year = localDateTimeParts(now, KRX_MARKET.timeZone).year;
	const cacheKey = krxHolidayCacheKey(year);
	const [cached] = await db
		.select()
		.from(marketStatusCache)
		.where(eq(marketStatusCache.key, cacheKey))
		.limit(1);

	const cachedDates = cached ? parseHolidayDates(cached.data) : null;
	if (cachedDates) {
		return { dates: cachedDates, available: true };
	}

	try {
		const response = await fetch(
			`https://date.nager.at/api/v3/PublicHolidays/${year}/${KRX_MARKET.countryCode}`
		);
		if (!response.ok) {
			throw new Error(`Nager.Date returned HTTP ${response.status}`);
		}

		const payload: unknown = await response.json();
		const dates = parseHolidayDates(payload);
		if (!dates) {
			throw new Error('Nager.Date holiday response did not include dates');
		}

		await db
			.insert(marketStatusCache)
			.values({ key: cacheKey, data: payload, fetchedAt: new Date() })
			.onConflictDoUpdate({
				target: marketStatusCache.key,
				set: { data: payload, fetchedAt: new Date() }
			});

		return { dates, available: true };
	} catch {
		return cachedDates ? { dates: cachedDates, available: true } : { dates: new Set(), available: false };
	}
}

export function krxHolidayCacheKey(year: number): string {
	return `${KRX_HOLIDAY_CACHE_KEY_PREFIX}-${year}`;
}

function parseHolidayDates(payload: unknown): Set<string> | null {
	const parsed = nagerHolidaySchema.safeParse(payload);
	if (!parsed.success) return null;
	return new Set(parsed.data.map((holiday) => holiday.date));
}

function localDateTimeParts(date: Date, timeZone: string): {
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
