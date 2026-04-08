"use client";

import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {useEffect, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {MemberWithUser, OrganizationWithMembers} from "@/db/schema/03_organization";
import {NotificationChannel} from "@/db/schema/09_notification-channel";
import {useOrganizationPermissions} from "@/hooks/use-organization-permissions";
import {StorageChannel} from "@/db/schema/12_storage-channel";
import {
    SettingsOrganizationMembersTable
} from "@/components/wrappers/dashboard/organization/settings/settings-organization-members-table";
import {
    OrganizationNotifiersTab
} from "@/components/wrappers/dashboard/organization/tabs/organization-channels-tab/organization-notifiers-tab";
import {
    OrganizationStoragesTab
} from "@/components/wrappers/dashboard/organization/tabs/organization-channels-tab/organization-storages-tab";
import {OrganizationApiKeysTab} from "@/components/wrappers/dashboard/organization/tabs/organization-api-keys-tab";

export type OrganizationTabsProps = {
    organization: OrganizationWithMembers;
    notificationChannels: NotificationChannel[];
    storageChannels: StorageChannel[];
    activeMember: MemberWithUser
};

export const OrganizationTabs = ({activeMember, organization, notificationChannels, storageChannels}: OrganizationTabsProps) => {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [tab, setTab] = useState<string>(() => searchParams.get("tab") ?? "users");

    const {
        canManageUsers,
        canManageNotifications,
        canManageStorages,
        canManageSettings,
    } = useOrganizationPermissions(activeMember);

    const showChannels = canManageNotifications && canManageStorages;
    const showApiKeys = canManageSettings;
    const useTabsLayout = showChannels || showApiKeys;

    useEffect(() => {
        const newTab = searchParams.get("tab") ?? "users";
        setTab(newTab);
    }, [searchParams]);

    const handleChangeTab = (value: string) => {
        router.push(`?tab=${value}`);
    };

    if (!useTabsLayout) {
        return (
            <SettingsOrganizationMembersTable organization={organization}/>
        );
    }

    return (
        <div className="h-full">
            <Tabs className="h-full" value={tab} onValueChange={handleChangeTab}>
                <TabsList className="w-full flex flex-wrap">
                    <TabsTrigger className="flex-1 min-w-[120px]" value="users">
                        Users
                    </TabsTrigger>
                    {showApiKeys && (
                        <TabsTrigger className="flex-1 min-w-[120px]" value="api-keys">
                            API keys
                        </TabsTrigger>
                    )}
                    {showChannels && (
                        <>
                            <TabsTrigger className="flex-1 min-w-[120px]" value="notifications">
                                Notifiers
                            </TabsTrigger>
                            <TabsTrigger className="flex-1 min-w-[120px]" value="storages">
                                Storages
                            </TabsTrigger>
                        </>
                    )}
                </TabsList>
                <TabsContent className="h-full" value="users">
                    <SettingsOrganizationMembersTable organization={organization}/>
                </TabsContent>
                {showApiKeys && (
                    <TabsContent className="h-full" value="api-keys">
                        <OrganizationApiKeysTab organization={organization}/>
                    </TabsContent>
                )}
                {showChannels && (
                    <>
                        <TabsContent className="h-full" value="notifications">
                            <OrganizationNotifiersTab
                                organization={organization}
                                notificationChannels={notificationChannels}
                            />
                        </TabsContent>
                        <TabsContent className="h-full" value="storages">
                            <OrganizationStoragesTab
                                organization={organization}
                                storageChannels={storageChannels}
                            />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
};
