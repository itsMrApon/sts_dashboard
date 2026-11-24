// Copied from @lucasmarkes/hairline 0.5.1 (MIT, © 2026 Lucas Marques; see ./LICENSE). Riffle only; local changes are marked "sts-ai:".
import { create, type Figure, type HairlineOptions } from "./mount";
import { mount as riffleEngine } from "./figures/riffle";

export type { Figure, HairlineOptions } from "./mount";

/** A tray of folders. The folder under the pointer stands up; the arrow keys walk the folders. `intensity` spreads the ripple further from the pulled folder. */
export function riffle(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "riffle",
    // sts-ai: six folders, and they open
    label: "A tray of six folders. Hover or use the arrow keys to pull one, then click or press Enter to open it.",
    rest: "rest",
    engine: riffleEngine,
    focusable: true,
  }, el, options);
}
