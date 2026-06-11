import { z } from 'zod';

const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const geocodingResponseSchema = z
	.object({
		results: z.array(z.unknown()).optional()
	})
	.passthrough();

const geocodingResultSchema = z
	.object({
		id: z.number().int(),
		name: z.string().trim().min(1),
		country: z.string().trim().min(1),
		admin1: z.string().trim().min(1).optional(),
		timezone: z.string().trim().min(1),
		latitude: z.number().finite().min(-90).max(90),
		longitude: z.number().finite().min(-180).max(180)
	})
	.passthrough();

export type CitySuggestion = {
	id: number;
	name: string;
	country: string;
	admin1?: string;
	timezone: string;
	latitude: number;
	longitude: number;
	label: string;
};

export class GeocodingError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'GeocodingError';
	}
}

function buildLabel(suggestion: Omit<CitySuggestion, 'label'>): string {
	return [suggestion.name, suggestion.admin1, suggestion.country]
		.filter((part, index, parts) => part && parts.indexOf(part) === index)
		.join(', ');
}

export async function searchCities(
	query: string,
	fetchImpl: typeof fetch = fetch
): Promise<CitySuggestion[]> {
	const name = query.trim();
	if (name.length < 2) return [];

	const url = new URL(OPEN_METEO_GEOCODING_URL);
	url.searchParams.set('name', name);
	url.searchParams.set('count', '8');
	url.searchParams.set('language', 'en');
	url.searchParams.set('format', 'json');

	let response: Response;
	try {
		response = await fetchImpl(url);
	} catch (cause) {
		throw new GeocodingError('Failed to reach geocoding provider', { cause });
	}

	if (!response.ok) {
		throw new GeocodingError(`Geocoding provider returned HTTP ${response.status}`);
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch (cause) {
		throw new GeocodingError('Geocoding provider returned invalid JSON', { cause });
	}

	const parsedResponse = geocodingResponseSchema.safeParse(payload);
	if (!parsedResponse.success) {
		throw new GeocodingError('Geocoding provider returned an invalid response shape');
	}

	return (parsedResponse.data.results ?? []).flatMap((result): CitySuggestion[] => {
		const parsedResult = geocodingResultSchema.safeParse(result);
		if (!parsedResult.success) return [];

		const { id, name, country, admin1, timezone, latitude, longitude } = parsedResult.data;
		const suggestion = { id, name, country, admin1, timezone, latitude, longitude };
		return [{ ...suggestion, label: buildLabel(suggestion) }];
	});
}
