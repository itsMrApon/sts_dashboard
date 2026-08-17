import type { StsAiClient } from '../client';
type Props = {
    roomName: string;
    agentName: string;
    businessName: string;
    firstMessage: string;
    socialAccounts: {
        platform: string;
        label: string;
        url?: string;
    }[];
    /** STS-AI embed API client (site key + CORS). */
    embedClient: StsAiClient;
    /** Compact card layout (same as `?embed=1`) — use when embedding on e.g. Home. */
    embedMode?: boolean;
    /** Initial tab when the widget mounts (`?tab=` in URL still overrides on load). */
    defaultTab?: 'chat' | 'voice' | 'mobile';
};
export declare const ChatClient: ({ roomName, agentName, businessName, firstMessage, socialAccounts, embedClient, embedMode, defaultTab, }: Props) => import("react").JSX.Element;
export {};
//# sourceMappingURL=ChatClient.d.ts.map