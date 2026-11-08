export type DriveItemHit = {
    id: string;
    createdTime?: string | null;
};

export const DRIVE_NAME_LIST_PARAMS = {
    fields: "files(id, name, createdTime)",
    orderBy: "createdTime",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
} as const;

export function pickOldestDriveItem(items: DriveItemHit[]): DriveItemHit | undefined {
    if (items.length === 0) {
        return undefined;
    }

    return [...items].sort((left, right) => {
        const leftTime = left.createdTime ?? "";
        const rightTime = right.createdTime ?? "";
        if (leftTime !== rightTime) {
            return leftTime < rightTime ? -1 : 1;
        }
        if (left.id === right.id) {
            return 0;
        }
        return left.id < right.id ? -1 : 1;
    })[0];
}

export function oldestIdFromDriveFiles(
    files: Array<{ id?: string | null; createdTime?: string | null }> | undefined
): string | undefined {
    const hits = (files ?? []).filter((file): file is DriveItemHit => Boolean(file.id));
    return pickOldestDriveItem(hits)?.id;
}
