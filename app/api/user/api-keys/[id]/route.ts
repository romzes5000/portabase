import {auth} from "@/lib/auth/auth";
import {revokeUserApiKey} from "@/features/keys/api-keys.server";
import {headers} from "next/headers";
import {NextResponse} from "next/server";

export async function DELETE(
    _request: Request,
    context: {params: Promise<{id: string}>}
) {
    const session = await auth.api.getSession({headers: await headers()});
    if (!session) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    const {id} = await context.params;
    const result = await revokeUserApiKey(session.user.id, id);
    if ("error" in result) {
        const status = result.error.startsWith("Forbidden") ? 403 : 404;
        return NextResponse.json({error: result.error}, {status});
    }
    return NextResponse.json({success: true as const});
}
