import type { ComponentProps } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import { Button } from "../ui/button";
export type ConversationProps = ComponentProps<typeof StickToBottom>;
export declare const Conversation: ({ className, ...props }: ConversationProps) => import("react").JSX.Element;
export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;
export declare const ConversationContent: ({ className, ...props }: ConversationContentProps) => import("react").JSX.Element;
export type ConversationEmptyStateProps = Omit<ComponentProps<"div">, "title"> & {
    title?: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
};
export declare const ConversationEmptyState: ({ className, title, description, icon, children, ...props }: ConversationEmptyStateProps) => import("react").JSX.Element;
export type ConversationScrollButtonProps = ComponentProps<typeof Button>;
export declare const ConversationScrollButton: ({ className, ...props }: ConversationScrollButtonProps) => false | import("react").JSX.Element;
//# sourceMappingURL=conversation.d.ts.map