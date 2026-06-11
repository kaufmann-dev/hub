/** Resolve an explicit override or the hub-owned cached favicon endpoint. */
export function faviconFor(websiteId: number, iconUrl?: string | null): string {
	return iconUrl || `/websites/${websiteId}/favicon`;
}
