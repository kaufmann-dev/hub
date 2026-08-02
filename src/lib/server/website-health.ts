import { and, asc, eq } from 'drizzle-orm';
import type {
	WebsiteHealthFailureKind,
	WebsiteHealthRefreshResponse,
	WebsiteHealthSnapshot
} from '$lib/website-health';
import { db } from './db';
import { website, websiteHealth } from './db/schema';
import { assertPublicUrl } from './public-url';

export const WEBSITE_HEALTH_MAX_AGE_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 5;
const MAX_CONCURRENCY = 6;

type Fetcher = typeof fetch;
type UrlValidator = (url: URL) => Promise<void>;

export interface WebsiteHealthCheckResult {
	healthy: boolean;
	statusCode: number | null;
	failureKind: WebsiteHealthFailureKind | null;
}

function failure(
	failureKind: WebsiteHealthFailureKind,
	statusCode: number | null = null
): WebsiteHealthCheckResult {
	return { healthy: false, statusCode, failureKind };
}

function isBlockedUrlError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return /unsupported url protocol|credentials are not allowed|local url blocked|private or unresolved url blocked/i.test(
		error.message
	);
}

function waitWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	if (signal.aborted) return Promise.reject(signal.reason);
	return new Promise<T>((resolve, reject) => {
		const onAbort = () => reject(signal.reason);
		signal.addEventListener('abort', onAbort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener('abort', onAbort);
				resolve(value);
			},
			(error) => {
				signal.removeEventListener('abort', onAbort);
				reject(error);
			}
		);
	});
}

async function discardBody(response: Response): Promise<void> {
	try {
		await response.body?.cancel();
	} catch {
		// Headers are enough for availability; body cancellation is best-effort.
	}
}

export async function checkWebsiteHealth(
	url: string,
	fetcher: Fetcher = fetch,
	validateUrl: UrlValidator = assertPublicUrl,
	timeoutMs = FETCH_TIMEOUT_MS
): Promise<WebsiteHealthCheckResult> {
	let current: URL;
	try {
		current = new URL(url);
	} catch {
		return failure('blocked');
	}

	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(new DOMException('Website health check timed out', 'TimeoutError')),
		timeoutMs
	);

	try {
		for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
			await waitWithSignal(validateUrl(current), controller.signal);
			const response = await waitWithSignal(
				fetcher(current, {
					redirect: 'manual',
					headers: {
						Accept: 'text/html',
						'User-Agent': 'hub.kaufmann.dev website health checker'
					},
					signal: controller.signal
				}),
				controller.signal
			);
			const location = response.headers.get('location');
			if (response.status >= 300 && response.status < 400 && location) {
				await discardBody(response);
				if (redirects === MAX_REDIRECTS) return failure('redirect', response.status);
				try {
					current = new URL(location, current);
				} catch {
					return failure('redirect', response.status);
				}
				continue;
			}

			await discardBody(response);
			return response.status >= 200 && response.status < 400
				? { healthy: true, statusCode: response.status, failureKind: null }
				: failure('http', response.status);
		}
		return failure('redirect');
	} catch (error) {
		if (
			controller.signal.aborted ||
			(error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))
		) {
			return failure('timeout');
		}
		return failure(isBlockedUrlError(error) ? 'blocked' : 'network');
	} finally {
		clearTimeout(timeout);
	}
}

const inFlightChecks = new Map<number, Promise<void>>();
let inFlightBatch: Promise<void> | null = null;

function refreshWebsiteHealth(websiteId: number, url: string): Promise<void> {
	const existing = inFlightChecks.get(websiteId);
	if (existing) return existing;

	const refresh = (async () => {
		try {
			const result = await checkWebsiteHealth(url);
			const checkedAt = new Date();
			await db
				.insert(websiteHealth)
				.values({ websiteId, ...result, checkedAt })
				.onConflictDoUpdate({
					target: websiteHealth.websiteId,
					set: { ...result, checkedAt }
				});
		} finally {
			inFlightChecks.delete(websiteId);
		}
	})();
	inFlightChecks.set(websiteId, refresh);
	return refresh;
}

/** Refresh missing or stale visible personal website results with one shared concurrent batch. */
export function refreshStaleWebsiteHealth(maxAgeMs = WEBSITE_HEALTH_MAX_AGE_MS): Promise<void> {
	if (inFlightBatch) return inFlightBatch;

	const batch = (async () => {
		const rows = await db
			.select({
				id: website.id,
				url: website.url,
				checkedAt: websiteHealth.checkedAt
			})
			.from(website)
			.leftJoin(websiteHealth, eq(website.id, websiteHealth.websiteId))
			.where(and(eq(website.hidden, false), eq(website.kind, 'personal')))
			.orderBy(asc(website.id));
		const stale = rows.filter(
			(row) => !row.checkedAt || Date.now() - row.checkedAt.getTime() > maxAgeMs
		);
		let nextIndex = 0;

		async function worker() {
			while (nextIndex < stale.length) {
				const row = stale[nextIndex++];
				await refreshWebsiteHealth(row.id, row.url);
			}
		}

		await Promise.all(
			Array.from({ length: Math.min(MAX_CONCURRENCY, stale.length) }, () => worker())
		);
	})();
	inFlightBatch = batch;
	void batch.then(
		() => {
			if (inFlightBatch === batch) inFlightBatch = null;
		},
		() => {
			if (inFlightBatch === batch) inFlightBatch = null;
		}
	);
	return batch;
}

function asFailureKind(value: string | null): WebsiteHealthFailureKind | null {
	return value === 'http' ||
		value === 'timeout' ||
		value === 'network' ||
		value === 'blocked' ||
		value === 'redirect'
		? value
		: null;
}

export function healthSnapshot(
	healthy: boolean | null,
	statusCode: number | null,
	failureKind: string | null,
	checkedAt: Date | null
): WebsiteHealthSnapshot | null {
	if (healthy === null || checkedAt === null) return null;
	return {
		state: healthy ? 'healthy' : 'unhealthy',
		statusCode,
		failureKind: asFailureKind(failureKind),
		checkedAt: checkedAt.toISOString()
	};
}

export async function getVisibleWebsiteHealth(): Promise<WebsiteHealthRefreshResponse> {
	const rows = await db
		.select({
			websiteId: website.id,
			healthy: websiteHealth.healthy,
			statusCode: websiteHealth.statusCode,
			failureKind: websiteHealth.failureKind,
			checkedAt: websiteHealth.checkedAt
		})
		.from(website)
		.leftJoin(websiteHealth, eq(website.id, websiteHealth.websiteId))
		.where(and(eq(website.hidden, false), eq(website.kind, 'personal')))
		.orderBy(asc(website.id));

	return {
		healthByWebsiteId: Object.fromEntries(
			rows.map((row) => [
				String(row.websiteId),
				healthSnapshot(row.healthy, row.statusCode, row.failureKind, row.checkedAt)
			])
		)
	};
}
