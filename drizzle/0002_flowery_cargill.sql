CREATE TABLE "website_favicon" (
	"website_id" integer PRIMARY KEY NOT NULL,
	"data" "bytea",
	"content_type" text,
	"source_url" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "website_favicon" ADD CONSTRAINT "website_favicon_website_id_website_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."website"("id") ON DELETE cascade ON UPDATE no action;