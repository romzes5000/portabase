import {verifyApiKeyRequest} from "@/lib/api/internal-auth";
import {internalListOrganizations} from "@/lib/api/internal-queries";

export async function GET(request: Request) {
    const auth = await verifyApiKeyRequest(request, "read");
    if (!auth.ok) {
        return auth.response;
    }
    const orgId = auth.key.organizationId;
    try {
        const data = await internalListOrganizations(orgId);
        return Response.json({ok: true, data});
    } catch (e) {
        return Response.json(
            {ok: false, error: e instanceof Error ? e.message : "Internal error"},
            {status: 500}
        );
    }
}
