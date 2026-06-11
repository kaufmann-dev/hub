import {
	pgTable,
	serial,
	integer,
	text,
	boolean,
	timestamp,
	doublePrecision,
	customType
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType: () => 'bytea'
});

/** Personal and third-party websites shown on the hub. */
export const website = pgTable('website', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	url: text('url').notNull(),
	description: text('description'),
	/** 'personal' | 'third_party' */
	kind: text('kind').notNull().default('personal'),

	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Locally cached discovered favicon for a website. */
export const websiteFavicon = pgTable('website_favicon', {
	websiteId: integer('website_id')
		.primaryKey()
		.references(() => website.id, { onDelete: 'cascade' }),
	data: bytea('data'),
	contentType: text('content_type'),
	sourceUrl: text('source_url'),
	darkData: bytea('dark_data'),
	darkContentType: text('dark_content_type'),
	darkSourceUrl: text('dark_source_url'),
	checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow()
});

/** GitHub repositories synced from the configured account, with editable overrides. */
export const githubProject = pgTable('github_project', {
	id: serial('id').primaryKey(),
	/** GitHub numeric repo id — upsert key for syncing. */
	repoId: integer('repo_id').notNull().unique(),
	// --- synced fields (overwritten on each sync) ---
	name: text('name').notNull(),
	fullName: text('full_name').notNull(),
	url: text('url').notNull(),
	description: text('description'),
	homepage: text('homepage'),
	language: text('language'),
	stars: integer('stars').notNull().default(0),
	topics: text('topics').array(),
	pushedAt: timestamp('pushed_at', { withTimezone: true }),
	syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
	// --- user overrides (preserved across syncs) ---
	descriptionOverride: text('description_override'),
	hidden: boolean('hidden').notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0)
});

/** Cities for which the hub shows a live clock and current weather. */
export const city = pgTable('city', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	/** IANA timezone, e.g. "Europe/Vienna". */
	timezone: text('timezone').notNull(),
	latitude: doublePrecision('latitude').notNull(),
	longitude: doublePrecision('longitude').notNull(),
	sortOrder: integer('sort_order').notNull().default(0)
});

export type Website = typeof website.$inferSelect;
export type WebsiteFavicon = typeof websiteFavicon.$inferSelect;
export type GithubProject = typeof githubProject.$inferSelect;
export type City = typeof city.$inferSelect;
