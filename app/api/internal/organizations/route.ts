import {verifyApiKeyRequest} from "@/lib/api/internal-auth";
import {internalListOrganizations} from "@/lib/api/internal-queries";
import {loadOrgScopeForApiKey, OrgAccessDeniedError} from "@/mcp/org-scope";

export async function GET(request: Request) {
    const auth = await verifyApiKeyRequest(request, "read");
    if (!auth.ok) {
        return auth.response;
    }
    const url = new URL(request.url);
    let scope;
    try {
        scope = await loadOrgScopeForApiKey(auth.key, url.searchParams.get("organization_id"));
    } catch (e) {
        if (e instanceof OrgAccessDeniedError) {
            return Response.json({ok: false, error: e.message}, {status: 403});
        }
        return Response.json(
            {ok: false, error: e instanceof Error ? e.message : "Internal error"},
            {status: 500}
        );
    }
    try {
        const data = await internalListOrganizations(scope.orgIds);
        return Response.json({ok: true, data});
    } catch (e) {
        return Response.json(
            {ok: false, error: e instanceof Error ? e.message : "Internal error"},
            {status: 500}
        );
    }
}
