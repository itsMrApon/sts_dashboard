import type { ChatReply, EmbedBootstrap, LiveKitConnectionDetails, StsAiClientOptions } from './types';
/** Warm bootstrap while the embed chunk is still downloading. */
export declare function prefetchStsAiBootstrap(options: StsAiClientOptions): void;
export declare function createStsAiClient(options: StsAiClientOptions): {
    bootstrap: () => Promise<EmbedBootstrap>;
    sendChat: (message: string, sessionId: string) => Promise<ChatReply>;
    submitMobileCallback: (payload: {
        name: string;
        countryCode: string;
        phone: string;
        note: string;
        consent: boolean;
    }) => Promise<{
        ok?: boolean;
        error?: string;
        warning?: string;
    }>;
    getLiveKitConnectionDetails: (body: {
        roomName: string;
        participantName: string;
        assistantId?: string;
    }) => Promise<LiveKitConnectionDetails>;
};
export type StsAiClient = ReturnType<typeof createStsAiClient>;
//# sourceMappingURL=client.d.ts.map