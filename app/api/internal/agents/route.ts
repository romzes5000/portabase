import {verifyApiKeyRequest} from "@/lib/api/internal-auth";
import {internalListAgents, resolveOrganizationId} from "@/lib/api/internal-queries";

export async function GET(request: Request) {
    const auth = await verifyApiKeyRequest(request, "read");
    if (!auth.ok) {
        return auth.response;
    }
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("include_archived") === "true";
    const orgId = resolveOrganizationId(auth.key, url.searchParams.get("organization_id"));
    try {
        const data = await internalListAgents(orgId, includeArchived);
        return Response.json({ok: true, data});
    } catch (e) {
        return Response.json(
            {ok: false, error: e instanceof Error ? e.message : "Internal error"},
            {status: 500}
        );
    }
}
