"use client";

import {Button} from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {
    createApiKeyAction,
    listApiKeysAction,
    revokeApiKeyAction,
} from "@/features/keys/api-keys.action";
import type {OrganizationWithMembers} from "@/db/schema/03_organization";
import {useCallback, useEffect, useState} from "react";
import {toast} from "sonner";

type KeyRow = {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
};

export function OrganizationApiKeysTab({organization}: {organization: OrganizationWithMembers}) {
    const [name, setName] = useState("");
    const [keys, setKeys] = useState<KeyRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        const res = await listApiKeysAction({organizationId: organization.id});
        if (res?.data?.success) {
            setKeys(res.data.keys as KeyRow[]);
        }
    }, [organization.id]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const handleCreate = async () => {
        if (!name.trim()) {
            toast.error("Enter a name");
            return;
        }
        setLoading(true);
        try {
            const res = await createApiKeyAction({
                organizationId: organization.id,
                name: name.trim(),
            });
            if (res?.validationErrors) {
                toast.error(
                    `Validation: ${JSON.stringify(res.validationErrors)}`,
                );
                return;
            }
            if (res?.data?.success && res.data.plaintext) {
                setNewKeyPlaintext(res.data.plaintext);
                setName("");
                await refresh();
                try {
                    await navigator.clipboard.writeText(res.data.plaintext);
                    toast.success("Copied to clipboard. Also saved in the dialog below.");
                } catch {
                    toast.message("Copy this key from the dialog — clipboard is unavailable.", {
                        description: "Use HTTPS or localhost, or copy manually.",
                    });
                }
            } else if (res?.serverError) {
                toast.error(String(res.serverError));
            } else {
                toast.error("Unexpected response from server — check the browser Network tab for the action.");
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Create key failed");
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (id: string) => {
        const res = await revokeApiKeyAction({
            apiKeyId: id,
            organizationId: organization.id,
        });
        if (res?.data?.success) {
            toast.success("Key revoked");
            await refresh();
        } else if (res?.serverError) {
            toast.error(res.serverError);
        }
    };

    const closeNewKeyDialog = () => {
        setNewKeyPlaintext(null);
    };

    const copyNewKey = async () => {
        if (!newKeyPlaintext) {
            return;
        }
        try {
            await navigator.clipboard.writeText(newKeyPlaintext);
            toast.success("Copied");
        } catch {
            toast.error("Could not copy — select the text manually.");
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-2xl">
            <p className="text-sm text-muted-foreground">
                Read-only access to <code className="text-xs">/api/internal/*</code> for MCP and automation.
                Use <code className="text-xs">Authorization: Bearer &lt;key&gt;</code>.
            </p>
            <p className="text-sm text-muted-foreground">
                The table below shows only a <strong>prefix</strong> so you can tell keys apart. The
                full secret is displayed <strong>once</strong> in a dialog right after you create it
                (we store only a hash). If you lose the key, revoke it and create a new one.
            </p>
            <Dialog open={newKeyPlaintext !== null} onOpenChange={(open) => !open && closeNewKeyDialog()}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Your new API key</DialogTitle>
                        <DialogDescription>
                            Copy it now and store it securely. You will not be able to see the full key again.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative rounded-md border bg-muted/50 p-3">
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
                            {newKeyPlaintext ?? ""}
                        </pre>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => void copyNewKey()}>
                            Copy
                        </Button>
                        <Button type="button" onClick={closeNewKeyDialog}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <div className="flex flex-col gap-2">
                <Label htmlFor="api-key-name">Name</Label>
                <div className="flex gap-2">
                    <Input
                        id="api-key-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Cursor MCP"
                    />
                    <Button type="button" onClick={() => void handleCreate()} disabled={loading}>
                        Create key
                    </Button>
                </div>
            </div>
            <div className="border rounded-md">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b text-left">
                            <th className="p-2">Name</th>
                            <th className="p-2">Prefix</th>
                            <th className="p-2">Scopes</th>
                            <th className="p-2">Last used</th>
                            <th className="p-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {keys.map((k) => (
                            <tr key={k.id} className="border-b">
                                <td className="p-2">{k.name}</td>
                                <td className="p-2 font-mono">{k.keyPrefix}…</td>
                                <td className="p-2">{k.scopes.join(", ")}</td>
                                <td className="p-2">
                                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}
                                </td>
                                <td className="p-2">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        type="button"
                                        onClick={() => void handleRevoke(k.id)}
                                    >
                                        Revoke
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {keys.length === 0 && (
                    <p className="p-4 text-muted-foreground text-sm">No API keys yet.</p>
                )}
            </div>
        </div>
    );
}
