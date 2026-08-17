export type StsSiteClientOptions = {
    apiBase: string;
    workspaceId: string;
    siteKey: string;
};
export type PublicServiceCategory = Record<string, Array<{
    id: number;
    title: string;
    type: string;
    category_id: number;
    description: string;
    details_short: string;
    details_long: string;
    price: string;
    image_1: string | null;
    image_2: string | null;
    image_3: string | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    category: {
        id: number;
        name: string;
        type: string;
        description: string;
        icon: string;
        is_active: boolean;
        sort_order: number;
        created_at: string;
        updated_at: string;
    };
}>>;
export type ServicesResponse = {
    success: boolean;
    workspaceId: string;
    contextVersion: string | null;
    type: string;
    services_by_category: PublicServiceCategory;
    meta: {
        categoryCount: number;
        totalServices: number;
    };
};
export type WorkspaceProfileResponse = {
    success: boolean;
    workspaceId: string;
    workspaceName: string | null;
    contextVersion: string | null;
    publishedAt: string | null;
    vertical: string | null;
    profile: Record<string, unknown>;
};
/** @deprecated use WorkspaceProfileResponse */
export type BusinessProfileResponse = WorkspaceProfileResponse & {
    businessId?: string;
    businessName?: string | null;
    tenantId?: string;
};
export type StsSiteErrorBody = {
    error?: string;
    code?: string;
};
//# sourceMappingURL=types.d.ts.map