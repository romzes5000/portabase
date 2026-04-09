"use server";

import {z} from "zod";
import {ActionError, userAction} from "@/lib/safe-actions/actions";
import {
    createUserApiKey,
    listUserApiKeys,
    revokeUserApiKey,
} from "./api-keys.server";

export const createApiKeyAction = userAction
    .schema(
        z.object({
            name: z.string().min(1).max(128),
            access: z.enum(["read", "write", "admin"]).default("read"),
        })
    )
    .action(async ({parsedInput, ctx}) => {
        const result = await createUserApiKey(ctx.user.id, {
            name: parsedInput.name,
            access: parsedInput.access,
        });
        if ("error" in result) {
            throw new ActionError(result.error);
        }
        return {
            success: true as const,
            id: result.id,
            plaintext: result.plaintext,
            keyPrefix: result.keyPrefix,
        };
    });

export const listApiKeysAction = userAction
    .schema(z.object({}))
    .action(async ({ctx}) => {
        const keys = await listUserApiKeys(ctx.user.id);
        return {
            success: true as const,
            keys: keys.map((k) => ({
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
        const result = await revokeUserApiKey(ctx.user.id, parsedInput.apiKeyId);
        if ("error" in result) {
            throw new ActionError(result.error);
        }
        return {success: true as const};
    });
