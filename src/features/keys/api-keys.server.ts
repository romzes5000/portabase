import {createHash, randomBytes} from "node:crypto";
import {and, desc, eq, isNull} from "drizzle-orm";
import {db} from "@/db";
import {apiKey} from "@/db/schema/16_api-key";
import type {ApiKeyAccessLevel} from "./api-keys.scopes";
import {normalizeApiKeyScopes} from "./api-keys.scopes";

export type UserApiKeyRow = {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
};

export async function createUserApiKey(
    userId: string,
    input: {name: string; access: ApiKeyAccessLevel}
): Promise<{success: true; id: string; plaintext: string; keyPrefix: string} | {error: string}> {
    const plaintext = `pb_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(plaintext, "utf8").digest("hex");
    const keyPrefix = plaintext.slice(0, 12);
    const scopes = normalizeApiKeyScopes(input.access);
    try {
        const [row] = await db
            .insert(apiKey)
            .values({
                name: input.name,
                keyHash,
                keyPrefix,
                scopes,
                organizationId: null,
                createdById: userId,
            })
            .returning({id: apiKey.id});
        if (!row) {
            return {error: "Insert returned no row"};
        }
        return {
            success: true,
            id: row.id,
            plaintext,
            keyPrefix,
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("api_keys") || msg.includes("does not exist")) {
            return {
                error:
                    "Database table api_keys is missing. Run: pnpm db:migrate (or ensure migration 0049 is applied).",
            };
        }
        return {error: `Could not create API key: ${msg}`};
    }
}

export async function listUserApiKeys(userId: string): Promise<UserApiKeyRow[]> {
    const rows = await db.query.apiKey.findMany({
        where: and(eq(apiKey.createdById, userId), isNull(apiKey.deletedAt)),
        orderBy: [desc(apiKey.createdAt)],
    });
    return rows.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt,
    }));
}

export async function revokeUserApiKey(
    userId: string,
    apiKeyId: string
): Promise<{success: true} | {error: string}> {
    const row = await db.query.apiKey.findFirst({
        where: and(eq(apiKey.id, apiKeyId), isNull(apiKey.deletedAt)),
    });
    if (!row) {
        return {error: "API key not found"};
    }
    if (row.createdById !== userId) {
        return {error: "Forbidden: you can only revoke your own API keys"};
    }
    await db.update(apiKey).set({deletedAt: new Date()}).where(eq(apiKey.id, apiKeyId));
    return {success: true};
}
