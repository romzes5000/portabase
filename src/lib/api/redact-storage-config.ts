/**
 * Masks credential-like keys in storage channel JSON (S3/Yandex/MinIO).
 * Mirrors portabase-mcp redactStorageConfig logic.
 */
export function redactStorageConfig(raw: unknown): Record<string, unknown> {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
        return {};
    }
    const obj = raw as Record<string, unknown>;
    const out: Record<string, unknown> = {...obj};
    const redactNested = (m: Record<string, unknown>) => {
        for (const k of Object.keys(m)) {
            if (storageConfigKeySensitive(k)) {
                m[k] = "[redacted]";
                continue;
            }
            const v = m[k];
            if (v && typeof v === "object" && !Array.isArray(v)) {
                redactNested(v as Record<string, unknown>);
            }
        }
    };
    redactNested(out);
    return out;
}

function storageConfigKeySensitive(k: string): boolean {
    const lk = k.trim().toLowerCase();
    if (!lk) return false;
    const subs = [
        "secret",
        "password",
        "token",
        "apikey",
        "privatekey",
        "accesskey",
        "secretkey",
        "access_key",
        "secret_key",
        "secretaccesskey",
        "accesskeyid",
    ];
    for (const s of subs) {
        if (lk.includes(s)) return true;
    }
    if (lk.includes("access") && lk.includes("key")) return true;
    return false;
}
