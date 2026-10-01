import type { RequestHandler } from '@sveltejs/kit';
import { GeocodingError, searchCities } from '#lib/server/geocoding.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.isAdmin) {
		return Response.json({ error: 'Forbidden' }, { status: 403 });
	}

	const query = url.searchParams.get('q')?.trim() ?? '';
	if (query.length < 2) {
		return Response.json({ suggestions: [] });
	}

	try {
		return Response.json({ suggestions: await searchCities(query) });
	} catch (error) {
		if (!(error instanceof GeocodingError)) {
			console.error('Unexpected city search failure', error);
		}

		return Response.json(
			{ suggestions: [], error: 'City search is temporarily unavailable' },
			{ status: 502 }
		);
	}
};
