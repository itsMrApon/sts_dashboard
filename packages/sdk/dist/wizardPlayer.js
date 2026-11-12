const ACTIVE_ATTR = 'data-sts-active';
const GAP_BETWEEN_STEPS_MS = 600;
function readingTimeMs(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.min(14000, Math.max(2500, words * 380));
}
function findTarget(step) {
    if (!step.target || typeof document === 'undefined')
        return null;
    return document.querySelector(`[data-sts-step="${CSS.escape(step.target)}"]`);
}
/**
 * Plays a tour on the creator's own page: scrolls to `[data-sts-step]` sections, marks the
 * active one with `data-sts-active` (style it however you like) and narrates each step.
 * Steps whose target is missing on this page are skipped, so redesigns don't break the tour.
 */
export function createWizardPlayer(wizard, events = {}) {
    const audio = typeof Audio === 'undefined' ? null : new Audio();
    let runId = 0;
    let muted = false;
    let cancelCurrent = null;
    const playable = wizard.steps.filter((step) => !step.target || findTarget(step));
    function clearActive() {
        document.querySelectorAll(`[${ACTIVE_ATTR}]`).forEach((el) => el.removeAttribute(ACTIVE_ATTR));
    }
    function wait(ms) {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            cancelCurrent = () => {
                clearTimeout(timer);
                resolve();
            };
        });
    }
    function speakWithBrowser(text) {
        if (typeof speechSynthesis === 'undefined')
            return wait(readingTimeMs(text));
        const lang = wizard.language === 'bn' ? 'bn' : 'en';
        const voice = speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith(lang)) ?? null;
        if (lang === 'bn' && !voice)
            return wait(readingTimeMs(text));
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
            if (voice)
                utterance.voice = voice;
            const guard = setTimeout(resolve, readingTimeMs(text) + 4000);
            const done = () => {
                clearTimeout(guard);
                resolve();
            };
            utterance.onend = done;
            utterance.onerror = done;
            cancelCurrent = () => {
                speechSynthesis.cancel();
                done();
            };
            speechSynthesis.speak(utterance);
        });
    }
    function speakWithClip(url) {
        return new Promise((resolve) => {
            if (!audio)
                return resolve(false);
            audio.onended = () => resolve(true);
            audio.onerror = () => resolve(false);
            cancelCurrent = () => {
                audio.pause();
                resolve(true);
            };
            audio.src = url;
            audio.play().catch(() => resolve(false));
        });
    }
    async function narrate(step) {
        if (muted)
            return wait(readingTimeMs(step.narration));
        if (step.audioUrl && (await speakWithClip(step.audioUrl)))
            return;
        return speakWithBrowser(step.narration);
    }
    async function playFrom(index) {
        const id = ++runId;
        for (let i = index; i < playable.length; i += 1) {
            const step = playable[i];
            clearActive();
            const target = findTarget(step);
            if (target) {
                target.setAttribute(ACTIVE_ATTR, 'true');
                const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
            }
            events.onStep?.(step, i);
            events.onSpeakingChange?.(true);
            await narrate(step);
            if (id !== runId)
                return;
            events.onSpeakingChange?.(false);
            await wait(GAP_BETWEEN_STEPS_MS);
            if (id !== runId)
                return;
        }
        clearActive();
        events.onEnd?.();
    }
    return {
        steps: playable,
        /** Call from a click handler (browsers block audio without a user gesture). */
        start(index = 0) {
            if (audio) {
                audio.muted = true;
                void audio.play().catch(() => undefined);
                audio.pause();
                audio.muted = false;
            }
            void playFrom(index);
        },
        stop() {
            runId += 1;
            cancelCurrent?.();
            audio?.pause();
            if (typeof speechSynthesis !== 'undefined')
                speechSynthesis.cancel();
            clearActive();
            events.onSpeakingChange?.(false);
        },
        setMuted(value) {
            muted = value;
        },
    };
}
