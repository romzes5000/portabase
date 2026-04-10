CREATE TABLE "organization_agents" (
	"organization_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "organization_agents_organization_id_agent_id_unique" UNIQUE("organization_id","agent_id")
);
--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "verified" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "organization_agents" ADD CONSTRAINT "organization_agents_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_agents" ADD CONSTRAINT "organization_agents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Custom SQL: backfill organization_agents from existing databases (Portabase upstream 0050_dark_saracen)
DO $$
DECLARE
    org RECORD;
    proj RECORD;
    db RECORD;
BEGIN
    FOR org IN SELECT id FROM organization LOOP
            FOR proj IN
                SELECT id FROM projects WHERE organization_id = org.id
                LOOP
                    FOR db IN
                        SELECT agent_id FROM databases WHERE project_id = proj.id
                        LOOP
                            IF db.agent_id IS NOT NULL THEN
                                INSERT INTO organization_agents (
                                    organization_id,
                                    agent_id
                                )
                                VALUES (
                                    org.id,
                                    db.agent_id
                                )
                                ON CONFLICT (organization_id, agent_id) DO NOTHING;
                            END IF;
                        END LOOP;
                END LOOP;
        END LOOP;
END $$;