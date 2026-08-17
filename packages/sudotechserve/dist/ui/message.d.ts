import type { ComponentProps, HTMLAttributes } from "react";
import { type VariantProps } from "class-variance-authority";
import { Avatar } from "../ui/avatar";
export type MessageProps = HTMLAttributes<HTMLDivElement> & {
    from: "user" | "assistant";
};
export declare const Message: ({ className, from, ...props }: MessageProps) => import("react").JSX.Element;
declare const messageContentVariants: (props?: ({
    variant?: "flat" | "contained" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export type MessageContentProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof messageContentVariants>;
export declare const MessageContent: ({ children, className, variant, ...props }: MessageContentProps) => import("react").JSX.Element;
export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
    src?: string;
    name?: string;
    /** Drives fallback colors: user = primary, assistant = muted surface */
    from?: "user" | "assistant";
};
export declare const MessageAvatar: ({ src, name, from, className, ...props }: MessageAvatarProps) => import("react").JSX.Element;
export {};
//# sourceMappingURL=message.d.ts.map