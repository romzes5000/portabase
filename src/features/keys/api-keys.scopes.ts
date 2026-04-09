export type ApiKeyAccessLevel = "read" | "write" | "admin";

/** read → [read]; write → [read, write]; admin → [read, write, admin] */
export function normalizeApiKeyScopes(level: ApiKeyAccessLevel): string[] {
    if (level === "admin") {
        return ["read", "write", "admin"];
    }
    if (level === "write") {
        return ["read", "write"];
    }
    return ["read"];
}
