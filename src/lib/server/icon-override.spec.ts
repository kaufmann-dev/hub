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

const { readIconUpload, saveIconOverride } = await import('./icon-override');
const { MAX_ICON_UPLOAD_BYTES } = await import('#lib/schemas.js');

const png = Buffer.from('89504e470d0a1a0a0000', 'hex');

describe('icon override uploads', () => {
	beforeEach(() => {
		mock.writes.length = 0;
		vi.clearAllMocks();
	});

	it('sniffs the image type instead of trusting the declared type', async () => {
		const upload = await readIconUpload(new File([png], 'icon.gif', { type: 'image/gif' }));

		expect(upload?.contentType).toBe('image/png');
		expect(upload?.data).toEqual(png);
	});

	it('accepts SVG markup', async () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
		const upload = await readIconUpload(new File([svg], 'icon.svg', { type: 'image/svg+xml' }));

		expect(upload?.contentType).toBe('image/svg+xml');
	});

	it('rejects empty, oversized, and non-image files', async () => {
		const oversized = new Uint8Array(MAX_ICON_UPLOAD_BYTES + 1);
		oversized.set(png);

		await expect(readIconUpload(new File([], 'empty.png'))).resolves.toBeNull();
		await expect(readIconUpload(new File([oversized], 'big.png'))).resolves.toBeNull();
		await expect(
			readIconUpload(new File(['hello'], 'text.svg', { type: 'image/svg+xml' }))
		).resolves.toBeNull();
		await expect(readIconUpload(new File(['hello'], 'text.png'))).resolves.toBeNull();
	});

	it('clears a previous dark icon when saving only a light icon', async () => {
		await saveIconOverride(7, { data: png, contentType: 'image/png' }, null);

		expect(mock.writes[0]?.values).toMatchObject({ websiteId: 7, contentType: 'image/png' });
		expect(mock.writes[0]?.set).toMatchObject({ darkData: null, darkContentType: null });
	});
});
