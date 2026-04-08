import {createHash} from "crypto";
import {and, eq, isNull} from "drizzle-orm";
import {db} from "@/db";
import {apiKey} from "@/db/schema/16_api-key";
import {member} from "@/db/schema/04_member";

export type VerifiedApiKey = typeof apiKey.$inferSelect;

/** User-scoped context for MCP / internal API (memberships from member table). */
export type McpContext = {
    userId: string;
    allowedOrgIds: string[];
    memberships: Array<{organizationId: string; role: string}>;
};

/**
 * Loads organization memberships for the API key owner. Requires createdById.
 */
export async function loadMcpContext(key: VerifiedApiKey): Promise<McpContext> {
    const userId = key.createdById;
    if (!userId) {
        throw new Error("API key has no owner (createdById is null). Re-create the key.");
    }
    const rows = await db.query.member.findMany({
        where: and(eq(member.userId, userId), isNull(member.deletedAt)),
    });
    return {
        userId,
        allowedOrgIds: rows.map((r) => r.organizationId),
        memberships: rows.map((r) => ({organizationId: r.organizationId, role: r.role})),
    };
}

/**
 * Validates Bearer token against api_keys.key_hash (SHA-256 hex of plaintext).
 * Updates last_used_at on success (fire-and-forget).
 */
export async function verifyApiKeyRequest(
    request: Request,
    requiredScope: string
): Promise<{ok: true; key: VerifiedApiKey} | {ok: false; response: Response}> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return {
            ok: false,
            response: Response.json({ok: false, error: "Missing API key"}, {status: 401}),
        };
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
        return {
            ok: false,
            response: Response.json({ok: false, error: "Missing API key"}, {status: 401}),
        };
    }
    const hash = createHash("sha256").update(token, "utf8").digest("hex");
    const row = await db.query.apiKey.findFirst({
        where: and(eq(apiKey.keyHash, hash), isNull(apiKey.deletedAt)),
    });
    if (!row) {
        return {
            ok: false,
            response: Response.json({ok: false, error: "Invalid API key"}, {status: 401}),
        };
    }
    if (row.expiresAt && row.expiresAt < new Date()) {
        return {
            ok: false,
            response: Response.json({ok: false, error: "API key expired"}, {status: 401}),
        };
    }
    if (!row.scopes.includes(requiredScope)) {
        return {
            ok: false,
            response: Response.json({ok: false, error: "Insufficient scope"}, {status: 403}),
        };
    }
    void (async () => {
        try {
            await db.update(apiKey).set({lastUsedAt: new Date()}).where(eq(apiKey.id, row.id));
        } catch {
            /* ignore */
        }
    })();
    return {ok: true, key: row};
}
