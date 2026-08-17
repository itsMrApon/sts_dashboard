import type { ServicesResponse, StsSiteClientOptions, WorkspaceProfileResponse } from './types';
export declare function createStsSiteClient(options: StsSiteClientOptions): {
    getProfile: () => Promise<WorkspaceProfileResponse>;
    getServices: (type?: string) => Promise<ServicesResponse>;
};
export type StsSiteClient = ReturnType<typeof createStsSiteClient>;
//# sourceMappingURL=client.d.ts.map