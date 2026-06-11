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
type Icon = { data: Buffer; contentType: string; sourceUrl: string };
type CandidateGroups = { light: URL[]; dark: URL[]; unqualified: URL[] };

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
		return containsSvgMarkup(data) ? declared : null;
	}
	if (data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
	if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
	if (data.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
	if (data.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
	const signature = data.subarray(0, 4).toString('hex');
	return signature === '00000100' || signature === '00000200' ? 'image/x-icon' : null;
}

function containsSvgMarkup(data: Buffer): boolean {
	return /<svg(?:\s|>)/i.test(data.toString('utf8'));
}

function inlineSvgData(url: URL): Buffer | null {
	if (url.protocol !== 'data:') return null;

	const comma = url.href.indexOf(',');
	if (comma === -1) return null;
	const metadata = url.href.slice(5, comma).split(';');
	if (metadata.shift()?.toLowerCase() !== 'image/svg+xml') return null;

	let base64 = false;
	for (const parameter of metadata) {
		const normalized = parameter.toLowerCase();
		if (normalized === 'base64' && !base64) {
			base64 = true;
		} else if (!/^charset=(?:utf-8|us-ascii)$/.test(normalized)) {
			return null;
		}
	}

	const encoded = url.href.slice(comma + 1);
	try {
		let data: Buffer;
		if (base64) {
			if (
				encoded.length > Math.ceil((MAX_ICON_BYTES * 4) / 3) + 4 ||
				!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
			) {
				return null;
			}
			data = Buffer.from(encoded, 'base64');
		} else {
			if (encoded.length > MAX_ICON_BYTES * 3) return null;
			data = Buffer.from(decodeURIComponent(encoded), 'utf8');
		}
		return data.byteLength <= MAX_ICON_BYTES && containsSvgMarkup(data) ? data : null;
	} catch {
		return null;
	}
}

export function faviconCandidates(html: string, pageUrl: URL): CandidateGroups {
	const $ = cheerio.load(html);
	const groups: CandidateGroups = { light: [], dark: [], unqualified: [] };
	const derivedDark: URL[] = [];
	$('link[href]').each((_index, element) => {
		const rel = ($(element).attr('rel') ?? '').toLowerCase().split(/\s+/);
		if (!rel.some((value) => value === 'icon' || value === 'apple-touch-icon')) return;
		const href = $(element).attr('href');
		if (!href) return;
		try {
			const url = new URL(href, pageUrl);
			const media = ($(element).attr('media') ?? '').toLowerCase();
			const group = media.includes('prefers-color-scheme')
				? media.includes('dark')
					? groups.dark
					: media.includes('light')
						? groups.light
						: null
				: media
					? null
					: groups.unqualified;
			const validDeclaration =
				group !== null &&
				(['http:', 'https:'].includes(url.protocol) ||
					(url.protocol === 'data:' && inlineSvgData(url) !== null));
			if (validDeclaration && !group.some((item) => item.href === url.href)) {
				group.push(url);
			}

			const baseHref = $(element).attr('data-base-href');
			const extension = url.pathname.match(/(\.[^./]+)$/)?.[1];
			if (!validDeclaration || !baseHref || !extension) return;
			const darkUrl = new URL(baseHref, pageUrl);
			darkUrl.pathname = `${darkUrl.pathname}-dark${extension}`;
			if (
				['http:', 'https:'].includes(darkUrl.protocol) &&
				!derivedDark.some((item) => item.href === darkUrl.href)
			) {
				derivedDark.push(darkUrl);
			}
		} catch {
			// Ignore malformed icon links and continue with other candidates.
		}
	});
	groups.dark.push(
		...derivedDark.filter((url) => !groups.dark.some((item) => item.href === url.href))
	);
	return groups;
}

function directCandidates(pageUrl: URL): URL[] {
	return [new URL('/favicon.ico', pageUrl), new URL('/favicon.svg', pageUrl)];
}

function providerCandidates(pageUrl: URL): URL[] {
	const google = new URL('https://www.google.com/s2/favicons');
	google.searchParams.set('domain_url', pageUrl.origin);
	google.searchParams.set('sz', '128');
	return [google, new URL(`https://icons.duckduckgo.com/ip3/${pageUrl.hostname}.ico`)];
}

async function firstUsableCandidate(
	candidates: URL[],
	pageSourceUrl: string,
	fetcher: Fetcher,
	validateUrl: UrlValidator,
	downloads: Map<string, Promise<Icon | null>>
): Promise<Icon | null> {
	for (const candidate of candidates) {
		let download = downloads.get(candidate.href);
		if (!download) {
			download = (async () => {
				if (candidate.protocol === 'data:') {
					const data = inlineSvgData(candidate);
					return data ? { data, contentType: 'image/svg+xml', sourceUrl: pageSourceUrl } : null;
				}
				try {
					const icon = await safeFetch(candidate, MAX_ICON_BYTES, fetcher, validateUrl);
					const contentType = normalizedImageType(icon.response, icon.data);
					return contentType ? { data: icon.data, contentType, sourceUrl: candidate.href } : null;
				} catch {
					return null;
				}
			})();
			downloads.set(candidate.href, download);
		}
		const icon = await download;
		if (icon) return icon;
	}
	return null;
}

export async function discoverFavicon(
	url: string,
	fetcher: Fetcher = fetch,
	validateUrl: UrlValidator = assertPublicUrl
): Promise<
	Icon & {
		darkData: Buffer | null;
		darkContentType: string | null;
		darkSourceUrl: string | null;
	}
> {
	const pageUrl = new URL(url);
	let effectivePageUrl = pageUrl;
	let declaredCandidates: CandidateGroups = { light: [], dark: [], unqualified: [] };
	const downloads = new Map<string, Promise<Icon | null>>();

	try {
		const page = await safeFetch(pageUrl, MAX_HTML_BYTES, fetcher, validateUrl);
		effectivePageUrl = new URL(page.response.url || pageUrl);
		const contentType = page.response.headers.get('content-type')?.toLowerCase() ?? '';
		if (contentType.includes('text/html')) {
			declaredCandidates = faviconCandidates(page.data.toString('utf8'), effectivePageUrl);
		}
	} catch {
		// A blocked or unavailable homepage must not prevent fallback discovery.
	}

	const sharedFallbacks = [
		...declaredCandidates.unqualified,
		...directCandidates(effectivePageUrl),
		...providerCandidates(effectivePageUrl)
	];
	const light = await firstUsableCandidate(
		[...declaredCandidates.light, ...sharedFallbacks],
		effectivePageUrl.href,
		fetcher,
		validateUrl,
		downloads
	);
	if (!light) throw new Error('No usable favicon found');

	const dark = await firstUsableCandidate(
		[...declaredCandidates.dark, ...sharedFallbacks],
		effectivePageUrl.href,
		fetcher,
		validateUrl,
		downloads
	);
	const distinctDark = dark && !dark.data.equals(light.data) ? dark : null;

	return {
		...light,
		darkData: distinctDark?.data ?? null,
		darkContentType: distinctDark?.contentType ?? null,
		darkSourceUrl: distinctDark?.sourceUrl ?? null
	};
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
			data: websiteFavicon.data,
			checkedAt: websiteFavicon.checkedAt
		})
		.from(website)
		.leftJoin(websiteFavicon, eq(website.id, websiteFavicon.websiteId))
		.orderBy(asc(website.id));

	for (const row of rows) {
		const retryAge = row.data ? maxAgeMs : MISSING_RETRY_MS;
		if (!row.checkedAt || Date.now() - row.checkedAt.getTime() > retryAge) {
			void refreshWebsiteFavicon(row.id, row.url);
		}
	}
}

/** Refresh every website with at most four active discoveries. */
export async function refreshAllWebsiteFavicons(): Promise<{ refreshed: number; failed: number }> {
	const rows = await db
		.select({ id: website.id, url: website.url })
		.from(website)
		.orderBy(asc(website.id));
	let nextIndex = 0;
	let refreshed = 0;
	let failed = 0;

	async function worker() {
		while (nextIndex < rows.length) {
			const row = rows[nextIndex++];
			if (await refreshWebsiteFavicon(row.id, row.url)) refreshed += 1;
			else failed += 1;
		}
	}

	await Promise.all(Array.from({ length: Math.min(4, rows.length) }, () => worker()));
	return { refreshed, failed };
}
