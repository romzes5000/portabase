import type {VerifiedApiKey} from "@/lib/api/internal-auth";
import {resolveOrganizationId} from "@/lib/api/internal-queries";

/**
 * Stdio MCP: `apiKey` is null → без ограничения по org (полный доступ к БД).
 * HTTP MCP: передаётся ключ → как у internal API (scoped org из ключа).
 */
export function resolveOrgForTool(
    apiKey: Pick<VerifiedApiKey, "organizationId"> | null,
    queryOrganizationId: string | null
): string | null {
    if (!apiKey) {
        return queryOrganizationId;
    }
    return resolveOrganizationId(apiKey as VerifiedApiKey, queryOrganizationId);
}
