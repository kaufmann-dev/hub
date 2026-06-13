import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
	row: undefined as
		| undefined
		| {
				websiteId: number;
				data: Buffer | null;
				contentType: string | null;
				sourceUrl: string | null;
				darkData: Buffer | null;
				darkContentType: string | null;
				darkSourceUrl: string | null;
		  }
}));

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(async () => (mock.row ? [mock.row] : []))
			}))
		}))
	}
}));

const { GET } = await import('../../routes/websites/[id]/favicon/static/[theme]/+server');

function event(id: string, theme = 'light') {
	return {
		params: { id, theme },
		url: new URL(`https://example.com/websites/${id}/favicon/static/${theme}`)
	} as Parameters<typeof GET>[0];
}

describe('GET /websites/[id]/favicon/static/[theme]', () => {
	beforeEach(() => {
		mock.row = undefined;
	});

	it('serves cached bytes with image security headers', async () => {
		mock.row = {
			websiteId: 1,
			data: Buffer.from('89504e470d0a1a0a', 'hex'),
			contentType: 'image/png',
			sourceUrl: 'https://example.com/favicon.png',
			darkData: null,
			darkContentType: null,
			darkSourceUrl: null
		};

		const response = await GET(event('1'));

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
	});

	it('serves the dark variant when requested', async () => {
		const dark = Buffer.from('474946383961', 'hex');
		mock.row = {
			websiteId: 1,
			data: Buffer.from('89504e470d0a1a0a', 'hex'),
			contentType: 'image/png',
			sourceUrl: 'https://example.com/favicon.png',
			darkData: dark,
			darkContentType: 'image/gif',
			darkSourceUrl: 'https://example.com/favicon-dark.gif'
		};

		const response = await GET(event('1', 'dark'));

		expect(response.headers.get('content-type')).toBe('image/gif');
		expect(Buffer.from(await response.arrayBuffer())).toEqual(dark);
	});

	it('falls back to the default variant for dark requests', async () => {
		const light = Buffer.from('89504e470d0a1a0a', 'hex');
		mock.row = {
			websiteId: 1,
			data: light,
			contentType: 'image/png',
			sourceUrl: 'https://example.com/favicon.png',
			darkData: null,
			darkContentType: null,
			darkSourceUrl: null
		};

		const response = await GET(event('1', 'dark'));

		expect(response.headers.get('content-type')).toBe('image/png');
		expect(Buffer.from(await response.arrayBuffer())).toEqual(light);
	});

	it('serves SVGs with a static requested theme', async () => {
		const svg = Buffer.from(`
			<svg xmlns="http://www.w3.org/2000/svg">
				<style>
					path { fill: black }
					@media (prefers-color-scheme: dark) { path { fill: white } }
				</style>
				<path />
			</svg>
		`);
		mock.row = {
			websiteId: 1,
			data: svg,
			contentType: 'image/svg+xml',
			sourceUrl: 'https://example.com/favicon.svg',
			darkData: null,
			darkContentType: null,
			darkSourceUrl: null
		};

		const light = await GET(event('1', 'light'));
		const dark = await GET(event('1', 'dark'));
		const lightSvg = await light.text();
		const darkSvg = await dark.text();

		expect(lightSvg).toContain('path { fill: black }');
		expect(lightSvg).not.toContain('path { fill: white }');
		expect(darkSvg).toContain('path { fill: black }');
		expect(darkSvg).toContain('path { fill: white }');
		expect(lightSvg).not.toContain('prefers-color-scheme');
		expect(darkSvg).not.toContain('prefers-color-scheme');
	});

	it('returns 404 when no cached image exists', async () => {
		await expect(GET(event('1'))).rejects.toMatchObject({ status: 404 });
	});

	it('returns 404 for an invalid theme', async () => {
		await expect(GET(event('1', 'sepia'))).rejects.toMatchObject({ status: 404 });
	});
});
