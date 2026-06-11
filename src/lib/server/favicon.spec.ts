import { describe, expect, it, vi } from 'vitest';
import { assertPublicUrl, discoverFavicon, faviconCandidates, isPrivateIp } from './favicon';

const allowUrl = async () => undefined;

describe('favicon discovery', () => {
	it('extracts declared icons and resolves relative URLs', () => {
		const candidates = faviconCandidates(
			`
				<link rel="stylesheet" href="/styles.css">
				<link rel="icon" href="static/favicon.svg">
				<link rel="apple-touch-icon" href="/touch.png">
			`,
			new URL('https://example.com/path/')
		);

		expect(candidates.unqualified.map(String)).toEqual([
			'https://example.com/path/static/favicon.svg',
			'https://example.com/touch.png'
		]);
	});

	it('derives dark icons from absolute and relative data-base-href declarations', () => {
		const candidates = faviconCandidates(
			`
				<link rel="icon" href="https://cdn.example.com/favicon.svg"
					data-base-href="https://cdn.example.com/favicon">
				<link rel="icon" href="/assets/product.png" data-base-href="../brand/product">
			`,
			new URL('https://example.com/path/page')
		);

		expect(candidates.unqualified.map(String)).toEqual([
			'https://cdn.example.com/favicon.svg',
			'https://example.com/assets/product.png'
		]);
		expect(candidates.dark.map(String)).toEqual([
			'https://cdn.example.com/favicon-dark.svg',
			'https://example.com/brand/product-dark.png'
		]);
	});

	it('prioritizes explicit dark declarations over derived dark icons', () => {
		const candidates = faviconCandidates(
			`
				<link rel="icon" href="/favicon.svg" data-base-href="/favicon">
				<link rel="icon" href="/explicit-dark.svg" media="(prefers-color-scheme: dark)">
			`,
			new URL('https://example.com/')
		);

		expect(candidates.dark.map(String)).toEqual([
			'https://example.com/explicit-dark.svg',
			'https://example.com/favicon-dark.svg'
		]);
	});

	it('ignores malformed, unsupported, and extensionless data-base-href declarations', () => {
		const candidates = faviconCandidates(
			`
				<link rel="icon" href="/favicon.svg" data-base-href="http://[invalid">
				<link rel="icon" href="/favicon.png" data-base-href="file:///tmp/favicon">
				<link rel="icon" href="/favicon" data-base-href="/favicon">
				<link rel="icon" href="file:///tmp/favicon.svg" data-base-href="/invalid-href">
				<link rel="icon" href="/print.svg" data-base-href="/print" media="print">
			`,
			new URL('https://example.com/')
		);

		expect(candidates.dark).toEqual([]);
	});

	it('accepts URL-encoded and base64 inline SVG icons', () => {
		const urlEncoded =
			'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E';
		const base64 = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64')}`;

		const candidates = faviconCandidates(
			`<link rel="icon" href="${urlEncoded}"><link rel="icon" href="${base64}">`,
			new URL('https://example.com/page')
		);

		expect(candidates.unqualified.map(String)).toEqual([urlEncoded, base64]);
	});

	it('rejects malformed, non-SVG, and oversized inline icon data', () => {
		const oversized = `data:image/svg+xml,${encodeURIComponent(`<svg>${'a'.repeat(512_001)}</svg>`)}`;
		const candidates = faviconCandidates(
			`
				<link rel="icon" href="data:image/svg+xml,%ZZ">
				<link rel="icon" href="data:image/svg+xml;base64,not-valid!">
				<link rel="icon" href="data:image/svg+xml,plain-text">
				<link rel="icon" href="${oversized}">
			`,
			new URL('https://example.com/')
		);

		expect(candidates).toEqual({ light: [], dark: [], unqualified: [] });
	});

	it('stores decoded inline SVG bytes with the website page as the source', async () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>';
		const fetcher = vi.fn(
			async () =>
				new Response(
					`<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`,
					{
						headers: { 'content-type': 'text/html' }
					}
				)
		);

		const result = await discoverFavicon('https://example.com/page', fetcher, allowUrl);

		expect(result).toEqual({
			data: Buffer.from(svg),
			contentType: 'image/svg+xml',
			sourceUrl: 'https://example.com/page',
			darkData: null,
			darkContentType: null,
			darkSourceUrl: null
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('decodes URL-encoded inline SVG bytes', async () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
		const fetcher = vi.fn(
			async () =>
				new Response(`<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`, {
					headers: { 'content-type': 'text/html' }
				})
		);

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);

		expect(result.data).toEqual(Buffer.from(svg));
		expect(result.sourceUrl).toBe('https://example.com/');
	});

	it('downloads the first valid declared icon', async () => {
		const fetcher = vi.fn(async (input: URL | RequestInfo) => {
			const url = String(input);
			if (url === 'https://example.com/') {
				return new Response('<link rel="icon" href="/favicon.svg">', {
					headers: { 'content-type': 'text/html' }
				});
			}
			return new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
				headers: { 'content-type': 'image/svg+xml' }
			});
		});

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);

		expect(result.contentType).toBe('image/svg+xml');
		expect(result.sourceUrl).toBe('https://example.com/favicon.svg');
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('downloads a distinct dark icon derived from data-base-href', async () => {
		const light = Buffer.from('89504e470d0a1a0a', 'hex');
		const dark = Buffer.from('474946383961', 'hex');
		const fetcher = vi.fn(async (input: URL | RequestInfo) => {
			const url = String(input);
			if (url === 'https://example.com/') {
				return new Response('<link rel="icon" href="/favicon.svg" data-base-href="/favicon">', {
					headers: { 'content-type': 'text/html' }
				});
			}
			return new Response(url.endsWith('/favicon-dark.svg') ? dark : light);
		});

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);

		expect(result).toMatchObject({
			data: light,
			sourceUrl: 'https://example.com/favicon.svg',
			darkData: dark,
			darkSourceUrl: 'https://example.com/favicon-dark.svg'
		});
	});

	it('falls back to the default icon when a derived dark asset is missing', async () => {
		const light = Buffer.from('89504e470d0a1a0a', 'hex');
		const fetcher = vi.fn(async (input: URL | RequestInfo) => {
			const url = String(input);
			if (url === 'https://example.com/') {
				return new Response('<link rel="icon" href="/favicon.png" data-base-href="/favicon">', {
					headers: { 'content-type': 'text/html' }
				});
			}
			if (url.endsWith('/favicon-dark.png')) return new Response('missing', { status: 404 });
			return new Response(light);
		});

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);

		expect(result.sourceUrl).toBe('https://example.com/favicon.png');
		expect(result.darkData).toBeNull();
		expect(fetcher.mock.calls.map(([input]) => String(input))).toContain(
			'https://example.com/favicon-dark.png'
		);
	});

	it('prefers explicit light and dark declarations for their matching themes', async () => {
		const light = Buffer.from('89504e470d0a1a0a', 'hex');
		const dark = Buffer.from('474946383961', 'hex');
		const fetcher = vi.fn(async (input: URL | RequestInfo) => {
			const url = String(input);
			if (url === 'https://example.com/') {
				return new Response(
					`
					<link rel="icon" href="/default.ico">
					<link rel="icon" href="/light.png" media="(prefers-color-scheme: light)">
					<link rel="icon" href="/dark.gif" media="(prefers-color-scheme: dark)">
				`,
					{ headers: { 'content-type': 'text/html' } }
				);
			}
			if (url.endsWith('/light.png')) return new Response(light);
			if (url.endsWith('/dark.gif')) return new Response(dark);
			return new Response('missing', { status: 404 });
		});

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);

		expect(result).toMatchObject({
			data: light,
			sourceUrl: 'https://example.com/light.png',
			darkData: dark,
			darkSourceUrl: 'https://example.com/dark.gif'
		});
		expect(fetcher).toHaveBeenCalledTimes(3);
	});

	it('uses an unqualified icon when one explicit variant is missing', async () => {
		const shared = Buffer.from('89504e470d0a1a0a', 'hex');
		const dark = Buffer.from('474946383961', 'hex');
		const fetcher = vi.fn(async (input: URL | RequestInfo) => {
			const url = String(input);
			if (url === 'https://example.com/') {
				return new Response(
					`
					<link rel="icon" href="/shared.png">
					<link rel="icon" href="/dark.gif" media="(prefers-color-scheme: dark)">
				`,
					{ headers: { 'content-type': 'text/html' } }
				);
			}
			return new Response(url.endsWith('/dark.gif') ? dark : shared);
		});

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);

		expect(result.data).toEqual(shared);
		expect(result.darkData).toEqual(dark);
	});

	it('downloads duplicate theme candidates only once and deduplicates identical variants', async () => {
		const png = Buffer.from('89504e470d0a1a0a', 'hex');
		const fetcher = vi.fn(async (input: URL | RequestInfo) =>
			String(input) === 'https://example.com/'
				? new Response(
						`
						<link rel="icon" href="/same.png" media="(prefers-color-scheme: light)">
						<link rel="icon" href="/same.png" media="(prefers-color-scheme: dark)">
					`,
						{ headers: { 'content-type': 'text/html' } }
					)
				: new Response(png)
		);

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);

		expect(result.darkData).toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('falls back when a declared icon is unusable', async () => {
		const fetcher = vi.fn(async (input: URL | RequestInfo) => {
			const url = String(input);
			if (url === 'https://example.com/') {
				return new Response('<link rel="icon" href="/broken.png">', {
					headers: { 'content-type': 'text/html' }
				});
			}
			if (url.endsWith('/broken.png')) {
				return new Response('not an image', { headers: { 'content-type': 'text/plain' } });
			}
			return new Response(Buffer.from('000001000100', 'hex'), {
				headers: { 'content-type': 'image/x-icon' }
			});
		});

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);

		expect(result.sourceUrl).toBe('https://example.com/favicon.ico');
	});

	it('tries conventional origin paths when the homepage is blocked', async () => {
		const fetcher = vi.fn(async (input: URL | RequestInfo) => {
			const url = String(input);
			if (url === 'https://example.com/private/page')
				return new Response('blocked', { status: 403 });
			if (url === 'https://example.com/favicon.ico') {
				return new Response(Buffer.from('000001000100', 'hex'), {
					headers: { 'content-type': 'image/x-icon' }
				});
			}
			return new Response('missing', { status: 404 });
		});

		const result = await discoverFavicon('https://example.com/private/page', fetcher, allowUrl);

		expect(result.sourceUrl).toBe('https://example.com/favicon.ico');
		expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
			'https://example.com/private/page',
			'https://example.com/favicon.ico'
		]);
	});

	it('uses providers only after declared and direct candidates fail', async () => {
		const png = Buffer.from('89504e470d0a1a0a', 'hex');
		const fetcher = vi.fn(async (input: URL | RequestInfo) => {
			const url = String(input);
			if (url === 'https://example.com/') {
				return new Response('<link rel="icon" href="/declared.png">', {
					headers: { 'content-type': 'text/html' }
				});
			}
			if (url.startsWith('https://www.google.com/s2/favicons?')) {
				return new Response(png, { headers: { 'content-type': 'image/png' } });
			}
			return new Response('missing', { status: 404 });
		});

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);
		const calls = fetcher.mock.calls.map(([input]) => String(input));

		expect(calls.slice(0, 4)).toEqual([
			'https://example.com/',
			'https://example.com/declared.png',
			'https://example.com/favicon.ico',
			'https://example.com/favicon.svg'
		]);
		expect(calls[4]).toMatch(/^https:\/\/www\.google\.com\/s2\/favicons\?/);
		expect(calls).toHaveLength(5);
		expect(result.data).toEqual(png);
		expect(result.contentType).toBe('image/png');
		expect(result.sourceUrl).toBe(calls[4]);
	});

	it('uses DuckDuckGo after the Google provider fails', async () => {
		const png = Buffer.from('89504e470d0a1a0a', 'hex');
		const fetcher = vi.fn(async (input: URL | RequestInfo) => {
			const url = String(input);
			if (url === 'https://icons.duckduckgo.com/ip3/example.com.ico') {
				return new Response(png, { headers: { 'content-type': 'image/png' } });
			}
			return new Response('missing', { status: 404 });
		});

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);

		expect(result.data).toEqual(png);
		expect(result.sourceUrl).toBe('https://icons.duckduckgo.com/ip3/example.com.ico');
		expect(fetcher.mock.calls.map(([input]) => String(input)).at(-2)).toMatch(
			/^https:\/\/www\.google\.com\/s2\/favicons\?/
		);
	});

	it('rejects provider errors and non-image placeholders before trying the next provider', async () => {
		const fetcher = vi.fn(async (input: URL | RequestInfo) => {
			const url = String(input);
			if (url.startsWith('https://www.google.com/s2/favicons?')) {
				return new Response('missing', { status: 404 });
			}
			if (url.startsWith('https://icons.duckduckgo.com/')) {
				return new Response('placeholder', { headers: { 'content-type': 'image/png' } });
			}
			return new Response('missing', { status: 404 });
		});

		await expect(discoverFavicon('https://example.com/', fetcher, allowUrl)).rejects.toThrow(
			'No usable favicon found'
		);
		expect(fetcher.mock.calls.map(([input]) => String(input)).at(-1)).toBe(
			'https://icons.duckduckgo.com/ip3/example.com.ico'
		);
	});

	it('recognizes binary icons served with a generic content type', async () => {
		const fetcher = vi.fn(async (input: URL | RequestInfo) => {
			if (String(input) === 'https://example.com/') {
				return new Response('<link rel="icon" href="/favicon.png">', {
					headers: { 'content-type': 'text/html' }
				});
			}
			return new Response(Buffer.from('89504e470d0a1a0a', 'hex'), {
				headers: { 'content-type': 'application/octet-stream' }
			});
		});

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);

		expect(result.contentType).toBe('image/png');
	});

	it('continues discovery after an oversized homepage response', async () => {
		const fetcher = vi.fn(async (input: URL | RequestInfo) =>
			String(input) === 'https://example.com/'
				? new Response('<html></html>', {
						headers: { 'content-type': 'text/html', 'content-length': '1000001' }
					})
				: new Response(Buffer.from('000001000100', 'hex'), {
						headers: { 'content-type': 'image/x-icon' }
					})
		);

		const result = await discoverFavicon('https://example.com/', fetcher, allowUrl);

		expect(result.sourceUrl).toBe('https://example.com/favicon.ico');
	});
});

describe('favicon SSRF protection', () => {
	it.each(['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '::1', 'fd00::1'])(
		'recognizes private address %s',
		(address) => {
			expect(isPrivateIp(address)).toBe(true);
		}
	);

	it('blocks localhost URLs', async () => {
		await expect(assertPublicUrl(new URL('http://localhost/icon.png'))).rejects.toThrow('blocked');
	});
});
