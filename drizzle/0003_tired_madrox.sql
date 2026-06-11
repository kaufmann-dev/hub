ALTER TABLE "website_favicon" ADD COLUMN "dark_data" "bytea";--> statement-breakpoint
ALTER TABLE "website_favicon" ADD COLUMN "dark_content_type" text;--> statement-breakpoint
ALTER TABLE "website_favicon" ADD COLUMN "dark_source_url" text;--> statement-breakpoint
ALTER TABLE "website" DROP COLUMN "icon_url";