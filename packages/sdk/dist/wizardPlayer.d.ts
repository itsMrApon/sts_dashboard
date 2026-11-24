import type { StsWizard, StsWizardStep } from './types.js';
export type WizardPlayerEvents = {
    onStep?: (step: StsWizardStep, index: number) => void;
    onSpeakingChange?: (speaking: boolean) => void;
    onEnd?: () => void;
};
/**
 * Plays a tour on the creator's own page, marking the active `[data-sts-step]` section with
 * `data-sts-active` (style it however you like). Two ways to run it:
 * - `start()`: the tour leads. It scrolls to each section in turn and narrates it.
 * - `follow()`: the visitor leads. Nothing scrolls; each section's step plays once, when the
 *   visitor scrolls it into the middle of the screen. A step with no target plays at the start.
 * Steps whose target is missing on this page are skipped, so one tour can cover many pages.
 */
export declare function createWizardPlayer(wizard: StsWizard, events?: WizardPlayerEvents): {
    readonly steps: StsWizardStep[];
    /** The tour leads. Call from a click handler (browsers block audio without a user gesture). */
    start(index?: number): void;
    /**
     * The visitor leads. Call from a click handler the first time so sound is allowed. Call it
     * again after your site changes page without a reload, to pick up that page's sections.
     */
    follow(): void;
    /** Lets every step play again, for example when the visitor restarts the tour. */
    reset(): void;
    stop(): void;
    setMuted(value: boolean): void;
};
export type WizardPlayer = ReturnType<typeof createWizardPlayer>;
