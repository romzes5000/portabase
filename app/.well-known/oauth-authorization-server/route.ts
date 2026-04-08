import {NextResponse} from "next/server";

export const runtime = "nodejs";

/**
 * Отдельного OAuth Authorization Server для MCP нет (только Bearer API key).
 * Важно отдавать JSON, а не HTML от catch-all — иначе Cursor: Unexpected token '<'.
 */
export async function GET() {
    return NextResponse.json(
        {
            error: "oauth_authorization_server_not_configured",
            message:
                "MCP uses Authorization: Bearer API keys (Organization settings → API keys), not browser OAuth.",
        },
        {status: 404},
    );
}
