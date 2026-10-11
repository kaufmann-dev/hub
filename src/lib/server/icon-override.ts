import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { websiteFavicon, websiteIconOverride } from './db/schema';
import { sniffImageType } from './favicon';
import { MAX_ICON_UPLOAD_BYTES } from '#lib/schemas.js';

type UploadedIcon = { data: Buffer; contentType: string };

/**
 * Cache-busting version for a website's served icon; select it with both icon tables left-joined.
 * Changes whenever the discovered favicon is checked or the override is saved or removed.
 */
export const iconVersion =
	sql<Date | null>`greatest(${websiteFavicon.checkedAt}, ${websiteIconOverride.updatedAt})`.mapWith(
		websiteFavicon.checkedAt
	);

/** Read an uploaded file and return its bytes with the sniffed type, or null if unsupported. */
export async function readIconUpload(file: File): Promise<UploadedIcon | null> {
	if (file.size === 0 || file.size > MAX_ICON_UPLOAD_BYTES) return null;
	const data = Buffer.from(await file.arrayBuffer());
	const declaredSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
	const contentType = sniffImageType(data, declaredSvg);
	return contentType ? { data, contentType } : null;
}

/** Replace a website's icon override; without a dark icon the light one serves both themes. */
export async function saveIconOverride(
	websiteId: number,
	icon: UploadedIcon,
	darkIcon: UploadedIcon | null
): Promise<void> {
	const values = {
		data: icon.data,
		contentType: icon.contentType,
		darkData: darkIcon?.data ?? null,
		darkContentType: darkIcon?.contentType ?? null,
		updatedAt: new Date()
	};
	await db
		.insert(websiteIconOverride)
		.values({ websiteId, ...values })
		.onConflictDoUpdate({ target: websiteIconOverride.websiteId, set: values });
}

export async function removeIconOverride(websiteId: number): Promise<void> {
	await db.delete(websiteIconOverride).where(eq(websiteIconOverride.websiteId, websiteId));
}
