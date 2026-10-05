CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"author_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"kind" text NOT NULL,
	"urgent" boolean DEFAULT false NOT NULL,
	"action_label" text,
	"action_url" text,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcements_kind_check" CHECK ("announcements"."kind" in ('alert', 'update', 'info'))
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"peer_id" uuid NOT NULL,
	"event_id" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connections_owner_peer_uq" UNIQUE("owner_id","peer_id"),
	CONSTRAINT "connections_source_check" CHECK ("connections"."source" in ('scan', 'scanned')),
	CONSTRAINT "connections_not_self_check" CHECK ("connections"."owner_id" <> "connections"."peer_id")
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"issued_by" uuid,
	"role" text,
	"placement" text,
	"track" text,
	"project_name" text,
	"project_url" text,
	"payload" text NOT NULL,
	"signature" text NOT NULL,
	"key_id" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "credentials_type_check" CHECK ("credentials"."type" in ('stamp', 'award'))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "events_kind_check" CHECK ("events"."kind" in ('hackathon', 'meetup', 'workshop', 'conference')),
	CONSTRAINT "events_ends_after_starts_check" CHECK ("events"."ends_at" > "events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"actor_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" in ('connection', 'stamp', 'award', 'vouch', 'role'))
);
--> statement-breakpoint
CREATE TABLE "one_time_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "one_time_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "one_time_tokens_purpose_check" CHECK ("one_time_tokens"."purpose" in ('password_reset', 'oauth_login', 'oauth_signup', 'oauth_linked'))
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rsvps_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"github_id" text,
	"email_verified_at" timestamp with time zone,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"github_username" text,
	"linkedin_url" text,
	"website_url" text,
	"contact_email" text,
	"phone" text,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"open_to" text[] DEFAULT '{}'::text[] NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"badge_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_handle_unique" UNIQUE("handle"),
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id"),
	CONSTRAINT "users_badge_id_unique" UNIQUE("badge_id"),
	CONSTRAINT "users_email_lowercase_check" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_handle_format_check" CHECK ("users"."handle" ~ '^[a-z0-9_]{3,24}$'),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('member', 'organizer', 'admin')),
	CONSTRAINT "users_visibility_check" CHECK ("users"."visibility" in ('public', 'connections'))
);
--> statement-breakpoint
CREATE TABLE "vouches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"message" text NOT NULL,
	"event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_peer_id_users_id_fk" FOREIGN KEY ("peer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouches" ADD CONSTRAINT "vouches_voucher_id_users_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouches" ADD CONSTRAINT "vouches_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouches" ADD CONSTRAINT "vouches_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_created_at_idx" ON "announcements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "announcements_event_id_created_at_idx" ON "announcements" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "connections_peer_id_idx" ON "connections" USING btree ("peer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_live_stamp_uq" ON "credentials" USING btree ("user_id","event_id","role") WHERE "credentials"."type" = 'stamp' and "credentials"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_live_award_uq" ON "credentials" USING btree ("user_id","event_id","placement",coalesce("track", '')) WHERE "credentials"."type" = 'award' and "credentials"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "credentials_user_id_idx" ON "credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credentials_event_id_idx" ON "credentials" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "one_time_tokens_user_purpose_created_idx" ON "one_time_tokens" USING btree ("user_id","purpose","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vouches_pair_skill_uq" ON "vouches" USING btree ("voucher_id","recipient_id",lower("skill"));--> statement-breakpoint
CREATE INDEX "vouches_recipient_id_idx" ON "vouches" USING btree ("recipient_id");