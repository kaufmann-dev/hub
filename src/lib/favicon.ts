/** Resolve cache-versioned hub-owned favicon endpoints for both themes. */
export function faviconUrls(
	websiteId: number,
	version?: Date | string | null
): { light: string; dark: string } {
	const query = version ? `?v=${encodeURIComponent(new Date(version).toISOString())}` : '';
	return {
		light: `/websites/${websiteId}/favicon/static/light${query}`,
		dark: `/websites/${websiteId}/favicon/static/dark${query}`
	};
}
