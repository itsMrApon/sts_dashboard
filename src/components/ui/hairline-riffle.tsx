"use client";

import {
  forwardRef, useCallback, useEffect, useLayoutEffect, useRef,
  type ComponentPropsWithoutRef, type ForwardRefExoticComponent, type RefAttributes,
} from "react";
import { riffle, type Figure, type HairlineOptions } from "./hairline-riffle-utils/riffle-index";

/**
 * Hairline Riffle — a tray of isometric folders that answers the pointer.
 * The folder under the pointer stands up and lifts; the ones in front lean
 * forward and the ones behind lean back, staggered outwards from it on a
 * 700ms lift curve. Hover or use the arrow keys to pull a folder; Escape puts
 * it back. The stage is a focusable group with an accessible live-region
 * caption naming the folder pulled.
 *
 * Ported from @lucasmarkes/hairline's react.tsx adapter (MIT, © 2026 Lucas
 * Marques), scoped to the Riffle figure only: a component renders one empty
 * `<div>` and mounts the figure on it in a layout effect, so on the server
 * the box is there and the drawing is not. It mounts once: a changed option
 * reaches the running figure through `update`, and `onRead` / `onPick` are
 * read through refs so an inline function never remounts it.
 *
 * sts-ai: `labels` names each folder (front first) and `onPick` hears a click,
 * Enter or Space on the pulled one.
 */

/** The figure's options, plus every `<div>` attribute except `children`. */
export type HairlineProps = HairlineOptions & Omit<ComponentPropsWithoutRef<"div">, "children" | keyof HairlineOptions>;
type HairlineComponent = ForwardRefExoticComponent<HairlineProps & RefAttributes<HTMLDivElement>>;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function make(name: string, mount: (el: HTMLElement, options?: HairlineOptions) => Figure): HairlineComponent {
  const Component = forwardRef<HTMLDivElement, HairlineProps>(function Hairline(props, ref) {
    const { intensity, theme, label, onRead, onPick, labels, play, style, ...attrs } = props;
    /* aria-label stays on the div and is the figure's label too, so the two never disagree about the name */
    const named = label ?? props["aria-label"];

    const el = useRef<HTMLDivElement | null>(null);
    const figure = useRef<Figure | null>(null);
    const read = useRef(onRead);
    const picked = useRef(onPick);
    const set = useCallback((node: HTMLDivElement | null) => {
      el.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }, [ref]);

    useIsoLayoutEffect(() => { read.current = onRead; picked.current = onPick; });

    useIsoLayoutEffect(() => {
      const f = mount(el.current!, {
        intensity, theme, label: named, labels, play,
        onRead: (text) => read.current?.(text),
        onPick: (card) => picked.current?.(card),
      });
      figure.current = f;
      return () => { f.destroy(); figure.current = null; };
      // mounts once; options reach the figure through the effect below
    }, []);

    /* every key is sent, so a prop that was removed goes back to its default */
    useIsoLayoutEffect(() => { figure.current?.update({ intensity, theme, label: named, play }); }, [intensity, theme, named, play]);

    return <div {...attrs} ref={set} style={{ aspectRatio: "5 / 4", ...style }} />;
  });
  Component.displayName = name;
  return Component;
}

/** A tray of folders. The folder under the pointer stands up; the arrow keys walk the folders. `intensity` spreads the ripple further from the pulled folder. */
export const Riffle = make("Riffle", riffle);

export default Riffle;
