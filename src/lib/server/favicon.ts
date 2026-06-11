import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import * as cheerio from 'cheerio';
import { asc, eq } from 'drizzle-orm';
import { db } from './db';
import { website, websiteFavicon } from './db/schema';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 1_000_000;
const MAX_ICON_BYTES = 512_000;
const MAX_REDIRECTS = 5;
const MISSING_RETRY_MS = 60 * 60 * 1000;
const CHECK_THROTTLE_MS = 60_000;

let lastStaleCheck = 0;
const inFlight = new Map<number, Promise<boolean>>();

type Fetcher = typeof fetch;
type UrlValidator = (url: URL) => Promise<void>;

export function isPrivateIp(address: string): boolean {
	const normalized = address.toLowerCase().replace(/^::ffff:/, '');
	if (isIP(normalized) === 4) {
		const [a, b] = normalized.split('.').map(Number);
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			a >= 224
		);
	}
	return (
		normalized === '::' ||
		normalized === '::1' ||
		normalized.startsWith('fc') ||
		normalized.startsWith('fd') ||
		normalized.startsWith('fe8') ||
		normalized.startsWith('fe9') ||
		normalized.startsWith('fea') ||
		normalized.startsWith('feb') ||
		normalized.startsWith('ff')
	);
}

export async function assertPublicUrl(url: URL): Promise<void> {
	if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol');
	if (url.username || url.password) throw new Error('URLs with credentials are not allowed');
	const hostname = url.hostname.toLowerCase();
	if (hostname === 'localhost' || hostname.endsWith('.localhost'))
		throw new Error('Local URL blocked');

	const addresses = isIP(hostname)
		? [{ address: hostname }]
		: await lookup(hostname, { all: true });
	if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
		throw new Error('Private or unresolved URL blocked');
	}
}

async function safeFetch(
	url: URL,
	maxBytes: number,
	fetcher: Fetcher,
	validateUrl: UrlValidator
): Promise<{ response: Response; data: Buffer }> {
	let current = url;
	for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
		await validateUrl(current);
		const response = await fetcher(current, {
			redirect: 'manual',
			headers: { 'User-Agent': 'hub.kaufmann.dev favicon fetcher' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location || redirects === MAX_REDIRECTS) throw new Error('Invalid favicon redirect');
			current = new URL(location, current);
			continue;
		}
		if (!response.ok) throw new Error(`Favicon source responded ${response.status}`);
		const length = Number(response.headers.get('content-length'));
		if (Number.isFinite(length) && length > maxBytes)
			throw new Error('Favicon source is too large');
		const data = Buffer.from(await response.arrayBuffer());
		if (data.byteLength > maxBytes) throw new Error('Favicon source is too large');
		return { response, data };
	}
	throw new Error('Too many favicon redirects');
}

function normalizedImageType(response: Response, data: Buffer): string | null {
	const declared = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
	if (declared === 'image/svg+xml') {
		const start = data.subarray(0, 1024).toString('utf8').trimStart().toLowerCase();
		return start.includes('<svg') ? declared : null;
	}
	if (data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
	if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
	if (data.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
	if (data.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
	const signature = data.subarray(0, 4).toString('hex');
	return signature === '00000100' || signature === '00000200' ? 'image/x-icon' : null;
}

export function faviconCandidates(html: string, pageUrl: URL): URL[] {
	const $ = cheerio.load(html);
	const urls: URL[] = [];
	$('link[href]').each((_index, element) => {
		const rel = ($(element).attr('rel') ?? '').toLowerCase().split(/\s+/);
		if (!rel.some((value) => value === 'icon' || value === 'apple-touch-icon')) return;
		const href = $(element).attr('href');
		if (!href) return;
		try {
			const url = new URL(href, pageUrl);
			if (
				['http:', 'https:'].includes(url.protocol) &&
				!urls.some((item) => item.href === url.href)
			) {
				urls.push(url);
			}
		} catch {
			// Ignore malformed icon links and continue with other candidates.
		}
	});
	const fallback = new URL('/favicon.ico', pageUrl);
	if (!urls.some((item) => item.href === fallback.href)) urls.push(fallback);
	return urls;
}

export async function discoverFavicon(
	url: string,
	fetcher: Fetcher = fetch,
	validateUrl: UrlValidator = assertPublicUrl
): Promise<{
	data: Buffer;
	contentType: string;
	sourceUrl: string;
}> {
	const pageUrl = new URL(url);
	const page = await safeFetch(pageUrl, MAX_HTML_BYTES, fetcher, validateUrl);
	const contentType = page.response.headers.get('content-type')?.toLowerCase() ?? '';
	const candidates = contentType.includes('text/html')
		? faviconCandidates(page.data.toString('utf8'), new URL(page.response.url || pageUrl))
		: [new URL('/favicon.ico', pageUrl)];

	for (const candidate of candidates) {
		try {
			const icon = await safeFetch(candidate, MAX_ICON_BYTES, fetcher, validateUrl);
			const iconType = normalizedImageType(icon.response, icon.data);
			if (iconType) return { data: icon.data, contentType: iconType, sourceUrl: candidate.href };
		} catch {
			// Continue until a declared icon or the conventional fallback works.
		}
	}
	throw new Error('No usable favicon found');
}

async function recordFailure(websiteId: number): Promise<void> {
	const now = new Date();
	await db
		.insert(websiteFavicon)
		.values({ websiteId, checkedAt: now })
		.onConflictDoUpdate({ target: websiteFavicon.websiteId, set: { checkedAt: now } });
}

export function refreshWebsiteFavicon(websiteId: number, url: string): Promise<boolean> {
	const existing = inFlight.get(websiteId);
	if (existing) return existing;
	const refresh = (async () => {
		try {
			const icon = await discoverFavicon(url);
			await db
				.insert(websiteFavicon)
				.values({ websiteId, ...icon, checkedAt: new Date() })
				.onConflictDoUpdate({
					target: websiteFavicon.websiteId,
					set: { ...icon, checkedAt: new Date() }
				});
			return true;
		} catch (error) {
			await recordFailure(websiteId);
			console.error(`Favicon refresh error for website ${websiteId}:`, error);
			return false;
		} finally {
			inFlight.delete(websiteId);
		}
	})();
	inFlight.set(websiteId, refresh);
	return refresh;
}

/** Trigger best-effort background refreshes for stale discovered favicons. */
export async function refreshStaleFavicons(maxAgeMs: number): Promise<void> {
	if (Date.now() - lastStaleCheck < CHECK_THROTTLE_MS) return;
	lastStaleCheck = Date.now();
	const rows = await db
		.select({
			id: website.id,
			url: website.url,
			iconUrl: website.iconUrl,
			data: websiteFavicon.data,
			checkedAt: websiteFavicon.checkedAt
		})
		.from(website)
		.leftJoin(websiteFavicon, eq(website.id, websiteFavicon.websiteId))
		.orderBy(asc(website.id));

	for (const row of rows) {
		if (row.iconUrl) continue;
		const retryAge = row.data ? maxAgeMs : MISSING_RETRY_MS;
		if (!row.checkedAt || Date.now() - row.checkedAt.getTime() > retryAge) {
			void refreshWebsiteFavicon(row.id, row.url);
		}
	}
}

export async function clearWebsiteFavicon(websiteId: number): Promise<void> {
	await db.delete(websiteFavicon).where(eq(websiteFavicon.websiteId, websiteId));
}
