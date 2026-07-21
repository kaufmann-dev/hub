CREATE TABLE "app_session" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"id_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_transaction" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"browser_token_hash" text NOT NULL,
	"nonce" text NOT NULL,
	"code_verifier" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "app_session_expires_at_idx" ON "app_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oidc_transaction_expires_at_idx" ON "oidc_transaction" USING btree ("expires_at");