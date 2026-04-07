import {verifyApiKeyRequest} from "@/lib/api/internal-auth";
import {internalListBackups, resolveOrganizationId} from "@/lib/api/internal-queries";

export async function GET(request: Request) {
    const auth = await verifyApiKeyRequest(request, "read");
    if (!auth.ok) {
        return auth.response;
    }
    const url = new URL(request.url);
    const databaseId = url.searchParams.get("database_id") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const orgId = resolveOrganizationId(auth.key, null);
    try {
        const data = await internalListBackups(orgId, databaseId, status, limit, offset);
        return Response.json({ok: true, data});
    } catch (e) {
        return Response.json(
            {ok: false, error: e instanceof Error ? e.message : "Internal error"},
            {status: 500}
        );
    }
}
