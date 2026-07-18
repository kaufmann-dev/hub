import { describe, expect, it, vi } from 'vitest';
import { checkWebsiteHealth, healthSnapshot } from './website-health';

const allowUrl = async () => undefined;

describe('website health checks', () => {
	it('marks successful responses as healthy without downloading their body', async () => {
		const cancel = vi.fn(async () => undefined);
		const fetcher = vi.fn(
			async () => new Response(new ReadableStream({ cancel }), { status: 200 })
		);

		await expect(checkWebsiteHealth('https://example.com', fetcher, allowUrl)).resolves.toEqual({
			healthy: true,
			statusCode: 200,
			failureKind: null
		});
		expect(cancel).toHaveBeenCalledOnce();
	});

	it('follows and validates redirects before using the final response', async () => {
		const validateUrl = vi.fn(async () => undefined);
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(null, { status: 302, headers: { location: '/signed-in' } })
			)
			.mockResolvedValueOnce(new Response(null, { status: 200 }));

		await expect(checkWebsiteHealth('https://example.com', fetcher, validateUrl)).resolves.toEqual({
			healthy: true,
			statusCode: 200,
			failureKind: null
		});
		expect(validateUrl).toHaveBeenNthCalledWith(1, new URL('https://example.com/'));
		expect(validateUrl).toHaveBeenNthCalledWith(2, new URL('https://example.com/signed-in'));
	});

	it.each([404, 503])('marks HTTP %s as unavailable', async (statusCode) => {
		const fetcher = vi.fn(async () => new Response(null, { status: statusCode }));

		await expect(checkWebsiteHealth('https://example.com', fetcher, allowUrl)).resolves.toEqual({
			healthy: false,
			statusCode,
			failureKind: 'http'
		});
	});

	it('marks an overall timeout as unavailable', async () => {
		const fetcher = vi.fn(
			async (_input: URL | RequestInfo, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
						once: true
					});
				})
		);

		await expect(checkWebsiteHealth('https://example.com', fetcher, allowUrl, 5)).resolves.toEqual({
			healthy: false,
			statusCode: null,
			failureKind: 'timeout'
		});
	});

	it('blocks a redirect to a private destination', async () => {
		const fetcher = vi.fn(
			async () =>
				new Response(null, { status: 302, headers: { location: 'http://localhost/admin' } })
		);
		const validateUrl = vi.fn(async (url: URL) => {
			if (url.hostname === 'localhost') throw new Error('Local URL blocked');
		});

		await expect(checkWebsiteHealth('https://example.com', fetcher, validateUrl)).resolves.toEqual({
			healthy: false,
			statusCode: null,
			failureKind: 'blocked'
		});
	});

	it('normalizes persisted rows into public snapshots', () => {
		expect(healthSnapshot(true, 200, null, new Date('2026-07-18T12:00:00Z'))).toEqual({
			state: 'healthy',
			statusCode: 200,
			failureKind: null,
			checkedAt: '2026-07-18T12:00:00.000Z'
		});
		expect(healthSnapshot(null, null, null, null)).toBeNull();
	});
});
