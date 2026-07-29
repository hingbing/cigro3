CREATE TYPE "public"."ledger_type" AS ENUM('ISSUE', 'RESERVATION_DEBIT', 'MEMBER_CANCEL_RESTORE', 'CLASS_CANCEL_RESTORE');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('CONFIRMED', 'MEMBER_CANCELLED', 'CLASS_CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('WAITING', 'OFFERED', 'CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "pass_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pass_id" uuid NOT NULL,
	"reservation_id" uuid,
	"type" "ledger_type" NOT NULL,
	"delta" integer NOT NULL,
	"dedupe_key" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"pass_id" uuid NOT NULL,
	"status" "reservation_status" DEFAULT 'CONFIRMED' NOT NULL,
	"request_id" varchar(255) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"booked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"status" "waitlist_status" DEFAULT 'WAITING' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"offer_expires_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolution_reason" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"type" varchar(80) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" varchar(1000) NOT NULL,
	"target_path" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"dedupe_key" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pass_ledger" ADD CONSTRAINT "pass_ledger_pass_id_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."passes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_ledger" ADD CONSTRAINT "pass_ledger_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_occurrence_id_class_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."class_occurrences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_pass_id_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."passes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_occurrence_id_class_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."class_occurrences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pass_ledger_dedupe_key_uq" ON "pass_ledger" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "pass_ledger_pass_created_idx" ON "pass_ledger" USING btree ("pass_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_request_id_uq" ON "reservations" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_active_member_occurrence_uq" ON "reservations" USING btree ("member_id","occurrence_id") WHERE "reservations"."status" = 'CONFIRMED';--> statement-breakpoint
CREATE INDEX "reservations_occurrence_status_idx" ON "reservations" USING btree ("occurrence_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_active_member_occurrence_uq" ON "waitlist_entries" USING btree ("member_id","occurrence_id") WHERE "waitlist_entries"."status" in ('WAITING', 'OFFERED');--> statement-breakpoint
CREATE INDEX "waitlist_queue_idx" ON "waitlist_entries" USING btree ("occurrence_id","status","joined_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_key_uq" ON "notifications" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_member_created_idx" ON "notifications" USING btree ("member_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE FUNCTION sync_reservation_interval() RETURNS trigger
LANGUAGE plpgsql AS $function$
BEGIN
  SELECT starts_at, ends_at
    INTO NEW.starts_at, NEW.ends_at
    FROM class_occurrences
   WHERE id = NEW.occurrence_id;
  IF NEW.starts_at IS NULL OR NEW.ends_at IS NULL THEN
    RAISE EXCEPTION 'class occurrence not found';
  END IF;
  RETURN NEW;
END;
$function$;--> statement-breakpoint
CREATE TRIGGER reservations_sync_interval
  BEFORE INSERT OR UPDATE OF occurrence_id ON reservations
  FOR EACH ROW EXECUTE FUNCTION sync_reservation_interval();--> statement-breakpoint
ALTER TABLE reservations ADD CONSTRAINT reservations_member_time_no_overlap
  EXCLUDE USING gist (
    member_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status = 'CONFIRMED');
