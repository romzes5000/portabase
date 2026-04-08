import React from "react";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getActiveMember } from "@/lib/auth/auth";

/**
 * Oxem: org admin/owner may access (admin) routes (agents, storages, …), not only
 * global user.role admin/superadmin. Agents remain global in DB; no per-org isolation.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
    const user = await currentUser();

    if (!user) {
        notFound();
    }

    if (user.role === "superadmin" || user.role === "admin") {
        return <>{children}</>;
    }

    const activeMember = await getActiveMember();
    const orgRole = activeMember?.role;
    if (orgRole === "admin" || orgRole === "owner") {
        return <>{children}</>;
    }

    notFound();
}
