CREATE TABLE "comment_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"upload_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_attachments_comment_id_upload_id_unique" UNIQUE("comment_id","upload_id")
);
--> statement-breakpoint
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_attachments_workspace_id_index" ON "comment_attachments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "comment_attachments_upload_id_index" ON "comment_attachments" USING btree ("upload_id");