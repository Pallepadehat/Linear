CREATE TABLE "issue_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"upload_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_attachments_issue_id_upload_id_unique" UNIQUE("issue_id","upload_id")
);
--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_attachments_workspace_id_index" ON "issue_attachments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "issue_attachments_upload_id_index" ON "issue_attachments" USING btree ("upload_id");--> statement-breakpoint
-- Backfill links for descriptions written before this table existed, so the orphan
-- sweep doesn't delete attachments that are still referenced.
INSERT INTO "issue_attachments" ("id", "workspace_id", "issue_id", "upload_id")
SELECT gen_random_uuid(), i."workspace_id", i."id", u."id"
FROM "issues" i
CROSS JOIN LATERAL (
	SELECT DISTINCT lower(m[1])::uuid AS "upload_id"
	FROM regexp_matches(
		i."description",
		'\]\(\s*<?attachment:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
		'g'
	) AS m
) refs
JOIN "uploads" u
	ON u."id" = refs."upload_id"
	AND u."workspace_id" = i."workspace_id"
	AND u."kind" = 'attachment'
	AND u."status" = 'ready'
WHERE i."description" IS NOT NULL
ON CONFLICT DO NOTHING;
