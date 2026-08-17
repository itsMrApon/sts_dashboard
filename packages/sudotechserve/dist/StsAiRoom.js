'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { createStsAiClient } from './client';
export function StsAiRoom({ apiBase, siteKey, roomName, embedMode = true, defaultTab = 'voice', className, loadingFallback, onReady, }) {
    const client = useMemo(() => createStsAiClient({ apiBase, siteKey, roomName }), [apiBase, siteKey, roomName]);
    const [bootstrap, setBootstrap] = useState(null);
    const [ChatClient, setChatClient] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    useEffect(() => {
        let cancelled = false;
        void Promise.all([
            client.bootstrap(),
            import('./room/ChatClient'),
        ])
            .then(([data, mod]) => {
            if (cancelled)
                return;
            setBootstrap(data);
            setChatClient(() => mod.ChatClient);
        })
            .catch((err) => {
            if (!cancelled) {
                setLoadError(err instanceof Error ? err.message : 'Failed to load room');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [client]);
    useEffect(() => {
        if (bootstrap && ChatClient) {
            onReadyRef.current?.();
        }
    }, [bootstrap, ChatClient]);
    if (loadError) {
        return (_jsx("div", { className: `sts-ai-root flex h-full min-h-[480px] items-center justify-center p-6 text-center text-sm text-destructive ${className ?? ''}`.trim(), children: loadError }));
    }
    if (!bootstrap || !ChatClient) {
        const showDefaultMessage = loadingFallback === undefined;
        return (_jsx("div", { className: `sts-ai-root ${showDefaultMessage
                ? 'flex h-full min-h-[480px] items-center justify-center p-6 text-sm text-muted-foreground'
                : 'pointer-events-none min-h-[480px] bg-transparent'} ${className ?? ''}`.trim(), "aria-busy": "true", "aria-hidden": !showDefaultMessage, children: showDefaultMessage ? 'Loading AI room…' : loadingFallback }));
    }
    return (_jsxs("div", { className: `sts-ai-root h-full min-h-[480px] ${className ?? ''}`.trim(), children: [_jsx(Toaster, { position: "top-center", richColors: true, closeButton: true }), _jsx(ChatClient, { embedClient: client, roomName: roomName, agentName: bootstrap.agentName, businessName: bootstrap.businessName, firstMessage: bootstrap.firstMessage, socialAccounts: bootstrap.socialAccounts, embedMode: embedMode, defaultTab: defaultTab })] }));
}
