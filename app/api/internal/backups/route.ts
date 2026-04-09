import {verifyApiKeyRequest} from "@/lib/api/internal-auth";
import {resolveDatabasePrimaryKeyOrThrow} from "@/lib/api/internal-mutations";
import {internalListBackups} from "@/lib/api/internal-queries";
import {loadOrgScopeForApiKey, OrgAccessDeniedError} from "@/mcp/org-scope";

export async function GET(request: Request) {
    const auth = await verifyApiKeyRequest(request, "read");
    if (!auth.ok) {
        return auth.response;
    }
    const url = new URL(request.url);
    let databaseId = url.searchParams.get("database_id") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
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
        if (databaseId) {
            databaseId = await resolveDatabasePrimaryKeyOrThrow(databaseId);
        }
        const data = await internalListBackups(scope.orgIds, databaseId, status, limit, offset);
        return Response.json({ok: true, data});
    } catch (e) {
        return Response.json(
            {ok: false, error: e instanceof Error ? e.message : "Internal error"},
            {status: 500}
        );
    }
}
