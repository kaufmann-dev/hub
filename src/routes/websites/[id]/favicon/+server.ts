import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { websiteFavicon } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Favicon not found');
	const [favicon] = await db.select().from(websiteFavicon).where(eq(websiteFavicon.websiteId, id));
	if (!favicon?.data || !favicon.contentType) error(404, 'Favicon not found');

	return new Response(new Uint8Array(favicon.data), {
		headers: {
			'content-type': favicon.contentType,
			'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
			'x-content-type-options': 'nosniff'
		}
	});
};
