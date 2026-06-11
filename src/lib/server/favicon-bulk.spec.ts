import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
	const rows = Array.from({ length: 9 }, (_, index) => ({
		id: index + 1,
		url: `https://example.com/${index + 1}`
	}));
	const db = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				orderBy: vi.fn(async () => rows)
			}))
		})),
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				onConflictDoUpdate: vi.fn(async () => undefined)
			}))
		}))
	};
	return { db };
});

vi.mock('./db', () => ({ db: mock.db }));

const { refreshAllWebsiteFavicons } = await import('./favicon');

describe('bulk favicon refresh', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	it('refreshes at most four websites concurrently and returns counts', async () => {
		let active = 0;
		let maxActive = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				active += 1;
				maxActive = Math.max(maxActive, active);
				await new Promise((resolve) => setTimeout(resolve, 5));
				active -= 1;
				return new Response(Buffer.from('89504e470d0a1a0a', 'hex'));
			})
		);

		await expect(refreshAllWebsiteFavicons()).resolves.toEqual({ refreshed: 9, failed: 0 });
		expect(maxActive).toBeLessThanOrEqual(4);
	});
});
