import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
	const writes: Array<{ values: Record<string, unknown>; set: Record<string, unknown> }> = [];
	const db = {
		insert: vi.fn(() => ({
			values: vi.fn((values: Record<string, unknown>) => ({
				onConflictDoUpdate: vi.fn(async ({ set }: { set: Record<string, unknown> }) => {
					writes.push({ values, set });
				})
			}))
		}))
	};
	return { db, writes };
});

vi.mock('./db', () => ({ db: mock.db }));

const { refreshWebsiteFavicon } = await import('./favicon');

describe('favicon cache refresh', () => {
	beforeEach(() => {
		mock.writes.length = 0;
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	it('stores successfully discovered favicon bytes', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: URL | RequestInfo) => {
				if (String(input) === 'https://example.com/') {
					return new Response('<link rel="icon" href="/favicon.svg">', {
						headers: { 'content-type': 'text/html' }
					});
				}
				return new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
					headers: { 'content-type': 'image/svg+xml' }
				});
			})
		);

		await expect(refreshWebsiteFavicon(101, 'https://example.com/')).resolves.toBe(true);

		expect(mock.writes).toHaveLength(1);
		expect(mock.writes[0]?.values).toMatchObject({
			websiteId: 101,
			contentType: 'image/svg+xml',
			sourceUrl: 'https://example.com/favicon.svg'
		});
		expect(mock.writes[0]?.set).toHaveProperty('data');
	});

	it('stores downloaded provider favicon bytes after local discovery fails', async () => {
		const png = Buffer.from('89504e470d0a1a0a', 'hex');
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: URL | RequestInfo) =>
				String(input).startsWith('https://www.google.com/s2/favicons?')
					? new Response(png, { headers: { 'content-type': 'image/png' } })
					: new Response('missing', { status: 404 })
			)
		);

		await expect(refreshWebsiteFavicon(103, 'https://example.com/')).resolves.toBe(true);

		expect(mock.writes).toHaveLength(1);
		expect(mock.writes[0]?.values).toMatchObject({
			websiteId: 103,
			data: png,
			contentType: 'image/png',
			sourceUrl: expect.stringMatching(/^https:\/\/www\.google\.com\/s2\/favicons\?/)
		});
	});

	it('records only the check time when refresh fails, preserving any existing bytes', async () => {
		await expect(refreshWebsiteFavicon(102, 'http://localhost/')).resolves.toBe(false);

		expect(mock.writes).toHaveLength(1);
		expect(mock.writes[0]?.values).toMatchObject({ websiteId: 102 });
		expect(mock.writes[0]?.values).not.toHaveProperty('data');
		expect(mock.writes[0]?.set).toEqual({ checkedAt: expect.any(Date) });
	});
});
