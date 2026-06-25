import { env } from '$env/dynamic/private';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { marketStatusCache, type MarketWatchlist } from '$lib/server/db/schema';

export const MARKET_STATUS_CACHE_KEY = 'alpha-vantage-market-status';
export const MARKET_STATUS_MAX_AGE_MS = 65 * 60 * 1000;

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

export type MarketStatus = {
	marketType: string;
	region: string;
	primaryExchanges: string;
	localOpen: string;
	localClose: string;
	currentStatus: string;
	notes: string;
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

export function parseMarketStatusResponse(payload: unknown): MarketStatus[] {
	const parsed = alphaVantageMarketStatusSchema.safeParse(payload);
	if (!parsed.success) {
		throw new Error('Alpha Vantage market status response did not include markets');
	}

	return parsed.data.markets.map((market) => ({
		marketType: market.market_type,
		region: market.region,
		primaryExchanges: market.primary_exchanges,
		localOpen: market.local_open,
		localClose: market.local_close,
		currentStatus: market.current_status.toLowerCase(),
		notes: market.notes
	}));
}

export function marketStatusKey(marketType: string, region: string): string {
	return `${marketType.trim().toLowerCase()}::${region.trim().toLowerCase()}`;
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
		if (!status) return [];

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
	const [cached] = await db
		.select()
		.from(marketStatusCache)
		.where(eq(marketStatusCache.key, MARKET_STATUS_CACHE_KEY))
		.limit(1);

	const now = Date.now();
	const cachedFetchedAt = cached?.fetchedAt ?? null;
	if (cached && cachedFetchedAt && now - cachedFetchedAt.getTime() < maxAgeMs) {
		return {
			markets: parseMarketStatusResponse(cached.data),
			fetchedAt: cachedFetchedAt,
			stale: false
		};
	}

	const apiKey = env.ALPHA_VANTAGE_API_KEY?.trim();
	if (!apiKey) {
		return fallbackMarketStatus(cached, 'missing-api-key');
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

		return { markets, fetchedAt, stale: false };
	} catch (error) {
		return fallbackMarketStatus(
			cached,
			error instanceof Error ? error.message : 'market-status-fetch-failed'
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
