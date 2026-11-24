"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A leads table: pill columns, a staggered entrance, the last action turning into an Open button
 * on hover, and a bar that rises when rows are selected. Adapted from the 21st.dev "leads data
 * table": Size became Position (where the lead is), Probability is driven by a real 0–100 score,
 * and the interest sparkline is gone (there is no history to draw it from). Rows, filters and
 * the bulk actions all come from the caller.
 */

export type LeadSourceTone = "found" | "imported";
export type LeadStatusKey = "new" | "in-progress" | "done";

export interface LeadsTableRow {
  id: string;
  name: string;
  /** Email, company or anything that says who this is. */
  subtitle: string;
  href: string;
  source: { label: string; tone: LeadSourceTone };
  status: LeadStatusKey;
  /** Where the lead is: a neighbourhood and state, a city. */
  position: string | null;
  /** 0–100, from the call score or the playbook fit. */
  score: number | null;
  /** "Added Nov 21", "Follow up Dec 2". */
  lastAction: string;
}

interface LeadsTableProps {
  rows: LeadsTableRow[];
  /** Above the column titles: title, filters, search. */
  toolbar?: ReactNode;
  /** Under the rows: pagination. */
  footer?: ReactNode;
  /** Shown instead of rows when there are none. */
  empty?: ReactNode;
  /** A click on a status pill (cycle it, say). */
  onStatusClick?: (id: string) => void;
  /** Buttons in the selection bar. `clear` empties the selection. */
  selectionActions?: (ids: string[], clear: () => void) => ReactNode;
  className?: string;
}

const STATUS: Record<LeadStatusKey, { label: string; className: string }> = {
  new: {
    label: "NEW",
    className: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/30",
  },
  "in-progress": {
    label: "IN PROGRESS",
    className: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/30",
  },
  done: {
    label: "DONE",
    className: "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30",
  },
};

const SOURCE: Record<LeadSourceTone, string> = {
  found: "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30",
  imported: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30",
};

/** Lead · Source · Status · Position · Fit · Last action. Phones keep Lead and Status. */
const GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-4";

export const leadPillClass = "inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium whitespace-nowrap";

function SourcePill({ source }: { source: LeadsTableRow["source"] }) {
  return (
    <span className={cn(leadPillClass, SOURCE[source.tone])}>
      {source.label.toUpperCase()}
      {source.tone === "imported" ? <span className="ml-1 opacity-60" aria-hidden="true">↗</span> : null}
    </span>
  );
}

function FitPill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground/60 text-xs">—</span>;
  const level = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
  const bars = level === "low" ? 1 : level === "mid" ? 2 : 3;
  const tone = {
    low: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/30",
    mid: "bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/30",
    high: "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30",
  }[level];
  return (
    <span className={cn(leadPillClass, "gap-2", tone)} title={`Fit ${Math.round(score)} of 100`}>
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn("w-1 rounded-full", bar <= bars ? "bg-current" : "bg-current/30")}
            style={{ height: bar === 1 ? 4 : bar === 2 ? 8 : 12 }}
          />
        ))}
      </span>
      <span className="tabular-nums">{Math.round(score)}</span>
    </span>
  );
}

const checkboxClass =
  "size-4 shrink-0 rounded border-muted-foreground/40 accent-muted-foreground bg-background focus:ring-2 focus:ring-muted-foreground/20";

export function LeadsTable({ rows, toolbar, footer, empty, onStatusClick, selectionActions, className }: LeadsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const visibleIds = rows.map((r) => r.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visibleIds.some((id) => selected.has(id)) && !allSelected;
  const clear = () => setSelected(new Set());

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const list: Variants = { visible: { transition: { staggerChildren: reduce ? 0 : 0.04, delayChildren: reduce ? 0 : 0.05 } } };
  const row: Variants = reduce
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 14, scale: 0.98, filter: "blur(4px)" },
        visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { type: "spring", stiffness: 400, damping: 25, mass: 0.7 } },
      };

  return (
    <div className={cn("w-full", className)}>
      <div className="bg-background overflow-hidden rounded-2xl">
        {toolbar ? <div className="border-border/20 border-b px-4 py-3 sm:px-6">{toolbar}</div> : null}

        <div
          className={cn(
            GRID,
            "text-muted-foreground/70 bg-muted/15 border-border/20 hidden border-b px-6 py-3 text-xs font-medium tracking-wide uppercase md:grid",
          )}
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              aria-label="Select all leads on this page"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={(e) => setSelected(e.target.checked ? new Set(visibleIds) : new Set())}
              className={checkboxClass}
            />
            <span>Lead</span>
          </div>
          <div>Source</div>
          <div>Status</div>
          <div>Position</div>
          <div>Fit</div>
          <div>Last action</div>
        </div>

        {rows.length === 0 ? (
          empty
        ) : (
          // Keyed on the page's ids so a new page or filter plays the entrance again.
          <motion.ul key={visibleIds.join("|")} variants={list} initial="hidden" animate="visible">
            {rows.map((lead, index) => {
              const status = STATUS[lead.status];
              const isSelected = selected.has(lead.id);
              return (
                <motion.li key={lead.id} variants={row}>
                  <div
                    className={cn(
                      GRID,
                      "group hover:bg-muted/30 relative px-4 py-2.5 transition-colors sm:px-6",
                      isSelected && "bg-blue-50/50 dark:bg-blue-900/10",
                      index < rows.length - 1 && "border-border/20 border-b",
                    )}
                    onMouseEnter={() => setHovered(lead.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {/* Lead */}
                    <div className="flex min-w-0 items-center gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${lead.name}`}
                        checked={isSelected}
                        onChange={(e) => toggle(lead.id, e.target.checked)}
                        className={checkboxClass}
                      />
                      <Link href={lead.href} className="flex min-w-0 items-center gap-3">
                        <span className="bg-muted/30 border-border/20 flex size-8 shrink-0 items-center justify-center rounded-full border">
                          <span className="text-muted-foreground/80 text-sm font-medium">{lead.name.charAt(0).toUpperCase()}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="text-foreground/90 block truncate font-medium">{lead.name}</span>
                          <span className="text-muted-foreground/70 block truncate text-xs">{lead.subtitle}</span>
                          {/* Phones: where they are and what's next, under the name. */}
                          <span className="text-muted-foreground/70 block truncate text-[11px] md:hidden">
                            {[lead.source.label, lead.position, lead.lastAction].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </Link>
                    </div>

                    {/* Source */}
                    <div className="hidden items-center md:flex">
                      <SourcePill source={lead.source} />
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-self-end md:justify-self-start">
                      <button
                        type="button"
                        onClick={() => onStatusClick?.(lead.id)}
                        disabled={!onStatusClick}
                        title={onStatusClick ? "Change status: new → in progress → done" : undefined}
                        className={cn(leadPillClass, status.className, onStatusClick && "hover:brightness-110")}
                      >
                        {status.label}
                      </button>
                    </div>

                    {/* Position */}
                    <div className="hidden min-w-0 items-center md:flex">
                      <span className="text-foreground/90 truncate text-sm font-semibold">{lead.position ?? "—"}</span>
                    </div>

                    {/* Fit */}
                    <div className="hidden items-center md:flex">
                      <FitPill score={lead.score} />
                    </div>

                    {/* Last action, or Open while hovered */}
                    <div className="hidden items-center md:flex">
                      <AnimatePresence mode="wait" initial={false}>
                        {hovered === lead.id ? (
                          <motion.span
                            key="open"
                            initial={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                          >
                            <Link
                              href={lead.href}
                              className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs font-medium shadow-sm transition-all"
                            >
                              Open
                              <span className="bg-primary/30 h-3 w-px" aria-hidden="true" />
                              <ChevronRight className="size-3" />
                            </Link>
                          </motion.span>
                        ) : (
                          <motion.span
                            key="when"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.05 }}
                            className="text-muted-foreground/70 text-xs"
                          >
                            {lead.lastAction}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        )}

        {footer ? <div className="border-border/20 border-t px-4 py-3 sm:px-6">{footer}</div> : null}
      </div>

      {/* Selection bar: above the app's bottom nav on phones, near the bottom edge on desktop. */}
      <AnimatePresence>
        {selected.size > 0 && selectionActions ? (
          <motion.div
            initial={{ y: 100, opacity: 0, filter: "blur(8px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: 100, opacity: 0, filter: "blur(8px)" }}
            transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
            className="fixed bottom-24 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 sm:bottom-6"
          >
            <div className="bg-background/95 border-border/50 rounded-xl border px-4 py-2 shadow-2xl backdrop-blur-lg">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-foreground/80 text-xs font-medium">
                  {selected.size} selected {selected.size === 1 ? "lead" : "leads"}
                </span>
                <div className="flex flex-wrap items-center gap-2">{selectionActions([...selected], clear)}</div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** A filter in the toolbar, drawn as one of the table's pills with a caret. */
export function LeadsFilterPill({ label, value, active, className }: { label: string; value: string; active?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        leadPillClass,
        "gap-1.5 uppercase tracking-wide",
        active
          ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30"
          : "bg-muted/20 text-muted-foreground border-border/50",
        className,
      )}
    >
      <span className="opacity-70">{label}</span>
      <span className="max-w-[9rem] truncate text-current">{value}</span>
      <ChevronDown className="size-3 opacity-70" aria-hidden="true" />
    </span>
  );
}

export default LeadsTable;
