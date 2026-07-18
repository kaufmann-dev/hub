import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
	refreshStaleWebsiteHealth: vi.fn(),
	getVisibleWebsiteHealth: vi.fn()
}));

vi.mock('$lib/server/website-health', () => mock);

const { POST } = await import('../../routes/api/website-health/refresh/+server');

describe('POST /api/website-health/refresh', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mock.refreshStaleWebsiteHealth.mockResolvedValue(undefined);
		mock.getVisibleWebsiteHealth.mockResolvedValue({
			healthByWebsiteId: {
				'1': {
					state: 'healthy',
					statusCode: 200,
					failureKind: null,
					checkedAt: '2026-07-18T12:00:00.000Z'
				},
				'2': null
			}
		});
	});

	it('waits for stale checks and returns public personal-site snapshots', async () => {
		const response = await POST({} as Parameters<typeof POST>[0]);

		expect(mock.refreshStaleWebsiteHealth).toHaveBeenCalledOnce();
		expect(mock.getVisibleWebsiteHealth).toHaveBeenCalledOnce();
		await expect(response.json()).resolves.toEqual({
			healthByWebsiteId: {
				'1': {
					state: 'healthy',
					statusCode: 200,
					failureKind: null,
					checkedAt: '2026-07-18T12:00:00.000Z'
				},
				'2': null
			}
		});
	});
});
