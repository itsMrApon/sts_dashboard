export type AgentState = null | "thinking" | "listening" | "talking";
type OrbProps = {
    colors?: [string, string];
    colorsRef?: React.RefObject<[string, string]>;
    resizeDebounce?: number;
    seed?: number;
    agentState?: AgentState;
    volumeMode?: "auto" | "manual";
    manualInput?: number;
    manualOutput?: number;
    inputVolumeRef?: React.RefObject<number>;
    outputVolumeRef?: React.RefObject<number>;
    getInputVolume?: () => number;
    getOutputVolume?: () => number;
    className?: string;
};
export declare function Orb({ colors, colorsRef, resizeDebounce, seed, agentState, volumeMode, manualInput, manualOutput, inputVolumeRef, outputVolumeRef, getInputVolume, getOutputVolume, className, }: OrbProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=orb.d.ts.map