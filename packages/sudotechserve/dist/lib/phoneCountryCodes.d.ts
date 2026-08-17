/**
 * E.164 calling codes by ISO 3166-1 alpha-2 (main territory per country).
 * Territories sharing a code (e.g. US/CA +1) list the same dial; user picks country for display.
 */
export declare const DIAL_BY_ISO2: Record<string, string>;
export declare function countryLabel(iso2: string): string;
/** ISO2 codes sorted by localized country name for UI */
export declare const SORTED_ISO2: string[];
export declare function dialForIso2(iso2: string): string;
//# sourceMappingURL=phoneCountryCodes.d.ts.map