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
	kind: z.enum(['personal', 'third_party']).default('personal'),
	sortOrder: z.coerce.number().int().default(0)
});
export type WebsiteSchema = typeof websiteSchema;

const requiredCoordinate = (min: number, max: number) =>
	z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().min(min).max(max));

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
	latitude: requiredCoordinate(-90, 90),
	longitude: requiredCoordinate(-180, 180),
	sortOrder: z.coerce.number().int().default(0)
});
export type CitySchema = typeof citySchema;

export const projectSchema = z.object({
	descriptionOverride: optionalText,
	hidden: z.boolean().default(false),
	sortOrder: z.coerce.number().int().default(0)
});
export type ProjectSchema = typeof projectSchema;
