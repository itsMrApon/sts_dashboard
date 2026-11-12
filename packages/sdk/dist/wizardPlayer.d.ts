import type { StsWizard, StsWizardStep } from './types.js';
export type WizardPlayerEvents = {
    onStep?: (step: StsWizardStep, index: number) => void;
    onSpeakingChange?: (speaking: boolean) => void;
    onEnd?: () => void;
};
/**
 * Plays a tour on the creator's own page: scrolls to `[data-sts-step]` sections, marks the
 * active one with `data-sts-active` (style it however you like) and narrates each step.
 * Steps whose target is missing on this page are skipped, so redesigns don't break the tour.
 */
export declare function createWizardPlayer(wizard: StsWizard, events?: WizardPlayerEvents): {
    steps: StsWizardStep[];
    /** Call from a click handler (browsers block audio without a user gesture). */
    start(index?: number): void;
    stop(): void;
    setMuted(value: boolean): void;
};
export type WizardPlayer = ReturnType<typeof createWizardPlayer>;
