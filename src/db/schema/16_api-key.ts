import {relations} from "drizzle-orm";
import {pgTable, text, timestamp, uuid} from "drizzle-orm/pg-core";
import {createSelectSchema} from "drizzle-zod";
import {z} from "zod";
import {organization} from "@/db/schema/03_organization";
import {user} from "@/db/schema/02_user";
import {timestamps} from "@/db/schema/00_common";

/** Service API keys for internal HTTP API (MCP, monitoring). Plaintext shown once at creation. */
export const apiKey = pgTable("api_keys", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    scopes: text("scopes").array().notNull(),
    organizationId: uuid("organization_id").references(() => organization.id, {onDelete: "set null"}),
    createdById: uuid("created_by_id").references(() => user.id, {onDelete: "set null"}),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    ...timestamps,
});

export const apiKeyRelations = relations(apiKey, ({one}) => ({
    organization: one(organization, {
        fields: [apiKey.organizationId],
        references: [organization.id],
    }),
    createdBy: one(user, {
        fields: [apiKey.createdById],
        references: [user.id],
    }),
}));

export const apiKeySchema = createSelectSchema(apiKey);
export type ApiKey = z.infer<typeof apiKeySchema>;
