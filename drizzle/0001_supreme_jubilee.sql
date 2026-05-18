CREATE TABLE "cctv_cameras" (
	"camera_id" serial PRIMARY KEY NOT NULL,
	"index" varchar(10),
	"district" integer,
	"location_name" varchar(100),
	"nearby_place" varchar(100),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"direction" varchar(10),
	"county" varchar(50),
	"route" varchar(20),
	"in_service" boolean,
	"current_image_url" text,
	"last_updated" timestamp,
	"raw_data" jsonb,
	"fetched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chp_cad_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" varchar(100),
	"incident_type" varchar(100),
	"location" text,
	"city" varchar(100),
	"county" varchar(100),
	"log_time" timestamp,
	"details" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"status" varchar(20) DEFAULT 'active',
	"fetched_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chp_cad_incidents_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "chp_collisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" varchar(50),
	"collision_date" timestamp,
	"collision_year" integer,
	"severity" varchar(50),
	"county" varchar(100),
	"city" varchar(100),
	"location" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"primary_factor" text,
	"weather" varchar(50),
	"lighting" varchar(50),
	"injuries" integer DEFAULT 0,
	"fatalities" integer DEFAULT 0,
	"raw_data" jsonb,
	"fetched_at" timestamp DEFAULT now(),
	"last_seen" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chp_collisions_case_id_unique" UNIQUE("case_id")
);
--> statement-breakpoint
CREATE INDEX "idx_chp_cad_county" ON "chp_cad_incidents" USING btree ("county");--> statement-breakpoint
CREATE INDEX "idx_chp_cad_type" ON "chp_cad_incidents" USING btree ("incident_type");--> statement-breakpoint
CREATE INDEX "idx_chp_cad_status" ON "chp_cad_incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_chp_cad_time" ON "chp_cad_incidents" USING btree ("log_time");--> statement-breakpoint
CREATE INDEX "idx_chp_county" ON "chp_collisions" USING btree ("county");--> statement-breakpoint
CREATE INDEX "idx_chp_severity" ON "chp_collisions" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_chp_year" ON "chp_collisions" USING btree ("collision_year");--> statement-breakpoint
CREATE INDEX "idx_chp_date" ON "chp_collisions" USING btree ("collision_date");