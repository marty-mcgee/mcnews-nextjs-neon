CREATE TABLE "calfire_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"unique_id" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(50) DEFAULT 'Wildfire',
	"status" varchar(20) DEFAULT 'active',
	"county" varchar(100),
	"location" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"acres_burned" numeric(12, 1),
	"percent_contained" numeric(5, 1),
	"started_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"extinguished_at" timestamp with time zone,
	"admin_unit" varchar(200),
	"url" text,
	"is_active" boolean DEFAULT true,
	"is_calfire_incident" boolean DEFAULT false,
	"raw_data" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now(),
	"last_seen" timestamp with time zone DEFAULT now(),
	CONSTRAINT "calfire_incidents_unique_id_unique" UNIQUE("unique_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_calfire_unique_id" ON "calfire_incidents" USING btree ("unique_id");--> statement-breakpoint
CREATE INDEX "idx_calfire_county" ON "calfire_incidents" USING btree ("county");--> statement-breakpoint
CREATE INDEX "idx_calfire_status" ON "calfire_incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_calfire_active" ON "calfire_incidents" USING btree ("is_active");