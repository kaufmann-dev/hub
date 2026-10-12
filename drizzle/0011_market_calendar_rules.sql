ALTER TABLE "supported_market" ALTER COLUMN "holiday_calendar_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "supported_market_closure" ADD COLUMN "rule" text;