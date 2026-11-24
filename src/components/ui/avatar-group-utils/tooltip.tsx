"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * The small tooltip the avatar group uses, on Radix Tooltip. `side` and `sideOffset` are set on the
 * Tooltip (once for the whole group) and read by its content. The content stays hoverable, so a
 * link inside it (a phone number) can be clicked.
 */

type Placement = Pick<
  React.ComponentProps<typeof TooltipPrimitive.Content>,
  "side" | "sideOffset" | "align" | "alignOffset"
>;

const PlacementContext = React.createContext<Placement>({});

type TooltipProviderProps = {
  children: React.ReactNode;
  /** ms before opening */
  openDelay?: number;
  /** ms during which moving to the next trigger opens it at once */
  closeDelay?: number;
};

function TooltipProvider({ children, openDelay = 0, closeDelay = 0 }: TooltipProviderProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={openDelay} skipDelayDuration={closeDelay}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

type TooltipProps = React.ComponentProps<typeof TooltipPrimitive.Root> &
  Placement & { children: React.ReactNode };

function Tooltip({ side, sideOffset, align, alignOffset, children, ...props }: TooltipProps) {
  return (
    <PlacementContext.Provider value={{ side, sideOffset, align, alignOffset }}>
      <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>
    </PlacementContext.Provider>
  );
}

function TooltipTrigger(props: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  // asChild: the avatar (or whatever is passed) is the trigger, not an extra <button>.
  return <TooltipPrimitive.Trigger asChild {...props} />;
}

type TooltipContentProps = Omit<React.ComponentProps<typeof TooltipPrimitive.Content>, "asChild">;

function TooltipContent({ className, children, ...props }: TooltipContentProps) {
  const placement = React.useContext(PlacementContext);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        collisionPadding={8}
        {...placement}
        {...props}
        asChild
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
          className={cn(
            "z-50 rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md",
            className,
          )}
        >
          {children}
        </motion.div>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type TooltipContentProps,
  type TooltipProps,
};
