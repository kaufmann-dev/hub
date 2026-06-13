import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { websiteFavicon } from '$lib/server/db/schema';
import { staticizeSvgTheme } from '$lib/server/favicon-svg';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Favicon not found');
	if (params.theme !== 'light' && params.theme !== 'dark') error(404, 'Favicon not found');
	const [favicon] = await db.select().from(websiteFavicon).where(eq(websiteFavicon.websiteId, id));
	const dark = params.theme === 'dark';
	const data = dark ? (favicon?.darkData ?? favicon?.data) : favicon?.data;
	const contentType = dark
		? (favicon?.darkContentType ?? favicon?.contentType)
		: favicon?.contentType;
	if (!data || !contentType) error(404, 'Favicon not found');
	const responseData =
		contentType === 'image/svg+xml' ? staticizeSvgTheme(data, params.theme) : data;

	return new Response(new Uint8Array(responseData), {
		headers: {
			'content-type': contentType,
			'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
			'x-content-type-options': 'nosniff'
		}
	});
};
