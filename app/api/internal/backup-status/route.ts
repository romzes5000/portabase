import {verifyApiKeyRequest} from "@/lib/api/internal-auth";
import {internalGetBackupStatus, resolveOrganizationId} from "@/lib/api/internal-queries";

export async function GET(request: Request) {
    const auth = await verifyApiKeyRequest(request, "read");
    if (!auth.ok) {
        return auth.response;
    }
    const url = new URL(request.url);
    const orgId = resolveOrganizationId(auth.key, url.searchParams.get("organization_id"));
    try {
        const data = await internalGetBackupStatus(orgId);
        return Response.json({ok: true, data});
    } catch (e) {
        return Response.json(
            {ok: false, error: e instanceof Error ? e.message : "Internal error"},
            {status: 500}
        );
    }
}
