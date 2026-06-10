import { z } from 'zod';

export const loginSchema = z.object({
	password: z.string().min(1, 'Password is required')
});
export type LoginSchema = typeof loginSchema;

const optionalText = z
	.string()
	.trim()
	.optional()
	.transform((v) => (v ? v : undefined));

export const websiteSchema = z.object({
	title: z.string().trim().min(1, 'Title is required'),
	url: z.url('Must be a valid URL'),
	description: optionalText,
	iconUrl: optionalText,
	kind: z.enum(['personal', 'third_party']).default('personal'),
	imprintSite: optionalText,
	sortOrder: z.coerce.number().int().default(0)
});
export type WebsiteSchema = typeof websiteSchema;

export const citySchema = z.object({
	name: z.string().trim().min(1, 'Name is required'),
	timezone: z
		.string()
		.trim()
		.min(1, 'Timezone is required')
		.refine((tz) => {
			try {
				new Intl.DateTimeFormat(undefined, { timeZone: tz });
				return true;
			} catch {
				return false;
			}
		}, 'Invalid IANA timezone (e.g. Europe/Vienna)'),
	latitude: z.coerce.number().min(-90).max(90),
	longitude: z.coerce.number().min(-180).max(180),
	sortOrder: z.coerce.number().int().default(0)
});
export type CitySchema = typeof citySchema;

export const projectSchema = z.object({
	descriptionOverride: optionalText,
	hidden: z.boolean().default(false),
	sortOrder: z.coerce.number().int().default(0)
});
export type ProjectSchema = typeof projectSchema;
