ALTER TYPE "public"."activity_kind" ADD VALUE 'cycle';--> statement-breakpoint
CREATE TABLE "cycles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"name" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"scope_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cycles_team_id_number_unique" UNIQUE("team_id","number"),
	CONSTRAINT "cycles_ends_after_start" CHECK ("cycles"."ends_at" > "cycles"."starts_at"),
	CONSTRAINT "cycles_number_positive" CHECK ("cycles"."number" > 0)
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "cycles_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "cycle_duration_weeks" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "cycle_start_weekday" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "cycle_cooldown_weeks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "cycle_upcoming_count" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "cycle_auto_add_started" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "cycle_rollover_unfinished" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "cycle_id" uuid;--> statement-breakpoint
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cycles_workspace_id_index" ON "cycles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "cycles_team_id_starts_at_index" ON "cycles" USING btree ("team_id","starts_at");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issues_cycle_id_index" ON "issues" USING btree ("cycle_id");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_cycle_duration_range" CHECK ("teams"."cycle_duration_weeks" between 1 and 8);--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_cycle_start_weekday_range" CHECK ("teams"."cycle_start_weekday" between 0 and 6);--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_cycle_cooldown_range" CHECK ("teams"."cycle_cooldown_weeks" between 0 and 2);--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_cycle_upcoming_range" CHECK ("teams"."cycle_upcoming_count" between 1 and 6);