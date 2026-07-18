import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
	const rows = Array.from({ length: 8 }, (_, index) => ({
		id: index + 1,
		url: `https://example.com/${index + 1}`,
		checkedAt: null as Date | null
	}));
	const writes: Array<Record<string, unknown>> = [];
	const db = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				leftJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(async () => rows)
					}))
				}))
			}))
		})),
		insert: vi.fn(() => ({
			values: vi.fn((values: Record<string, unknown>) => ({
				onConflictDoUpdate: vi.fn(async () => {
					writes.push(values);
				})
			}))
		}))
	};
	return { db, rows, writes };
});

vi.mock('./db', () => ({ db: mock.db }));
vi.mock('./public-url', () => ({ assertPublicUrl: vi.fn(async () => undefined) }));

const { refreshStaleWebsiteHealth } = await import('./website-health');

describe('website health cache refresh', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
		mock.writes.length = 0;
		for (const row of mock.rows) row.checkedAt = null;
	});

	it('shares one batch and checks at most six stale websites concurrently', async () => {
		let active = 0;
		let maxActive = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				active += 1;
				maxActive = Math.max(maxActive, active);
				await new Promise((resolve) => setTimeout(resolve, 5));
				active -= 1;
				return new Response(null, { status: 200 });
			})
		);

		const first = refreshStaleWebsiteHealth();
		const second = refreshStaleWebsiteHealth();
		expect(first).toBe(second);
		await Promise.all([first, second]);

		expect(maxActive).toBeLessThanOrEqual(6);
		expect(mock.writes).toHaveLength(8);
	});

	it('skips fresh cached results', async () => {
		for (const row of mock.rows) row.checkedAt = new Date();
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);

		await refreshStaleWebsiteHealth();

		expect(fetcher).not.toHaveBeenCalled();
		expect(mock.writes).toHaveLength(0);
	});
});
