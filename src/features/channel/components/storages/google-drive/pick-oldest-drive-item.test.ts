import assert from "node:assert/strict";
import { test } from "node:test";
import {
    DRIVE_NAME_LIST_PARAMS,
    oldestIdFromDriveFiles,
    pickOldestDriveItem,
} from "./pick-oldest-drive-item.ts";

test("pickOldestDriveItem returns the only folder", () => {
    const oldest = pickOldestDriveItem([
        { id: "a", createdTime: "2026-11-06T12:33:28.307Z" },
    ]);
    assert.equal(oldest?.id, "a");
});

test("pickOldestDriveItem prefers earlier createdTime", () => {
    const oldest = pickOldestDriveItem([
        { id: "new", createdTime: "2026-11-08T03:00:22.325Z" },
        { id: "old", createdTime: "2026-11-06T12:33:28.307Z" },
    ]);
    assert.equal(oldest?.id, "old");
});

test("pickOldestDriveItem breaks a createdTime tie on id", () => {
    const oldest = pickOldestDriveItem([
        { id: "z-new", createdTime: "2026-11-06T12:33:28.307Z" },
        { id: "a-old", createdTime: "2026-11-06T12:33:28.307Z" },
    ]);
    assert.equal(oldest?.id, "a-old");
});

test("oldestIdFromDriveFiles ignores entries without id", () => {
    assert.equal(
        oldestIdFromDriveFiles([
            { createdTime: "2026-11-08T03:00:22.325Z" },
            { id: "old", createdTime: "2026-11-06T12:33:28.307Z" },
        ]),
        "old"
    );
});

test("resolve walk follows the oldest backups then the date folder", () => {
    const tree: Record<string, Array<{ id: string; createdTime: string; name: string }>> = {
        portabase: [
            { id: "backups-new", name: "backups", createdTime: "2026-11-08T03:00:22.325Z" },
            { id: "backups-old", name: "backups", createdTime: "2026-11-06T12:33:28.307Z" },
        ],
        "backups-old": [
            { id: "day", name: "2026-11-07", createdTime: "2026-11-07T03:00:27.948Z" },
        ],
        "backups-new": [
            { id: "other-day", name: "2026-11-08", createdTime: "2026-11-08T03:00:27.317Z" },
        ],
        day: [
            { id: "dump", name: "dump.tar.gz.enc", createdTime: "2026-11-07T03:00:37.535Z" },
        ],
    };

    let parent = "portabase";
    for (const part of ["backups", "2026-11-07", "dump.tar.gz.enc"]) {
        const matches = tree[parent].filter((item) => item.name === part);
        const next = oldestIdFromDriveFiles(matches);
        assert.ok(next, `missing ${part} under ${parent}`);
        parent = next;
    }

    assert.equal(parent, "dump");
});

test("Drive list params ask for createdTime and sort by it", () => {
    assert.equal(DRIVE_NAME_LIST_PARAMS.orderBy, "createdTime");
    assert.match(DRIVE_NAME_LIST_PARAMS.fields, /createdTime/);
    assert.equal(DRIVE_NAME_LIST_PARAMS.pageSize, 100);
});
