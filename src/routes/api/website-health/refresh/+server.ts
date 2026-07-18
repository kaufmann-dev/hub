import { json, type RequestHandler } from '@sveltejs/kit';
import { getVisibleWebsiteHealth, refreshStaleWebsiteHealth } from '$lib/server/website-health';

export const POST: RequestHandler = async () => {
	await refreshStaleWebsiteHealth();
	return json(await getVisibleWebsiteHealth());
};
