import {auth} from "@/lib/auth/auth";
import {
    createUserApiKey,
    listUserApiKeys,
} from "@/features/keys/api-keys.server";
import {headers} from "next/headers";
import {NextResponse} from "next/server";
import {z} from "zod";

const createBody = z.object({
    name: z.string().min(1).max(128),
    access: z.enum(["read", "write", "admin"]).default("read"),
});

export async function GET() {
    const session = await auth.api.getSession({headers: await headers()});
    if (!session) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    const keys = await listUserApiKeys(session.user.id);
    return NextResponse.json({
        success: true as const,
        keys: keys.map((k) => ({
            id: k.id,
            name: k.name,
            keyPrefix: k.keyPrefix,
            scopes: k.scopes,
            lastUsedAt: k.lastUsedAt,
            expiresAt: k.expiresAt,
            createdAt: k.createdAt,
        })),
    });
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({headers: await headers()});
    if (!session) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({error: "Invalid JSON"}, {status: 400});
    }
    const parsed = createBody.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({error: "Validation failed", issues: parsed.error.flatten()}, {status: 400});
    }
    const result = await createUserApiKey(session.user.id, parsed.data);
    if ("error" in result) {
        return NextResponse.json({error: result.error}, {status: 400});
    }
    return NextResponse.json({
        success: true as const,
        id: result.id,
        plaintext: result.plaintext,
        keyPrefix: result.keyPrefix,
    });
}
