"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback } from "react";
import { ArrowDownIcon } from "lucide-react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
export const Conversation = ({ className, ...props }) => (_jsx(StickToBottom, { className: cn("relative flex-1 overflow-y-auto", className), initial: "smooth", resize: "smooth", role: "log", ...props }));
export const ConversationContent = ({ className, ...props }) => (_jsx(StickToBottom.Content, { className: cn("p-4", className), ...props }));
export const ConversationEmptyState = ({ className, title = "No messages yet", description = "Start a conversation to see messages here", icon, children, ...props }) => (_jsx("div", { className: cn("flex size-full flex-col items-center justify-center gap-3 p-8 text-center", className), ...props, children: children ?? (_jsxs(_Fragment, { children: [icon && _jsx("div", { className: "text-muted-foreground", children: icon }), _jsxs("div", { className: "space-y-1", children: [_jsx("h3", { className: "text-sm font-medium", children: title }), description && (_jsx("p", { className: "text-muted-foreground text-sm", children: description }))] })] })) }));
export const ConversationScrollButton = ({ className, ...props }) => {
    const { isAtBottom, scrollToBottom } = useStickToBottomContext();
    const handleScrollToBottom = useCallback(() => {
        scrollToBottom();
    }, [scrollToBottom]);
    return (!isAtBottom && (_jsx(Button, { className: cn("bg-background dark:bg-background absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full shadow-md", className), onClick: handleScrollToBottom, size: "icon", type: "button", variant: "outline", ...props, children: _jsx(ArrowDownIcon, { className: "size-4" }) })));
};
