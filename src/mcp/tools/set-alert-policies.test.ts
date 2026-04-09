import {describe, expect, it} from "vitest";

import {alertPolicyItemSchema} from "@/mcp/tools/set-alert-policies";

describe("alertPolicyItemSchema", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";

    it("accepts notification_channel_id", () => {
        const p = alertPolicyItemSchema.parse({
            notification_channel_id: id,
            enabled: true,
        });
        expect(p.notification_channel_id).toBe(id);
    });

    it("accepts legacy channel_id", () => {
        const p = alertPolicyItemSchema.parse({
            channel_id: id,
        });
        expect(p.channel_id).toBe(id);
    });

    it("rejects when both ids are missing", () => {
        expect(() => alertPolicyItemSchema.parse({enabled: true})).toThrow();
    });
});
