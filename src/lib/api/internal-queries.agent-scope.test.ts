import {describe, expect, it} from "vitest";

import {
    AGENT_MCP_ACCESS_DENIED_MESSAGE,
    assertAgentIdInOrgScopeList,
} from "@/lib/api/internal-queries";

describe("assertAgentIdInOrgScopeList", () => {
    const agentId = "550e8400-e29b-41d4-a716-446655440000";

    it("allows when ids is undefined (no org filter)", () => {
        expect(() => assertAgentIdInOrgScopeList(agentId, undefined)).not.toThrow();
    });

    it("allows when agent id is in ids", () => {
        expect(() => assertAgentIdInOrgScopeList(agentId, [agentId, "other"])).not.toThrow();
    });

    it("throws when ids is empty", () => {
        expect(() => assertAgentIdInOrgScopeList(agentId, [])).toThrow(AGENT_MCP_ACCESS_DENIED_MESSAGE);
    });

    it("throws when agent id not in ids", () => {
        expect(() => assertAgentIdInOrgScopeList(agentId, ["other"])).toThrow(AGENT_MCP_ACCESS_DENIED_MESSAGE);
    });
});
