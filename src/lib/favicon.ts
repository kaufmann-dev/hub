/** Extract the hostname from a URL, tolerating values without a protocol. */
export function hostFromUrl(url: string): string | null {
	try {
		return new URL(url).hostname;
	} catch {
		try {
			return new URL(`https://${url}`).hostname;
		} catch {
			return null;
		}
	}
}

/**
 * Resolve the icon to show for a website: an explicit override if present,
 * otherwise a favicon derived from the domain via DuckDuckGo's icon service.
 */
export function faviconFor(url: string, iconUrl?: string | null): string | null {
	if (iconUrl) return iconUrl;
	const host = hostFromUrl(url);
	return host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : null;
}
