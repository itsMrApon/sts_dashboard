"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"
import { useSakuga } from "@/components/sakuga/load"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 4,
  side = "top",
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  useSakuga("tooltip")
  // Radix places it and runs the exit (it leaves by shrinking); the bubble itself is the Sakuga tooltip,
  // which pops out of the side facing its trigger.
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        side={side}
        sideOffset={sideOffset}
        className={cn(
          "data-[state=closed]:animate-out data-[state=closed]:zoom-out-50 data-[state=closed]:fade-out-0 z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) text-balance",
          className
        )}
        {...props}
      >
        <sakuga-tooltip side={side}>{children}</sakuga-tooltip>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
