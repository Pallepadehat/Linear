ALTER TABLE "labels" DROP CONSTRAINT "labels_workspace_id_name_unique";--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "labels_workspace_id_name_unique" ON "labels" USING btree ("workspace_id","name") WHERE "labels"."team_id" is null;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_team_id_name_unique" UNIQUE("team_id","name");