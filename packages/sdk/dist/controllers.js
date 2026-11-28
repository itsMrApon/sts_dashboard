/**
 * Framework-free controllers for each service. They hold the state (messages, call state,
 * form values) and tell you when it changes, so any UI can use them: React and Vue wrap them,
 * and plain JavaScript can call them straight from `window.addEventListener`.
 *
 *   const chat = createChat(sts)
 *   chat.subscribe((state) => render(state.messages))
 *   await chat.send('Hi!')
 */
import { StsError } from './types.js';
/** A tiny observable value: `get()`, `subscribe(fn)` (called now and on every change). */
function store(initial) {
    let state = initial;
    const listeners = new Set();
    return {
        get: () => state,
        set(patch) {
            const next = typeof patch === 'function' ? patch(state) : patch;
            state = { ...state, ...next };
            listeners.forEach((listener) => listener(state));
        },
        subscribe(listener) {
            listeners.add(listener);
            listener(state);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
const errorMessage = (error) => (error instanceof Error ? error.message : 'Something went wrong');
/** Chat AI as a service: your floating button, pop-up or page draws it; this keeps the conversation. */
export function createChat(sts) {
    const state = store({ messages: [], status: 'idle', error: null });
    let counter = 0;
    const nextId = () => `m${(counter += 1)}`;
    async function send(text) {
        const message = text.trim();
        if (!message || state.get().status === 'thinking')
            return;
        state.set((s) => ({ messages: [...s.messages, { id: nextId(), role: 'user', content: message }], status: 'thinking', error: null }));
        try {
            const result = await sts.chat.send(message);
            state.set((s) => ({
                messages: [...s.messages, { id: nextId(), role: 'assistant', content: result.reply, links: result.links }],
                status: 'idle',
            }));
        }
        catch (error) {
            state.set({ status: 'error', error: errorMessage(error) });
        }
    }
    /** Sends a file the assistant asked for (Drive), then tells the assistant it arrived. */
    async function attach(file, documentId) {
        if (state.get().status === 'thinking')
            return;
        state.set({ status: 'thinking', error: null });
        try {
            const uploaded = await sts.chat.attach(file, documentId);
            state.set({ status: 'idle' });
            await send(uploaded.message);
        }
        catch (error) {
            state.set({ status: 'error', error: errorMessage(error) });
        }
    }
    return {
        get state() {
            return state.get();
        },
        subscribe: state.subscribe,
        send,
        attach,
        reset: () => state.set({ messages: [], status: 'idle', error: null }),
    };
}
const MAX_CAPTIONS = 20;
const LEVEL_INTERVAL_MS = 100;
/** A plain reason the visitor can act on when the browser won't give the call a microphone. */
function micErrorMessage(error) {
    // No mediaDevices at all: the page isn't secure (http on a real domain), so no browser offers a mic.
    if (typeof navigator !== 'undefined' && !navigator.mediaDevices)
        return 'The microphone needs a secure (https) page.';
    // DOMException isn't an Error subclass in every browser, so read the name directly.
    const raw = error && typeof error === 'object' ? error.name : undefined;
    const name = typeof raw === 'string' ? raw : '';
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
        return 'Microphone is blocked. Allow it for this site (the icon in the address bar), then try again.';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError')
        return 'No microphone was found.';
    if (name === 'NotReadableError' || name === 'AbortError')
        return 'The microphone is busy in another app.';
    return errorMessage(error);
}
/**
 * Voice AI as a service: a real-time call with the business's AI over WebRTC (LiveKit is
 * included). Your orb, call button and captions are yours; call `start()` from a click.
 */
export function createVoice(sts) {
    const state = store({ state: 'idle', isAgentSpeaking: false, muted: false, captions: [], agentLevel: 0, error: null });
    let room = null;
    let callTimer = null;
    let levelTimer = null;
    let audioEls = [];
    /** Bumped by every start and stop, so a hang-up cancels a call that is still connecting. */
    let attempt = 0;
    function upsertCaption(caption) {
        state.set((s) => {
            const index = s.captions.findIndex((item) => item.id === caption.id);
            const next = index >= 0 ? s.captions.map((item, i) => (i === index ? caption : item)) : [...s.captions, caption];
            return { captions: next.slice(-MAX_CAPTIONS) };
        });
    }
    async function stop() {
        attempt++;
        if (callTimer)
            clearTimeout(callTimer);
        if (levelTimer)
            clearInterval(levelTimer);
        callTimer = null;
        levelTimer = null;
        const current = room;
        room = null;
        audioEls.forEach((el) => el.remove());
        audioEls = [];
        state.set((s) => ({ isAgentSpeaking: false, agentLevel: 0, muted: false, state: s.state === 'error' ? 'error' : 'ended' }));
        if (current)
            await current.disconnect();
    }
    async function start(participantName) {
        if (room || state.get().state === 'connecting')
            return;
        const current = ++attempt;
        const cancelled = () => current !== attempt;
        state.set({ state: 'connecting', error: null, captions: [], muted: false });
        let next = null;
        let mic = null;
        // This attempt's agent audio: only handed to the call once it is live, removed otherwise.
        const attemptAudio = [];
        try {
            const livekit = await import('livekit-client');
            // Hung up while livekit-client loaded: don't ask for the mic at all.
            if (cancelled())
                return;
            const { Room, RoomEvent, Track } = livekit;
            // The microphone comes first: when it is blocked, no call room is opened and no agent is
            // sent into one to wait for a visitor who can't be heard.
            mic = await livekit.createLocalAudioTrack().catch((error) => {
                throw new Error(micErrorMessage(error));
            });
            if (cancelled())
                return void mic.stop();
            const details = await sts.speak.connect(participantName);
            if (cancelled())
                return void mic.stop();
            const joining = new Room();
            next = joining;
            // A cancelled attempt's room must not play audio or write captions into a newer call.
            joining.on(RoomEvent.TrackSubscribed, (track) => {
                if (cancelled() || track.kind !== Track.Kind.Audio)
                    return;
                const element = track.attach();
                element.style.display = 'none';
                document.body.appendChild(element);
                attemptAudio.push(element);
            });
            joining.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
                if (cancelled())
                    return;
                state.set({ isAgentSpeaking: speakers.some((speaker) => speaker.identity !== joining.localParticipant.identity) });
            });
            // Only the live call ends the call: a room dropped while cancelling must not stop a newer one.
            joining.on(RoomEvent.Disconnected, () => {
                if (room === joining)
                    void stop();
            });
            // The voice agent publishes what both sides say on the "lk.transcription" text stream.
            joining.registerTextStreamHandler('lk.transcription', async (reader, participant) => {
                const attributes = reader.info.attributes ?? {};
                const id = attributes['lk.segment_id'] || reader.info.id;
                const speaker = participant.identity === joining.localParticipant.identity ? 'visitor' : 'agent';
                let text = '';
                for await (const chunk of reader) {
                    if (cancelled())
                        return;
                    text += chunk;
                    upsertCaption({ id, speaker, text, final: false });
                }
                if (cancelled())
                    return;
                upsertCaption({ id, speaker, text, final: true });
            });
            await joining.connect(details.serverUrl, details.participantToken);
            if (cancelled())
                throw new Error('cancelled');
            await joining.localParticipant.publishTrack(mic);
            if (cancelled())
                throw new Error('cancelled');
            room = joining;
            // Same array: audio the agent publishes later in the call lands here too, and stop() clears it.
            audioEls = attemptAudio;
            levelTimer = setInterval(() => {
                const agent = [...joining.remoteParticipants.values()][0];
                state.set({ agentLevel: agent ? Math.min(1, agent.audioLevel) : 0 });
            }, LEVEL_INTERVAL_MS);
            state.set({ state: 'live' });
            callTimer = setTimeout(() => void stop(), details.maxCallMinutes * 60000);
        }
        catch (error) {
            // Never leave a half-joined room behind (disconnecting also stops a published mic).
            mic?.stop();
            attemptAudio.forEach((el) => el.remove());
            if (next && room !== next)
                await next.disconnect().catch(() => undefined);
            if (cancelled())
                return;
            state.set({ state: 'error', error: errorMessage(error) });
            await stop();
        }
    }
    /** Mutes or unmutes the visitor's microphone during a call. */
    async function setMuted(value) {
        if (!room)
            return;
        await room.localParticipant.setMicrophoneEnabled(!value);
        state.set({ muted: value });
    }
    return {
        get state() {
            return state.get();
        },
        subscribe: state.subscribe,
        start,
        stop,
        setMuted,
    };
}
/** The business's form as a service: your fields and layout, its questions and its inbox. */
export function createForm(sts) {
    const state = store({ form: null, values: {}, consent: false, status: 'loading', message: null, fieldError: null });
    void sts.form
        .schema()
        .then((form) => state.set({ form, status: 'ready' }))
        .catch((error) => state.set({
        status: error instanceof StsError && error.code === 'SERVICE_DISABLED' ? 'unavailable' : 'error',
        message: errorMessage(error),
    }));
    async function submit() {
        const { values, consent } = state.get();
        state.set({ status: 'submitting', fieldError: null });
        try {
            const message = await sts.form.submit(values, consent);
            state.set({ status: 'success', message, values: {}, consent: false });
        }
        catch (error) {
            state.set({ status: 'error', message: errorMessage(error), fieldError: error instanceof StsError ? error.fieldId : null });
        }
    }
    return {
        get state() {
            return state.get();
        },
        subscribe: state.subscribe,
        setValue: (fieldId, value) => state.set((s) => ({ values: { ...s.values, [fieldId]: value } })),
        setConsent: (consent) => state.set({ consent }),
        submit,
    };
}
