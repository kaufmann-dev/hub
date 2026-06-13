/** Resolve cache-versioned hub-owned favicon endpoints for both themes. */
export function faviconUrls(
	websiteId: number,
	checkedAt?: Date | string | null
): { light: string; dark: string } {
	const version = checkedAt ? `?v=${encodeURIComponent(new Date(checkedAt).toISOString())}` : '';
	return {
		light: `/websites/${websiteId}/favicon/light${version}`,
		dark: `/websites/${websiteId}/favicon/dark${version}`
	};
}
