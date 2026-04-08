"use client";

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

/** User-scoped API keys for MCP and /api/internal (read scope). */
export function UserApiKeysTab() {
    const [name, setName] = useState("");
    const [keys, setKeys] = useState<KeyRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
    const [keyToRevoke, setKeyToRevoke] = useState<KeyRow | null>(null);
    const [revoking, setRevoking] = useState(false);

    const refresh = useCallback(async () => {
        const res = await listApiKeysAction({});
        if (res?.data?.success) {
            setKeys(res.data.keys as KeyRow[]);
        }
    }, []);

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
                name: name.trim(),
            });
            if (res?.validationErrors) {
                toast.error(`Validation: ${JSON.stringify(res.validationErrors)}`);
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

    const handleRevoke = async (id: string): Promise<boolean> => {
        const res = await revokeApiKeyAction({
            apiKeyId: id,
        });
        if (res?.data?.success) {
            toast.success("Key revoked");
            await refresh();
            return true;
        }
        if (res?.serverError) {
            toast.error(res.serverError);
        }
        return false;
    };

    const confirmRevoke = async () => {
        if (!keyToRevoke) {
            return;
        }
        setRevoking(true);
        try {
            const ok = await handleRevoke(keyToRevoke.id);
            if (ok) {
                setKeyToRevoke(null);
            }
        } finally {
            setRevoking(false);
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
            <div className="mb-2 space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight">API keys</h2>
                <p className="text-sm text-muted-foreground">
                    Read-only access to <code className="text-xs">/api/internal/*</code> and{" "}
                    <code className="text-xs">/api/mcp</code> for MCP and automation. Keys are tied to your account and
                    reflect organizations you belong to.
                </p>
            </div>
            <p className="text-sm text-muted-foreground">
                Use <code className="text-xs">Authorization: Bearer &lt;key&gt;</code>.
            </p>
            <p className="text-sm text-muted-foreground">
                The table below shows only a <strong>prefix</strong> so you can tell keys apart. The full secret is
                displayed <strong>once</strong> in a dialog right after you create it (we store only a hash). If you lose
                the key, revoke it and create a new one.
            </p>
            <AlertDialog open={keyToRevoke !== null} onOpenChange={(open) => !open && setKeyToRevoke(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will immediately invalidate the key{" "}
                            <span className="font-medium text-foreground">{keyToRevoke?.name}</span> (
                            <span className="font-mono text-xs">{keyToRevoke?.keyPrefix}…</span>). MCP and automation
                            using it will stop working until you create a new key.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button" disabled={revoking}>
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={revoking}
                            onClick={() => void confirmRevoke()}
                        >
                            {revoking ? "Revoking…" : "Revoke key"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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
                <Label htmlFor="user-api-key-name">Name</Label>
                <div className="flex gap-2">
                    <Input
                        id="user-api-key-name"
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
                                        onClick={() => setKeyToRevoke(k)}
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
