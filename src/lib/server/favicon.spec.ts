import { describe, expect, it, vi } from 'vitest';
import { assertPublicUrl, discoverFavicon, faviconCandidates, isPrivateIp } from './favicon';

const allowUrl = async () => undefined;

describe('favicon discovery', () => {
	it('extracts declared icons, resolves relative URLs, and appends the conventional fallback', () => {
		const candidates = faviconCandidates(
			`
				<link rel="stylesheet" href="/styles.css">
				<link rel="icon" href="static/favicon.svg">
				<link rel="apple-touch-icon" href="/touch.png">
			`,
			new URL('https://example.com/path/')
		);

		expect(candidates.map(String)).toEqual([
			'https://example.com/path/static/favicon.svg',
			'https://example.com/touch.png',
			'https://example.com/favicon.ico'
		]);
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

	it('rejects oversized responses before reading their body', async () => {
		const fetcher = vi.fn(
			async () =>
				new Response('<html></html>', {
					headers: { 'content-type': 'text/html', 'content-length': '1000001' }
				})
		);

		await expect(discoverFavicon('https://example.com/', fetcher, allowUrl)).rejects.toThrow(
			'too large'
		);
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
