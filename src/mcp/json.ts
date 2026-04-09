import type {CallToolResult} from "@modelcontextprotocol/sdk/types.js";

import {OrgAccessDeniedError, OrgRoleDeniedError} from "@/mcp/org-scope";

export function toolErr(operation: string, err: unknown): CallToolResult {
    const msg = err instanceof Error ? err.message : String(err);
    const body: Record<string, unknown> = {ok: false, operation, error: msg};
    if (err instanceof OrgAccessDeniedError) {
        body.code = "org_access_denied";
    } else if (err instanceof OrgRoleDeniedError) {
        body.code = "org_role_denied";
    }
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(body),
            },
        ],
        isError: true,
    };
}

export function toolOk(payload: Record<string, unknown>): CallToolResult {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(payload, null, 2),
            },
        ],
    };
}
