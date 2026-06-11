import { sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { githubProject } from './db/schema';

interface GithubRepo {
	id: number;
	name: string;
	full_name: string;
	html_url: string;
	description: string | null;
	homepage: string | null;
	language: string | null;
	stargazers_count: number;
	topics?: string[];
	pushed_at: string | null;
	fork: boolean;
	archived: boolean;
}

let lastSync = 0;
let inFlight: Promise<number> | null = null;

/** Whether the stored projects are older than `maxAgeMs` and should be re-synced. */
export async function projectsAreStale(maxAgeMs: number): Promise<boolean> {
	const [row] = await db
		.select({ syncedAt: githubProject.syncedAt })
		.from(githubProject)
		.orderBy(sql`${githubProject.syncedAt} desc`)
		.limit(1);
	if (!row?.syncedAt) return true;
	return Date.now() - row.syncedAt.getTime() > maxAgeMs;
}

/**
 * Fetch the configured account's public repos and upsert them by GitHub repo id.
 * Synced fields are overwritten; user override fields are preserved.
 * Returns the number of repos processed. Throws on any failure so callers can
 * report it; concurrent calls share a single in-flight request.
 */
export async function syncGithubProjects(): Promise<number> {
	if (inFlight) return inFlight;
	inFlight = (async () => {
		try {
			const username = env.GITHUB_USERNAME || 'kaufmann-dev';
			const headers: Record<string, string> = {
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				'User-Agent': 'hub.kaufmann.dev'
			};
			if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

			const res = await fetch(
				`https://api.github.com/users/${username}/repos?per_page=100&sort=updated&type=owner`,
				{ headers, signal: AbortSignal.timeout(10_000) }
			);
			if (!res.ok) {
				throw new Error(`GitHub API responded ${res.status} ${res.statusText}`);
			}

			const repos = (await res.json()) as GithubRepo[];
			const usable = repos.filter((r) => !r.fork && !r.archived);

			const now = new Date();
			for (const r of usable) {
				await db
					.insert(githubProject)
					.values({
						repoId: r.id,
						name: r.name,
						fullName: r.full_name,
						url: r.html_url,
						description: r.description,
						homepage: r.homepage || null,
						language: r.language,
						stars: r.stargazers_count,
						topics: r.topics ?? [],
						pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
						syncedAt: now
					})
					.onConflictDoUpdate({
						target: githubProject.repoId,
						set: {
							name: r.name,
							fullName: r.full_name,
							url: r.html_url,
							description: r.description,
							homepage: r.homepage || null,
							language: r.language,
							stars: r.stargazers_count,
							topics: r.topics ?? [],
							pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
							syncedAt: now
						}
					});
			}

			lastSync = Date.now();
			return usable.length;
		} finally {
			inFlight = null;
		}
	})();
	return inFlight;
}

/** Trigger a sync in the background if projects are stale, without blocking the caller. */
export async function syncIfStale(maxAgeMs: number): Promise<void> {
	// Cheap in-process throttle to avoid hammering the DB check on every request.
	if (Date.now() - lastSync < Math.min(maxAgeMs, 60_000)) return;
	if (await projectsAreStale(maxAgeMs)) {
		// Background best-effort: swallow and log failures so they don't become
		// unhandled rejections. The explicit admin sync reports errors instead.
		void syncGithubProjects().catch((err) => console.error('GitHub sync error:', err));
	}
}
