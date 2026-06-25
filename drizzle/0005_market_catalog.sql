CREATE TABLE "supported_market" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"timezone" text NOT NULL,
	"description" text NOT NULL,
	"holiday_calendar_code" text NOT NULL,
	"weekend_days" text[] NOT NULL,
	CONSTRAINT "supported_market_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "supported_market_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supported_market_closure" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_id" integer NOT NULL,
	"closure_date" date NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"start_time" text,
	"end_time" text
);
--> statement-breakpoint
DROP TABLE "market_status_cache" CASCADE;
--> statement-breakpoint
DROP TABLE "market_watchlist" CASCADE;
--> statement-breakpoint
CREATE TABLE "market_watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"supported_market_id" integer NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_watchlist_supported_market_id_unique" UNIQUE("supported_market_id")
);
--> statement-breakpoint
ALTER TABLE "supported_market_session" ADD CONSTRAINT "supported_market_session_market_id_supported_market_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."supported_market"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supported_market_closure" ADD CONSTRAINT "supported_market_closure_market_id_supported_market_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."supported_market"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "market_watchlist" ADD CONSTRAINT "market_watchlist_supported_market_id_supported_market_id_fk" FOREIGN KEY ("supported_market_id") REFERENCES "public"."supported_market"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "supported_market" (
	"id",
	"slug",
	"title",
	"city",
	"country",
	"timezone",
	"description",
	"holiday_calendar_code",
	"weekend_days"
) VALUES
	(1, 'nyse', 'NYSE', 'New York', 'United States', 'America/New_York', 'New York Stock Exchange', 'US', ARRAY['sat', 'sun']),
	(2, 'nasdaq', 'Nasdaq', 'New York', 'United States', 'America/New_York', 'NASDAQ Stock Market', 'US', ARRAY['sat', 'sun']),
	(3, 'shanghai-stock-exchange', 'Shanghai Stock Exchange', 'Shanghai', 'China', 'Asia/Shanghai', 'Shanghai Stock Exchange Main Board', 'CN', ARRAY['sat', 'sun']),
	(4, 'tokyo-stock-exchange', 'Tokyo Stock Exchange', 'Tokyo', 'Japan', 'Asia/Tokyo', 'Tokyo Stock Exchange cash equities', 'JP', ARRAY['sat', 'sun']),
	(5, 'euronext-paris', 'Euronext Paris', 'Paris', 'France', 'Europe/Paris', 'Euronext Paris cash market', 'FR', ARRAY['sat', 'sun']),
	(6, 'hong-kong-stock-exchange', 'Hong Kong Stock Exchange', 'Hong Kong', 'Hong Kong', 'Asia/Hong_Kong', 'Hong Kong cash equities', 'HK', ARRAY['sat', 'sun']),
	(7, 'taiwan-stock-exchange', 'Taiwan Stock Exchange', 'Taipei', 'Taiwan', 'Asia/Taipei', 'Taiwan cash equities', 'TW', ARRAY['sat', 'sun']),
	(8, 'korea-exchange', 'Korea Exchange', 'Seoul', 'South Korea', 'Asia/Seoul', 'Korea Exchange cash market', 'KR', ARRAY['sat', 'sun']),
	(9, 'london-stock-exchange', 'London Stock Exchange', 'London', 'United Kingdom', 'Europe/London', 'London Stock Exchange Main Market', 'GB', ARRAY['sat', 'sun']),
	(10, 'xetra-frankfurt', 'Xetra / Frankfurt', 'Frankfurt', 'Germany', 'Europe/Berlin', 'Xetra electronic trading', 'DE', ARRAY['sat', 'sun']),
	(11, 'shenzhen-stock-exchange', 'Shenzhen Stock Exchange', 'Shenzhen', 'China', 'Asia/Shanghai', 'Shenzhen Stock Exchange Main Board', 'CN', ARRAY['sat', 'sun']),
	(12, 'toronto-stock-exchange', 'Toronto Stock Exchange', 'Toronto', 'Canada', 'America/Toronto', 'Toronto Stock Exchange equities', 'CA', ARRAY['sat', 'sun']),
	(13, 'bombay-stock-exchange', 'Bombay Stock Exchange', 'Mumbai', 'India', 'Asia/Kolkata', 'Bombay Stock Exchange equities', 'IN', ARRAY['sat', 'sun']),
	(14, 'national-stock-exchange-of-india', 'National Stock Exchange of India', 'Mumbai', 'India', 'Asia/Kolkata', 'National Stock Exchange of India cash market', 'IN', ARRAY['sat', 'sun']),
	(15, 'vienna-stock-exchange', 'Vienna Stock Exchange', 'Vienna', 'Austria', 'Europe/Vienna', 'Vienna Stock Exchange cash market', 'AT', ARRAY['sat', 'sun']);
--> statement-breakpoint
SELECT setval(
	pg_get_serial_sequence('supported_market', 'id'),
	(SELECT MAX("id") FROM "supported_market")
);
--> statement-breakpoint
INSERT INTO "supported_market_session" ("market_id", "sort_order", "start_time", "end_time") VALUES
	(1, 0, '09:30', '16:00'),
	(2, 0, '09:30', '16:00'),
	(3, 0, '09:30', '11:30'),
	(3, 1, '13:00', '15:00'),
	(4, 0, '09:00', '11:30'),
	(4, 1, '12:30', '15:30'),
	(5, 0, '09:00', '17:30'),
	(6, 0, '09:30', '12:00'),
	(6, 1, '13:00', '16:00'),
	(7, 0, '09:00', '13:30'),
	(8, 0, '09:00', '15:30'),
	(9, 0, '08:00', '16:30'),
	(10, 0, '09:00', '17:30'),
	(11, 0, '09:30', '11:30'),
	(11, 1, '13:00', '15:00'),
	(12, 0, '09:30', '16:00'),
	(13, 0, '09:15', '15:30'),
	(14, 0, '09:15', '15:30'),
	(15, 0, '09:00', '17:30');
--> statement-breakpoint
INSERT INTO "supported_market_closure" (
	"market_id",
	"closure_date",
	"kind",
	"reason",
	"sort_order",
	"start_time",
	"end_time"
) VALUES
	(1, '2026-04-03', 'closed', 'Good Friday', 0, NULL, NULL),
	(1, '2026-11-27', 'session', 'Day after Thanksgiving early close', 0, '09:30', '13:00'),
	(1, '2026-12-24', 'session', 'Christmas Eve early close', 0, '09:30', '13:00'),
	(2, '2026-04-03', 'closed', 'Good Friday', 0, NULL, NULL),
	(2, '2026-11-27', 'session', 'Day after Thanksgiving early close', 0, '09:30', '13:00'),
	(2, '2026-12-24', 'session', 'Christmas Eve early close', 0, '09:30', '13:00'),
	(4, '2026-01-02', 'closed', 'Exchange New Year holiday', 0, NULL, NULL),
	(5, '2026-04-03', 'closed', 'Good Friday', 0, NULL, NULL),
	(10, '2026-12-24', 'closed', 'Christmas Eve', 0, NULL, NULL),
	(10, '2026-12-31', 'closed', 'New Year''s Eve', 0, NULL, NULL),
	(12, '2026-04-03', 'closed', 'Good Friday', 0, NULL, NULL);
