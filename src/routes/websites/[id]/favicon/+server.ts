import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { websiteFavicon } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Favicon not found');
	const [favicon] = await db.select().from(websiteFavicon).where(eq(websiteFavicon.websiteId, id));
	const dark = url.searchParams.get('theme') === 'dark';
	const data = dark ? (favicon?.darkData ?? favicon?.data) : favicon?.data;
	const contentType = dark
		? (favicon?.darkContentType ?? favicon?.contentType)
		: favicon?.contentType;
	if (!data || !contentType) error(404, 'Favicon not found');

	return new Response(new Uint8Array(data), {
		headers: {
			'content-type': contentType,
			'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
			'x-content-type-options': 'nosniff'
		}
	});
};
