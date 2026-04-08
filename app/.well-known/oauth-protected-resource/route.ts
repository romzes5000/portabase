import {NextResponse} from "next/server";

import {env} from "@/env.mjs";

export const runtime = "nodejs";

/**
 * RFC 9728 — Protected Resource Metadata.
 * Cursor / MCP clients запрашивают JSON; без этого Next отдаёт HTML и падает parse JSON.
 * MCP на Portabase — только Bearer API key, без OAuth authorization server.
 */
export async function GET(request: Request) {
    const url = new URL(request.url);
    const resourceParam = url.searchParams.get("resource");
    const origin = new URL(env.PROJECT_URL).origin;
    const resource = resourceParam ?? `${origin}/api/mcp`;

    return NextResponse.json(
        {
            resource,
            authorization_servers: [] as string[],
        },
        {
            headers: {
                "Cache-Control": "public, max-age=300",
            },
        },
    );
}
