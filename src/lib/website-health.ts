export type WebsiteHealthFailureKind = 'http' | 'timeout' | 'network' | 'blocked' | 'redirect';

export interface WebsiteHealthSnapshot {
	state: 'healthy' | 'unhealthy';
	statusCode: number | null;
	failureKind: WebsiteHealthFailureKind | null;
	checkedAt: string;
}

export interface WebsiteHealthRefreshResponse {
	healthByWebsiteId: Record<string, WebsiteHealthSnapshot | null>;
}
