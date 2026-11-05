import { asc, sql } from 'drizzle-orm';
import { githubProject } from './db/schema';

/**
 * Project display order: manual admin order first; projects with equal sort
 * order (all of them after a reset) fall back to Dependabot alerts enabled,
 * disabled, unknown, then archived, each group alphabetical.
 */
export const projectOrderBy = [
	asc(githubProject.sortOrder),
	asc(sql`case
		when ${githubProject.archived} then 3
		when ${githubProject.dependabotAlerts} then 0
		when not ${githubProject.dependabotAlerts} then 1
		else 2
	end`),
	asc(sql`lower(${githubProject.name})`),
	asc(githubProject.id)
];
