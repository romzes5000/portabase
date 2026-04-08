import type {CallToolResult} from "@modelcontextprotocol/sdk/types.js";

export function toolErr(operation: string, err: unknown): CallToolResult {
    const msg = err instanceof Error ? err.message : String(err);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({ok: false, operation, error: msg}),
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
