import {WebStandardStreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import {verifyApiKeyRequest} from "@/lib/api/internal-auth";
import {createPortabaseMcpServer} from "@/mcp/create-mcp-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
        "Authorization, Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version",
    "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
    /** nginx: не буферить Streamable HTTP / SSE, иначе клиенты (Cursor) рвут соединение → Abort / SSE undefined */
    "X-Accel-Buffering": "no",
};

async function handleMcp(request: Request): Promise<Response> {
    const auth = await verifyApiKeyRequest(request, "read");
    if (!auth.ok) {
        return auth.response;
    }
    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
    });
    const server = createPortabaseMcpServer(auth.key);
    await server.connect(transport);
    const res = await transport.handleRequest(request);

    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
        if (!h.has(k)) {
            h.set(k, v);
        }
    }

    const cleanup = () => Promise.allSettled([server.close(), transport.close()]);

    if (!res.body) {
        await cleanup();
        return new Response(null, {status: res.status, statusText: res.statusText, headers: h});
    }

    const body = res.body.pipeThrough(
        new TransformStream({
            flush() {
                cleanup();
            },
        }),
    );

    return new Response(body, {status: res.status, statusText: res.statusText, headers: h});
}

export async function GET(request: Request) {
    return handleMcp(request);
}

export async function POST(request: Request) {
    return handleMcp(request);
}

export async function DELETE(request: Request) {
    return handleMcp(request);
}

export async function OPTIONS() {
    return new Response(null, {status: 204, headers: corsHeaders});
}
