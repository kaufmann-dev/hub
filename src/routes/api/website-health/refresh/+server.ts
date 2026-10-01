import type { RequestHandler } from '@sveltejs/kit';
import { getVisibleWebsiteHealth, refreshStaleWebsiteHealth } from '#lib/server/website-health.js';

export const POST: RequestHandler = async () => {
	await refreshStaleWebsiteHealth();
	return Response.json(await getVisibleWebsiteHealth());
};
