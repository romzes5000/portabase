import {describe, expect, it} from "vitest";

import {toolErr} from "@/mcp/json";
import {OrgAccessDeniedError, OrgRoleDeniedError} from "@/mcp/org-scope";

function parseText(result: ReturnType<typeof toolErr>): unknown {
    const t = result.content[0];
    if (t?.type !== "text" || typeof t.text !== "string") {
        throw new Error("expected text content");
    }
    return JSON.parse(t.text) as unknown;
}

describe("toolErr", () => {
    it("adds code for OrgAccessDeniedError", () => {
        const r = toolErr("x", new OrgAccessDeniedError("00000000-0000-0000-0000-000000000001"));
        const body = parseText(r) as {code?: string; error?: string};
        expect(body.code).toBe("org_access_denied");
        expect(body.error).toContain("not a member");
    });

    it("adds code for OrgRoleDeniedError", () => {
        const r = toolErr("x", new OrgRoleDeniedError("00000000-0000-0000-0000-000000000002"));
        const body = parseText(r) as {code?: string};
        expect(body.code).toBe("org_role_denied");
    });

    it("omits code for generic errors", () => {
        const r = toolErr("x", new Error("plain"));
        const body = parseText(r) as {code?: string};
        expect(body.code).toBeUndefined();
    });
});
