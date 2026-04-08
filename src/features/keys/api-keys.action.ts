"use server";

import {createHash, randomBytes} from "node:crypto";
import {and, desc, eq, isNull} from "drizzle-orm";
import {z} from "zod";
import {db} from "@/db";
import {ActionError, userAction} from "@/lib/safe-actions/actions";
import {apiKey} from "@/db/schema/16_api-key";

export const createApiKeyAction = userAction
    .schema(
        z.object({
            name: z.string().min(1).max(128),
        })
    )
    .action(async ({parsedInput, ctx}) => {
        const plaintext = `pb_${randomBytes(32).toString("hex")}`;
        const keyHash = createHash("sha256").update(plaintext, "utf8").digest("hex");
        const keyPrefix = plaintext.slice(0, 12);
        try {
            const [row] = await db
                .insert(apiKey)
                .values({
                    name: parsedInput.name,
                    keyHash,
                    keyPrefix,
                    scopes: ["read"],
                    organizationId: null,
                    createdById: ctx.user.id,
                })
                .returning({id: apiKey.id});
            if (!row) {
                throw new ActionError("Insert returned no row");
            }
            return {
                success: true as const,
                id: row.id,
                plaintext,
                keyPrefix,
            };
        } catch (e) {
            if (e instanceof ActionError) {
                throw e;
            }
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("api_keys") || msg.includes("does not exist")) {
                throw new ActionError(
                    "Database table api_keys is missing. Run: pnpm db:migrate (or ensure migration 0049 is applied)."
                );
            }
            throw new ActionError(`Could not create API key: ${msg}`);
        }
    });

export const listApiKeysAction = userAction
    .schema(z.object({}))
    .action(async ({ctx}) => {
        const rows = await db.query.apiKey.findMany({
            where: and(eq(apiKey.createdById, ctx.user.id), isNull(apiKey.deletedAt)),
            orderBy: [desc(apiKey.createdAt)],
        });
        return {
            success: true as const,
            keys: rows.map((k) => ({
                id: k.id,
                name: k.name,
                keyPrefix: k.keyPrefix,
                scopes: k.scopes,
                lastUsedAt: k.lastUsedAt,
                expiresAt: k.expiresAt,
                createdAt: k.createdAt,
            })),
        };
    });

export const revokeApiKeyAction = userAction
    .schema(z.object({apiKeyId: z.string().uuid()}))
    .action(async ({parsedInput, ctx}) => {
        const row = await db.query.apiKey.findFirst({
            where: and(eq(apiKey.id, parsedInput.apiKeyId), isNull(apiKey.deletedAt)),
        });
        if (!row) {
            throw new ActionError("API key not found");
        }
        if (row.createdById !== ctx.user.id) {
            throw new ActionError("Forbidden: you can only revoke your own API keys");
        }
        await db
            .update(apiKey)
            .set({deletedAt: new Date()})
            .where(eq(apiKey.id, parsedInput.apiKeyId));
        return {success: true as const};
    });
