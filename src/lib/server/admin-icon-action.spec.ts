import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
	saveIconOverride: vi.fn(),
	removeIconOverride: vi.fn()
}));

vi.mock('#lib/server/db/index.js', () => ({ db: {} }));
vi.mock('#lib/server/favicon.js', () => ({ refreshWebsiteFavicon: vi.fn() }));
vi.mock('#lib/server/icon-override.js', () => ({
	iconVersion: {},
	readIconUpload: vi.fn(),
	saveIconOverride: mock.saveIconOverride,
	removeIconOverride: mock.removeIconOverride
}));

const { actions } = await import('../../routes/admin/websites/[[id]]/+page.server');

describe('admin website icon actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 403 for non-admin uploads and removals', async () => {
		const event = { params: { id: '1' }, locals: { isAdmin: false } } as never;

		await expect(actions.icon(event)).resolves.toMatchObject({ status: 403 });
		await expect(actions.removeIcon(event)).resolves.toMatchObject({ status: 403 });
		expect(mock.saveIconOverride).not.toHaveBeenCalled();
		expect(mock.removeIconOverride).not.toHaveBeenCalled();
	});

	it('removes the override for admins', async () => {
		await actions.removeIcon({ params: { id: '1' }, locals: { isAdmin: true } } as never);

		expect(mock.removeIconOverride).toHaveBeenCalledWith(1);
	});
});
