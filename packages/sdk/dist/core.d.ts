import { type StsBusiness, type StsChatReply, type StsForm, type StsOptions, type StsSessionInfo, type StsSpeakConnection, type StsWizard } from './types.js';
/**
 * Framework-agnostic STS-AI client. One instance per site.
 * Handles the site-key → session exchange and refreshes the session before it expires.
 */
export declare function createSts(options: StsOptions): {
    apiBase: string;
    /** Business name + which services are on. Cached for the session. */
    info(): Promise<StsSessionInfo>;
    chat: {
        send(message: string): Promise<StsChatReply>;
    };
    speak: {
        /** LiveKit credentials for a new call. Use with `livekit-client` (the React hook does this for you). */
        connect(participantName?: string): Promise<StsSpeakConnection>;
    };
    form: {
        schema(): Promise<StsForm>;
        submit(values: Record<string, string>, consent: boolean): Promise<string>;
    };
    wizard: {
        load(slug: string): Promise<StsWizard>;
    };
    business: {
        get(): Promise<StsBusiness>;
    };
};
export type StsClient = ReturnType<typeof createSts>;
