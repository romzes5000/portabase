import {verifyApiKeyRequest} from "@/lib/api/internal-auth";
import {internalListDatabases, resolveOrganizationId} from "@/lib/api/internal-queries";

export async function GET(request: Request) {
    const auth = await verifyApiKeyRequest(request, "read");
    if (!auth.ok) {
        return auth.response;
    }
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agent_id") ?? "";
    const projectId = url.searchParams.get("project_id") ?? "";
    const orgId = resolveOrganizationId(auth.key, null);
    try {
        const data = await internalListDatabases(orgId, agentId, projectId);
        return Response.json({ok: true, data});
    } catch (e) {
        return Response.json(
            {ok: false, error: e instanceof Error ? e.message : "Internal error"},
            {status: 500}
        );
    }
}
