import type { ComponentProps, HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../ui/avatar"

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant"
}

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end gap-2 py-2.5",
      from === "user" ? "is-user justify-end" : "is-assistant justify-start",
      className
    )}
    {...props}
  />
)

const messageContentVariants = cva(
  "flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl text-sm leading-relaxed",
  {
    variants: {
      variant: {
        contained: [
          "max-w-[min(80%,28rem)] px-4 py-3",
          "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
          "group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground",
        ],
        flat: [
          "max-w-[min(80%,28rem)] px-4 py-3",
          "group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-md group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
          "group-[.is-assistant]:rounded-2xl group-[.is-assistant]:rounded-bl-md group-[.is-assistant]:bg-muted group-[.is-assistant]:text-foreground",
        ],
      },
    },
    defaultVariants: {
      variant: "contained",
    },
  }
)

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentVariants>

export const MessageContent = ({
  children,
  className,
  variant,
  ...props
}: MessageContentProps) => (
  <div className={cn(messageContentVariants({ variant }), className)} {...props}>
    {children}
  </div>
)

function initialsFromLabel(label?: string): string {
  if (!label?.trim()) return "?"
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return parts[0]!.slice(0, 2).toUpperCase()
}

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src?: string
  name?: string
  /** Drives fallback colors: user = primary, assistant = muted surface */
  from?: "user" | "assistant"
}

export const MessageAvatar = ({
  src,
  name,
  from = "assistant",
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn("size-8 shrink-0 ring-1 ring-border", className)} {...props}>
    {src ? (
      <AvatarImage alt="" className="object-cover" src={src} />
    ) : null}
    <AvatarFallback
      className={cn(
        "text-[11px] font-semibold tracking-tight",
        from === "user"
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      {initialsFromLabel(name)}
    </AvatarFallback>
  </Avatar>
)
