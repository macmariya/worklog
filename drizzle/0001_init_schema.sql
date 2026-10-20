CREATE TABLE "activities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "projects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"is_business" boolean DEFAULT true NOT NULL,
	"default_activity_id" integer,
	"color" text DEFAULT 'gray' NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_unique" UNIQUE("name"),
	CONSTRAINT "projects_color_check" CHECK ("projects"."color" in ('gray', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple'))
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "time_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" integer NOT NULL,
	"activity_id" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"entry_date" date GENERATED ALWAYS AS (jst_date(started_at)) STORED,
	"note" text DEFAULT '' NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entries_end_after_start" CHECK (ended_at is null or ended_at > started_at),
	CONSTRAINT "time_entries_same_jst_day" CHECK (ended_at is null or jst_date(started_at) = jst_date(ended_at - interval '1 microsecond')),
	CONSTRAINT "time_entries_note_length" CHECK (char_length(note) <= 200),
	CONSTRAINT "time_entries_source_check" CHECK (source in ('timer', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_activity_id_activities_id_fk" FOREIGN KEY ("default_activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_one_running" ON "time_entries" USING btree ((true)) WHERE ended_at is null;--> statement-breakpoint
CREATE INDEX "time_entries_entry_date_idx" ON "time_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "time_entries_project_idx" ON "time_entries" USING btree ("project_id","entry_date");