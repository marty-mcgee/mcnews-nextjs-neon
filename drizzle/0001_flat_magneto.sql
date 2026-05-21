ALTER TABLE "chp_cad_incidents" DROP CONSTRAINT "chp_cad_incidents_center_id_chp_cad_centers_id_fk";
--> statement-breakpoint
DROP INDEX "idx_chp_cad_type";--> statement-breakpoint
ALTER TABLE "chp_cad_incidents" ADD CONSTRAINT "chp_cad_incidents_center_id_chp_cad_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."chp_cad_centers"("id") ON DELETE set null ON UPDATE no action;