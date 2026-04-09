import fs from "node:fs";
import path from "path";

import {env} from "@/env.mjs";

/**
 * Base64 edge key for agent bootstrap (same payload as `generateEdgeKey` in edge_key.ts).
 * Used from MCP / internal code paths without Next.js server action context.
 */
export function buildEdgeKeyBase64(agentId: string): string {
    const keyPath = path.join(env.PRIVATE_PATH ?? "private", "keys/master_key.bin");
    const masterKey = fs.readFileSync(keyPath);
    const edgeKeyData = {
        serverUrl: env.PROJECT_URL,
        agentId,
        masterKeyB64: masterKey.toString("base64"),
    };
    return Buffer.from(JSON.stringify(edgeKeyData), "utf-8").toString("base64");
}
