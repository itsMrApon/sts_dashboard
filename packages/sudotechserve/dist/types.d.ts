import type { ReactNode } from 'react';
export type EmbedBootstrap = {
    roomName: string;
    agentName: string;
    businessName: string;
    firstMessage: string;
    socialAccounts: {
        platform: string;
        label: string;
        url?: string;
    }[];
    ctaLinks: {
        roomJoinLink: string | null;
        buyNowLink: string | null;
        productLinks: {
            name: string;
            url: string;
            buyUrl?: string;
        }[];
        voiceAgentLinks: {
            name: string;
            url: string;
        }[];
    };
    tabs: {
        chat: boolean;
        voice: boolean;
        mobile: boolean;
    };
    api: {
        chat: string;
        voice: string;
        mobile: string;
        bootstrap: string;
    };
};
export type ChatReply = {
    reply: string;
    roomJoinLink?: string | null;
    buyNowLink?: string | null;
    productLinks?: {
        name: string;
        url: string;
        buyUrl?: string;
    }[];
    voiceAgentLinks?: {
        name: string;
        url: string;
    }[];
    socialAccounts?: {
        platform: string;
        label: string;
        url?: string;
    }[];
    error?: string;
    code?: string;
};
export type StsAiClientOptions = {
    apiBase: string;
    siteKey: string;
    roomName: string;
};
export type StsAiRoomProps = {
    apiBase: string;
    siteKey: string;
    roomName: string;
    embedMode?: boolean;
    defaultTab?: 'chat' | 'voice' | 'mobile';
    className?: string;
    loadingFallback?: ReactNode;
    onReady?: () => void;
};
export type LiveKitConnectionDetails = {
    serverUrl: string;
    roomName: string;
    participantName: string;
    participantToken: string;
};
//# sourceMappingURL=types.d.ts.map