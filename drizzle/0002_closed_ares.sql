CREATE TABLE "bay_area_traffic_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" varchar(100),
	"jurisdiction" varchar(50) DEFAULT 'SF Bay Area',
	"event_type" varchar(100),
	"event_sub_type" varchar(100),
	"severity" varchar(50),
	"status" varchar(20) DEFAULT 'active',
	"title" text,
	"description" text,
	"roadway_name" varchar(100),
	"direction_of_travel" varchar(50),
	"lanes_affected" text,
	"is_full_closure" boolean,
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
CREATE INDEX "idx_bay_area_type" ON "bay_area_traffic_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_bay_area_status" ON "bay_area_traffic_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bay_area_route" ON "bay_area_traffic_events" USING btree ("roadway_name");--> statement-breakpoint
CREATE INDEX "idx_bay_area_time" ON "bay_area_traffic_events" USING btree ("start_time");