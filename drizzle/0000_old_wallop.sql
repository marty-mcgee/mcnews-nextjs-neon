CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_request_logs" (
	"log_id" serial PRIMARY KEY NOT NULL,
	"endpoint" text,
	"district" integer,
	"response_time_ms" integer,
	"status_code" integer,
	"success" boolean,
	"records_fetched" integer DEFAULT 0,
	"error_message" text,
	"response_size_bytes" integer,
	"request_timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bay_area_traffic_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" varchar(100),
	"event_type" varchar(100),
	"event_sub_type" varchar(100),
	"severity" varchar(50),
	"status" varchar(20) DEFAULT 'active',
	"title" text,
	"description" text,
	"roadway_name" varchar(100),
	"direction_of_travel" varchar(50),
	"lanes_affected" text,
	"is_full_closure" boolean DEFAULT false,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"start_time" timestamp,
	"end_time" timestamp,
	"last_updated" timestamp,
	"raw_data" jsonb,
	"fetched_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "bay_area_traffic_events_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "caltrans_districts" (
	"district_id" integer PRIMARY KEY NOT NULL,
	"district_name" varchar(100),
	"region" varchar(50),
	"counties" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "chp_cad_centers" (
	"id" serial PRIMARY KEY NOT NULL,
	"center_code" varchar(10) NOT NULL,
	"center_name" varchar(100) NOT NULL,
	"county" varchar(100),
	"region" varchar(50),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chp_cad_centers_center_code_unique" UNIQUE("center_code")
);
--> statement-breakpoint
CREATE TABLE "chp_cad_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" varchar(100),
	"center_id" integer,
	"incident_type" varchar(100),
	"location" text,
	"city" varchar(100),
	"county" varchar(100),
	"log_time" timestamp,
	"details" text,
	"status" varchar(20) DEFAULT 'active',
	"fetched_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
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
CREATE TABLE "lane_closures" (
	"closure_id" serial PRIMARY KEY NOT NULL,
	"source_id" varchar(100),
	"district" integer,
	"route" varchar(20),
	"direction" varchar(10),
	"closure_type" varchar(50),
	"closure_subtype" varchar(50),
	"lanes_affected" text,
	"lanes_closed" text,
	"lane_configuration" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"start_time" varchar(8),
	"end_time" varchar(8),
	"start_timestamp" timestamp,
	"end_timestamp" timestamp,
	"description" text,
	"location_description" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"county" varchar(100),
	"city" varchar(100),
	"status" varchar(20) DEFAULT 'active',
	"first_seen" timestamp DEFAULT now(),
	"last_seen" timestamp DEFAULT now(),
	"last_modified" timestamp DEFAULT now(),
	"times_seen" integer DEFAULT 1,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "lane_closures_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "lane_closures_snapshots" (
	"snapshot_id" serial PRIMARY KEY NOT NULL,
	"snapshot_timestamp" timestamp DEFAULT now(),
	"district" integer,
	"total_closures" integer,
	"closures_by_type" jsonb,
	"closures_by_route" jsonb,
	"raw_summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chp_cad_incidents" ADD CONSTRAINT "chp_cad_incidents_center_id_chp_cad_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."chp_cad_centers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_logs_timestamp" ON "api_request_logs" USING btree ("request_timestamp");--> statement-breakpoint
CREATE INDEX "idx_api_logs_success" ON "api_request_logs" USING btree ("success");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bay_area_source_id" ON "bay_area_traffic_events" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_bay_area_type" ON "bay_area_traffic_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_bay_area_roadway" ON "bay_area_traffic_events" USING btree ("roadway_name");--> statement-breakpoint
CREATE INDEX "idx_bay_area_status" ON "bay_area_traffic_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_districts_region" ON "caltrans_districts" USING btree ("region");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_chp_cad_centers_code" ON "chp_cad_centers" USING btree ("center_code");--> statement-breakpoint
CREATE INDEX "idx_chp_cad_centers_county" ON "chp_cad_centers" USING btree ("county");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_chp_cad_source_id" ON "chp_cad_incidents" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_chp_cad_center_id" ON "chp_cad_incidents" USING btree ("center_id");--> statement-breakpoint
CREATE INDEX "idx_chp_cad_county" ON "chp_cad_incidents" USING btree ("county");--> statement-breakpoint
CREATE INDEX "idx_chp_cad_log_time" ON "chp_cad_incidents" USING btree ("log_time");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_chp_case_id" ON "chp_collisions" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_chp_county" ON "chp_collisions" USING btree ("county");--> statement-breakpoint
CREATE INDEX "idx_chp_severity" ON "chp_collisions" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_chp_year" ON "chp_collisions" USING btree ("collision_year");--> statement-breakpoint
CREATE INDEX "idx_chp_date" ON "chp_collisions" USING btree ("collision_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_closures_source_id" ON "lane_closures" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_closures_district" ON "lane_closures" USING btree ("district");--> statement-breakpoint
CREATE INDEX "idx_closures_route" ON "lane_closures" USING btree ("route");--> statement-breakpoint
CREATE INDEX "idx_closures_status" ON "lane_closures" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_closures_last_seen" ON "lane_closures" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "idx_closures_dates" ON "lane_closures" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_snapshots_timestamp" ON "lane_closures_snapshots" USING btree ("snapshot_timestamp");--> statement-breakpoint
CREATE INDEX "idx_snapshots_district" ON "lane_closures_snapshots" USING btree ("district");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");