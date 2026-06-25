/**
 * Idempotent seed: inserts the personal websites, city clocks, and market watchlist.
 * GitHub projects are NOT seeded — they are populated by syncGithubProjects().
 *
 * Run with:  pnpm db:seed
 * Uses process.env.DATABASE_URL directly (no SvelteKit $env), so it can run via tsx.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { website, city, marketWatchlist } from './schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema: { website, city, marketWatchlist } });

const websites = [
	'kaufmann.dev',
	'coolify.kaufmann.dev',
	'wrangler.kaufmann.dev',
	'puruscss.kaufmann.dev',
	'marketdeck.kaufmann.dev',
	'ensemblr.kaufmann.dev',
	'vault.kaufmann.dev',
	'resume.kaufmann.dev',
	'legal.kaufmann.dev',
	'chat.kaufmann.dev'
].map((domain, i) => ({
	title: domain,
	url: `https://${domain}`,
	kind: 'personal' as const,
	sortOrder: i
}));

const cities = [
	{
		name: 'Vienna',
		timezone: 'Europe/Vienna',
		latitude: 48.2082,
		longitude: 16.3738,
		sortOrder: 0
	},
	{
		name: 'New York',
		timezone: 'America/New_York',
		latitude: 40.7128,
		longitude: -74.006,
		sortOrder: 1
	}
];

const markets = [
	{
		marketType: 'Equity',
		region: 'United States',
		displayName: 'US Markets',
		sortOrder: 0
	},
	{
		marketType: 'Equity',
		region: 'United Kingdom',
		displayName: 'London',
		sortOrder: 1
	},
	{
		marketType: 'Equity',
		region: 'Germany',
		displayName: 'Germany',
		sortOrder: 2
	},
	{
		marketType: 'Equity',
		region: 'Japan',
		displayName: 'Tokyo',
		sortOrder: 3
	},
	{
		marketType: 'Equity',
		region: 'India',
		displayName: 'India',
		sortOrder: 4
	},
	{
		marketType: 'Equity',
		region: 'Mainland China',
		displayName: 'Mainland China',
		sortOrder: 5
	},
	{
		marketType: 'Equity',
		region: 'Hong Kong',
		displayName: 'Hong Kong',
		sortOrder: 6
	}
];

async function main() {
	for (const w of websites) {
		const existing = await db
			.select({ id: website.id })
			.from(website)
			.where(eq(website.url, w.url));
		if (existing.length === 0) {
			await db.insert(website).values(w);
			console.log(`+ website ${w.title}`);
		}
	}

	for (const c of cities) {
		const existing = await db.select({ id: city.id }).from(city).where(eq(city.name, c.name));
		if (existing.length === 0) {
			await db.insert(city).values(c);
			console.log(`+ city ${c.name}`);
		}
	}

	for (const m of markets) {
		const existing = await db
			.select({ id: marketWatchlist.id })
			.from(marketWatchlist)
			.where(eq(marketWatchlist.region, m.region));
		if (existing.length === 0) {
			await db.insert(marketWatchlist).values(m);
			console.log(`+ market ${m.displayName}`);
		}
	}

	console.log('Seed complete.');
}

main()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(() => client.end());
