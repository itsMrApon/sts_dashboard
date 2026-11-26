'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createSts } from './core.js';
import { createWizardPlayer } from './wizardPlayer.js';
import { StsError, } from './types.js';
const StsContext = createContext(null);
/** Wrap your site once. Every hook below talks to your STS-AI business through this client. */
export function StsProvider({ apiBase, siteKey, children }) {
    const client = useMemo(() => createSts({ apiBase, siteKey }), [apiBase, siteKey]);
    return _jsx(StsContext.Provider, { value: client, children: children });
}
export function useSts() {
    const client = useContext(StsContext);
    if (!client)
        throw new Error('Wrap your app in <StsProvider apiBase siteKey>');
    return client;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : 'Something went wrong';
}
/** Business name + which services are turned on. */
export function useStsInfo() {
    const client = useSts();
    const [info, setInfo] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        let active = true;
        client
            .info()
            .then((value) => active && setInfo(value))
            .catch((err) => active && setError(errorMessage(err)));
        return () => {
            active = false;
        };
    }, [client]);
    return { info, error };
}
export function useStsChat() {
    const client = useSts();
    const { info, error: infoError } = useStsInfo();
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const counter = useRef(0);
    const nextId = () => `m${(counter.current += 1)}`;
    const send = useCallback(async (text) => {
        const message = text.trim();
        if (!message || status === 'thinking')
            return;
        setMessages((current) => [...current, { id: nextId(), role: 'user', content: message }]);
        setStatus('thinking');
        setError(null);
        try {
            const result = await client.chat.send(message);
            setMessages((current) => [...current, { id: nextId(), role: 'assistant', content: result.reply, links: result.links }]);
            setStatus('idle');
        }
        catch (err) {
            setError(errorMessage(err));
            setStatus('error');
        }
    }, [client, status]);
    /**
     * Sends a file the assistant asked for to the business, then tells the assistant it arrived.
     * Wire it to your attach button's file input (accept="application/pdf,image/*").
     */
    const attach = useCallback(async (file, documentId) => {
        if (status === 'thinking')
            return;
        setStatus('thinking');
        setError(null);
        try {
            const uploaded = await client.chat.attach(file, documentId);
            setStatus('idle');
            await send(uploaded.message);
        }
        catch (err) {
            setError(errorMessage(err));
            setStatus('error');
        }
    }, [client, send, status]);
    const chat = info?.services.chat ?? null;
    return {
        /** false when Chat AI is off in the dashboard. */
        available: Boolean(chat),
        greeting: chat?.greeting ?? '',
        suggestions: chat?.suggestions ?? [],
        maxMessageLength: chat?.maxMessageLength ?? 1000,
        /** Documents the assistant may ask for; show your attach button when this is not empty. */
        documentRequests: chat?.documentRequests ?? [],
        messages,
        send,
        attach,
        reset: () => setMessages([]),
        status,
        error: error ?? infoError,
    };
}
const MAX_CAPTIONS = 20;
const LEVEL_INTERVAL_MS = 100;
/**
 * Voice call over WebRTC (LiveKit is included in this package). Headless like the
 * chat: your designer builds the call button, mute button, captions and any animation.
 */
export function useStsSpeak() {
    const client = useSts();
    const [state, setState] = useState('idle');
    const [isAgentSpeaking, setAgentSpeaking] = useState(false);
    const [muted, setMutedState] = useState(false);
    const [captions, setCaptions] = useState([]);
    /** The AI's voice loudness, 0 to 1, about ten times a second: drive an orb or bars with it. */
    const [agentLevel, setAgentLevel] = useState(0);
    const [error, setError] = useState(null);
    const roomRef = useRef(null);
    const timerRef = useRef(null);
    const levelTimerRef = useRef(null);
    const audioEls = useRef([]);
    const stop = useCallback(async () => {
        if (timerRef.current)
            clearTimeout(timerRef.current);
        if (levelTimerRef.current)
            clearInterval(levelTimerRef.current);
        timerRef.current = null;
        levelTimerRef.current = null;
        const room = roomRef.current;
        roomRef.current = null;
        audioEls.current.forEach((el) => el.remove());
        audioEls.current = [];
        setAgentSpeaking(false);
        setAgentLevel(0);
        setMutedState(false);
        if (room)
            await room.disconnect();
        setState((current) => (current === 'error' ? current : 'ended'));
    }, []);
    /** Mutes or unmutes the visitor's microphone during a call. */
    const setMuted = useCallback(async (value) => {
        const room = roomRef.current;
        if (!room)
            return;
        await room.localParticipant.setMicrophoneEnabled(!value);
        setMutedState(value);
    }, []);
    const upsertCaption = useCallback((caption) => {
        setCaptions((current) => {
            const index = current.findIndex((item) => item.id === caption.id);
            const next = index >= 0 ? current.map((item, i) => (i === index ? caption : item)) : [...current, caption];
            return next.slice(-MAX_CAPTIONS);
        });
    }, []);
    const start = useCallback(async (participantName) => {
        if (roomRef.current)
            return;
        setState('connecting');
        setError(null);
        setCaptions([]);
        try {
            const [{ Room, RoomEvent, Track }, details] = await Promise.all([
                import('livekit-client'),
                client.speak.connect(participantName),
            ]);
            const room = new Room();
            room.on(RoomEvent.TrackSubscribed, (track) => {
                if (track.kind !== Track.Kind.Audio)
                    return;
                const element = track.attach();
                element.style.display = 'none';
                document.body.appendChild(element);
                audioEls.current.push(element);
            });
            room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
                setAgentSpeaking(speakers.some((speaker) => speaker.identity !== room.localParticipant.identity));
            });
            room.on(RoomEvent.Disconnected, () => void stop());
            // The voice agent publishes what both sides say on the "lk.transcription" text stream.
            room.registerTextStreamHandler('lk.transcription', async (reader, participant) => {
                const attributes = reader.info.attributes ?? {};
                const id = attributes['lk.segment_id'] || reader.info.id;
                const speaker = participant.identity === room.localParticipant.identity ? 'visitor' : 'agent';
                let text = '';
                for await (const chunk of reader) {
                    text += chunk;
                    upsertCaption({ id, speaker, text, final: false });
                }
                upsertCaption({ id, speaker, text, final: true });
            });
            await room.connect(details.serverUrl, details.participantToken);
            await room.localParticipant.setMicrophoneEnabled(true);
            roomRef.current = room;
            levelTimerRef.current = setInterval(() => {
                const agent = [...room.remoteParticipants.values()][0];
                setAgentLevel(agent ? Math.min(1, agent.audioLevel) : 0);
            }, LEVEL_INTERVAL_MS);
            setState('live');
            timerRef.current = setTimeout(() => void stop(), details.maxCallMinutes * 60000);
        }
        catch (err) {
            setError(errorMessage(err));
            setState('error');
            await stop();
        }
    }, [client, stop, upsertCaption]);
    useEffect(() => () => void stop(), [stop]);
    return { state, start, stop, isAgentSpeaking, muted, setMuted, captions, agentLevel, error };
}
// ── Form ───────────────────────────────────────────────────────────────────
export function useStsForm() {
    const client = useSts();
    const [form, setForm] = useState(null);
    const [values, setValues] = useState({});
    const [consent, setConsent] = useState(false);
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState(null);
    const [fieldError, setFieldError] = useState(null);
    useEffect(() => {
        let active = true;
        client.form
            .schema()
            .then((schema) => {
            if (!active)
                return;
            setForm(schema);
            setStatus('ready');
        })
            .catch((err) => {
            if (!active)
                return;
            setStatus(err instanceof StsError && err.code === 'SERVICE_DISABLED' ? 'unavailable' : 'error');
            setMessage(errorMessage(err));
        });
        return () => {
            active = false;
        };
    }, [client]);
    const setValue = useCallback((fieldId, value) => {
        setValues((current) => ({ ...current, [fieldId]: value }));
    }, []);
    const submit = useCallback(async () => {
        setStatus('submitting');
        setFieldError(null);
        try {
            setMessage(await client.form.submit(values, consent));
            setStatus('success');
            setValues({});
            setConsent(false);
        }
        catch (err) {
            setMessage(errorMessage(err));
            setFieldError(err instanceof StsError ? err.fieldId : null);
            setStatus('error');
        }
    }, [client, consent, values]);
    return { form, values, setValue, consent, setConsent, submit, status, message, fieldError };
}
// ── Wizard ─────────────────────────────────────────────────────────────────
/**
 * Voice tour across your own page. Tag sections with `data-sts-step="…"`; style `[data-sts-active]`.
 * Each business has one wizard, so `slug` is optional.
 */
export function useStsWizard(slug) {
    const client = useSts();
    const [wizard, setWizard] = useState(null);
    const [error, setError] = useState(null);
    const [playing, setPlaying] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [step, setStep] = useState(null);
    const [stepIndex, setStepIndex] = useState(-1);
    const [muted, setMutedState] = useState(false);
    const playerRef = useRef(null);
    useEffect(() => {
        let active = true;
        const resolveSlug = slug
            ? Promise.resolve(slug)
            : client.info().then((info) => {
                const first = info.services.wizards[0]?.slug;
                if (!first)
                    throw new Error('No published wizard for this business');
                return first;
            });
        resolveSlug
            .then((wizardSlug) => client.wizard.load(wizardSlug))
            .then((value) => active && setWizard(value))
            .catch((err) => active && setError(errorMessage(err)));
        return () => {
            active = false;
            playerRef.current?.stop();
        };
    }, [client, slug]);
    const makePlayer = useCallback(() => {
        if (!wizard)
            return null;
        playerRef.current?.stop();
        const player = createWizardPlayer(wizard, {
            onStep: (current, index) => {
                setStep(current);
                setStepIndex(index);
            },
            onSpeakingChange: setSpeaking,
            onEnd: () => setPlaying(false),
        });
        player.setMuted(muted);
        playerRef.current = player;
        setPlaying(true);
        return player;
    }, [muted, wizard]);
    /** The tour leads: scrolls to each section and narrates it. Call from a click handler. */
    const start = useCallback(() => {
        makePlayer()?.start();
    }, [makePlayer]);
    /**
     * The visitor leads: each section speaks when they scroll to it. Call from your "Start" or
     * "Sound on" button the first time. Call again after a client-side page change.
     */
    const follow = useCallback(() => {
        const player = playerRef.current ?? makePlayer();
        player?.follow();
    }, [makePlayer]);
    /** The visitor's last answer to "sound on or off", remembered per tour in this browser. */
    const savedSound = useCallback(() => {
        if (!wizard || typeof localStorage === 'undefined')
            return null;
        try {
            const value = localStorage.getItem(`sts-tour-sound:${wizard.slug}`);
            return value === 'on' || value === 'off' ? value : null;
        }
        catch {
            return null;
        }
    }, [wizard]);
    const rememberSound = useCallback((choice) => {
        if (!wizard || typeof localStorage === 'undefined')
            return;
        try {
            localStorage.setItem(`sts-tour-sound:${wizard.slug}`, choice);
        }
        catch {
            // Private windows can refuse storage; the visitor is simply asked again next time.
        }
    }, [wizard]);
    const stop = useCallback(() => {
        playerRef.current?.stop();
        setPlaying(false);
    }, []);
    /**
     * Plays one step from your own event (by id or `data-sts-step` name), e.g.
     * `window.addEventListener('pricing-open', () => tour.play('pricing'))`. Needs one click on the
     * page first for sound (any start/follow, or `unlock()`).
     */
    const play = useCallback((stepName) => {
        const player = playerRef.current ?? makePlayer();
        return player?.play(stepName) ?? false;
    }, [makePlayer]);
    /** Call from any click so later `play()` calls can make sound. */
    const unlock = useCallback(() => {
        const player = playerRef.current ?? makePlayer();
        player?.unlock();
    }, [makePlayer]);
    const setMuted = useCallback((value) => {
        setMutedState(value);
        playerRef.current?.setMuted(value);
    }, []);
    return {
        wizard,
        ready: Boolean(wizard),
        start,
        follow,
        savedSound,
        rememberSound,
        stop,
        play,
        unlock,
        playing,
        speaking,
        step,
        stepIndex,
        caption: step?.narration ?? '',
        muted,
        setMuted,
        error,
    };
}
// ── Business details ───────────────────────────────────────────────────────
export function useStsBusiness() {
    const client = useSts();
    const [business, setBusiness] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        let active = true;
        client.business
            .get()
            .then((value) => active && setBusiness(value))
            .catch((err) => active && setError(errorMessage(err)));
        return () => {
            active = false;
        };
    }, [client]);
    return { business, error };
}
/**
 * The business's own answers to the questions customers ask most, for an FAQ block your
 * designer styles. Pair each with `useStsChat().send(question)` for an "Ask more" button.
 */
export function useStsAnswers() {
    const client = useSts();
    const [answers, setAnswers] = useState([]);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        let active = true;
        client.business
            .answers()
            .then((value) => active && setAnswers(value))
            .catch((err) => active && setError(errorMessage(err)))
            .finally(() => active && setReady(true));
        return () => {
            active = false;
        };
    }, [client]);
    return { answers, ready, error };
}
/** Reviews the business chose to show, for a reviews block your designer styles. */
export function useStsReviews() {
    const client = useSts();
    const [reviews, setReviews] = useState([]);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        let active = true;
        client.business
            .reviews()
            .then((value) => active && setReviews(value))
            .catch((err) => active && setError(errorMessage(err)))
            .finally(() => active && setReady(true));
        return () => {
            active = false;
        };
    }, [client]);
    return { reviews, ready, error };
}
