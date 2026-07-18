CREATE TABLE "website_health" (
	"website_id" integer PRIMARY KEY NOT NULL,
	"healthy" boolean NOT NULL,
	"status_code" integer,
	"failure_kind" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "website_health" ADD CONSTRAINT "website_health_website_id_website_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."website"("id") ON DELETE cascade ON UPDATE no action;