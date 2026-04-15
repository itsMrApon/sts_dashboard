# Cursor Prompt — Generalized STS-AI Widget (Any Website)

Paste this entire prompt into Cursor Composer (Cmd+Shift+I).

Read the existing codebase before generating anything. Follow established conventions:

- Components in `_components/` inside their page directory
- Server actions in `src/actions/`
- Lib utilities in `src/lib/` with per-service subfolders
- Use `prismaClient` from `src/lib/prismaClient.ts`
- Use `auth()` from `@clerk/nextjs/server`
- Reuse the existing `ENCRYPTION_KEY` and encryption pattern

---

## GOAL

Make the STS-AI widget embeddable on ANY website — not just Saleor stores.
A regular user (no Saleor, no e-commerce platform) should be able to:

1. Sign up on STS-AI
2. Get a widget token
3. Paste one script tag on their website
4. Their visitors immediately get an AI sales/support agent

Platform integrations (Saleor, Shopify) are an optional upgrade on top of this.

---

## ARCHITECTURE

```
Any Website
  └── <script src="https://sts-ai.com/widget.js" data-token="TOKEN">

        ↓ loads iframe from STS-AI

  Widget UI (chat + voice)
        ↓ API calls
  /api/widget/chat  — handles message, returns AI reply
        ↓
  Uses: custom knowledge base + optional platform context
```

---

## 1. Prisma Schema — add to `schema.prisma`

```prisma
model WidgetConfig {
  id               String   @id @default(cuid())
  userId           String   @unique
  token            String   @unique @default(cuid())
  name             String   @default("My Widget")
  isActive         Boolean  @default(true)

  // Appearance
  theme            String   @default("light")     // "light" | "dark"
  position         String   @default("bottom-right")
  primaryColor     String   @default("#6366f1")
  welcomeMessage   String   @default("Hi! How can I help you today?")
  agentName        String   @default("AI Assistant")

  // Behaviour
  voiceEnabled     Boolean  @default(true)
  language         String   @default("en")

  // Custom knowledge (plain text the AI uses to answer questions)
  knowledgeBase    String?  @db.Text

  // Platform integration (optional)
  platformType     String?  // "saleor" | "shopify" | "woocommerce" | null
  platformUrl      String?
  platformToken    String?  // encrypted

  // Stats
  totalChats       Int      @default(0)
  totalLeads       Int      @default(0)

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user             User     @relation(fields: [userId], references: [id])
  conversations    WidgetConversation[]
  leads            WidgetLead[]
}

model WidgetConversation {
  id               String   @id @default(cuid())
  widgetId         String
  visitorId        String   // anonymous fingerprint from browser
  visitorEmail     String?  // collected during chat if user shares
  messages         Json     // array of {role, content, timestamp}
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  widget           WidgetConfig @relation(fields: [widgetId], references: [id])
  leads            WidgetLead[]
}

model WidgetLead {
  id               String   @id @default(cuid())
  widgetId         String
  conversationId   String
  email            String?
  name             String?
  phone            String?
  note             String?  // what they were asking about
  createdAt        DateTime @default(now())

  widget           WidgetConfig @relation(fields: [widgetId], references: [id])
  conversation     WidgetConversation @relation(fields: [conversationId], references: [id])
}
```

After adding, run:

```bash
npx prisma migrate dev --name add_generic_widget
npx prisma generate
```

---

## 2. Widget Token Generation — `src/actions/widget/createWidget.ts`

```typescript
"use server";

import { auth } from "@clerk/nextjs/server";
import prismaClient from "@/lib/prismaClient";

export async function createWidget(data: {
  name: string;
  welcomeMessage?: string;
  agentName?: string;
  knowledgeBase?: string;
  primaryColor?: string;
  theme?: string;
  voiceEnabled?: boolean;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const existing = await prismaClient.widgetConfig.findUnique({
    where: { userId },
  });

  if (existing) {
    // Update instead of create
    return prismaClient.widgetConfig.update({
      where: { userId },
      data,
    });
  }

  return prismaClient.widgetConfig.create({
    data: {
      userId,
      ...data,
    },
  });
}

export async function getWidget() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return prismaClient.widgetConfig.findUnique({
    where: { userId },
  });
}

export async function regenerateWidgetToken() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { randomUUID } = await import("crypto");

  return prismaClient.widgetConfig.update({
    where: { userId },
    data: { token: randomUUID() },
  });
}
```

---

## 3. Public Widget Chat API — `src/app/api/widget/chat/route.ts`

This is the endpoint the widget iframe calls. It must be public (no auth).

```typescript
import { NextRequest } from "next/server";
import prismaClient from "@/lib/prismaClient";

export async function POST(req: NextRequest) {
  const {
    token, // widget token from script tag
    message, // user's message
    visitorId, // anonymous browser fingerprint
    visitorEmail, // optional, if user typed their email
    history, // previous messages [{role, content}]
  } = await req.json();

  if (!token || !message) {
    return Response.json(
      { error: "Missing token or message" },
      { status: 400 },
    );
  }

  // Look up widget config
  const widget = await prismaClient.widgetConfig.findUnique({
    where: { token },
  });

  if (!widget || !widget.isActive) {
    return Response.json(
      { error: "Invalid or inactive widget" },
      { status: 401 },
    );
  }

  // Get or create conversation
  let conversation = await prismaClient.widgetConversation.findFirst({
    where: { widgetId: widget.id, visitorId },
    orderBy: { updatedAt: "desc" },
  });

  if (!conversation) {
    conversation = await prismaClient.widgetConversation.create({
      data: {
        widgetId: widget.id,
        visitorId,
        visitorEmail: visitorEmail ?? null,
        messages: [],
      },
    });
  }

  // Build system prompt using knowledge base
  const systemPrompt = buildSystemPrompt(widget);

  // Call AI (using your existing AI setup)
  const aiReply = await callAI(systemPrompt, history ?? [], message);

  // Persist updated messages
  const updatedMessages = [
    ...(conversation.messages as any[]),
    { role: "user", content: message, timestamp: new Date().toISOString() },
    {
      role: "assistant",
      content: aiReply,
      timestamp: new Date().toISOString(),
    },
  ];

  await prismaClient.widgetConversation.update({
    where: { id: conversation.id },
    data: {
      messages: updatedMessages,
      visitorEmail: visitorEmail ?? conversation.visitorEmail,
    },
  });

  // Capture lead if email was just shared
  if (visitorEmail && !conversation.visitorEmail) {
    await prismaClient.widgetLead.create({
      data: {
        widgetId: widget.id,
        conversationId: conversation.id,
        email: visitorEmail,
        note: message,
      },
    });

    await prismaClient.widgetConfig.update({
      where: { id: widget.id },
      data: { totalLeads: { increment: 1 } },
    });
  }

  // Increment chat count
  await prismaClient.widgetConfig.update({
    where: { id: widget.id },
    data: { totalChats: { increment: 1 } },
  });

  return Response.json({
    reply: aiReply,
    conversationId: conversation.id,
  });
}

function buildSystemPrompt(widget: any): string {
  let prompt = `You are ${widget.agentName}, an AI sales and support assistant.
Be helpful, concise, and friendly.
If the visitor shares their email, acknowledge it warmly.
Always try to help them find what they need or connect them with the right person.`;

  if (widget.knowledgeBase) {
    prompt += `\n\nBusiness information you must use to answer questions:\n${widget.knowledgeBase}`;
  }

  if (widget.platformType === "saleor") {
    prompt += `\n\nThis business runs an e-commerce store. Help customers with product questions, orders, and purchases.`;
  }

  return prompt;
}

async function callAI(
  systemPrompt: string,
  history: any[],
  message: string,
): Promise<string> {
  // Replace this with your existing AI call pattern
  // e.g. @google/generative-ai or Anthropic SDK
  // This is a placeholder — adapt to match your codebase's AI call convention

  const messages = [
    ...history.map((m: any) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  // Example with Anthropic (adapt if using Gemini):
  // const response = await anthropic.messages.create({
  //   model: 'claude-3-5-sonnet-20241022',
  //   system: systemPrompt,
  //   messages,
  //   max_tokens: 500,
  // })
  // return response.content[0].text

  return "AI reply placeholder — wire up your existing AI call here";
}
```

---

## 4. Widget Page (iframe) — `src/app/widget/page.tsx`

This is the page that loads inside the iframe on any website.

```typescript
import { Suspense } from 'react'
import WidgetUI from './_components/WidgetUI'

export default function WidgetPage({
  searchParams,
}: {
  searchParams: { token?: string; theme?: string }
}) {
  if (!searchParams.token) {
    return <div>Invalid widget</div>
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WidgetUI
        token={searchParams.token}
        theme={searchParams.theme ?? 'light'}
      />
    </Suspense>
  )
}
```

Create `src/app/widget/_components/WidgetUI.tsx` as a client component with:

- Chat message list
- Text input + send button
- Optional voice call button (connects to Python agent)
- Email capture prompt after 2nd message
- Uses `/api/widget/chat` endpoint
- Stores `visitorId` in localStorage (random UUID on first visit)
- Stores conversation `history` in state for context

---

## 5. Widget Script — `public/widget.js`

```javascript
(function () {
  const script = document.currentScript;
  const token = script.getAttribute("data-token");
  const theme = script.getAttribute("data-theme") || "light";
  const position = script.getAttribute("data-position") || "bottom-right";

  if (!token) {
    console.warn("[STS-AI Widget] data-token is required.");
    return;
  }

  const BASE_URL = "https://YOUR-DOMAIN.com"; // replace with actual domain

  const pos =
    position === "bottom-left"
      ? "bottom:24px;left:24px;"
      : "bottom:24px;right:24px;";

  // Toggle button
  const btn = document.createElement("button");
  btn.id = "sts-ai-toggle";
  btn.innerHTML = "💬";
  btn.style.cssText = `
    position:fixed;${pos}
    width:52px;height:52px;border-radius:50%;
    background:#6366f1;color:white;font-size:22px;
    border:none;cursor:pointer;z-index:2147483646;
    box-shadow:0 4px 16px rgba(0,0,0,0.2);
    transition:transform 0.15s;
  `;
  btn.onmouseenter = () => (btn.style.transform = "scale(1.08)");
  btn.onmouseleave = () => (btn.style.transform = "scale(1)");

  // Iframe
  const iframe = document.createElement("iframe");
  const iframePos =
    position === "bottom-left"
      ? "bottom:88px;left:24px;"
      : "bottom:88px;right:24px;";

  iframe.src = `${BASE_URL}/widget?token=${token}&theme=${theme}`;
  iframe.style.cssText = `
    position:fixed;${iframePos}
    width:380px;height:580px;
    border:none;border-radius:16px;
    box-shadow:0 8px 32px rgba(0,0,0,0.15);
    z-index:2147483647;display:none;
    transition:opacity 0.2s,transform 0.2s;
    transform:translateY(8px);opacity:0;
  `;
  iframe.allow = "microphone";

  let open = false;
  btn.onclick = () => {
    open = !open;
    if (open) {
      iframe.style.display = "block";
      btn.innerHTML = "✕";
      setTimeout(() => {
        iframe.style.opacity = "1";
        iframe.style.transform = "translateY(0)";
      }, 10);
    } else {
      iframe.style.opacity = "0";
      iframe.style.transform = "translateY(8px)";
      btn.innerHTML = "💬";
      setTimeout(() => (iframe.style.display = "none"), 200);
    }
  };

  document.body.appendChild(btn);
  document.body.appendChild(iframe);
})();
```

---

## 6. Dashboard Widget Setup Page — `src/app/(dashboard)/widget/page.tsx`

Create a settings page where the user:

- Sees their embed code (pre-filled with their token)
- Sets agent name, welcome message, primary color, theme
- Pastes their business knowledge base (free text — FAQ, product info, policies)
- Toggles voice on/off
- Sees total chats and leads captured
- Can regenerate their token if compromised
- Optionally connects a platform (Saleor, Shopify) for deeper sync

The embed code shown should be:

```html
<script
  src="https://YOUR-DOMAIN.com/widget.js"
  data-token="THEIR_TOKEN"
  data-theme="light"
  defer
></script>
```

Show this in a copyable code block.

---

## 7. CORS Headers — `next.config.ts`

The widget iframe and script need to be loadable from any domain.

```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: "/widget",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        source: "/api/widget/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
      {
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## 8. OPTIONS Handler for CORS preflight — `src/app/api/widget/chat/route.ts`

Add this to the same file:

```typescript
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
```

---

## What This Enables

| User type           | What they do                                 | What they get                 |
| ------------------- | -------------------------------------------- | ----------------------------- |
| Any website owner   | Paste script tag                             | Chat + voice AI agent         |
| E-commerce (Saleor) | Connect store + paste tag                    | Full product/order sync       |
| Blog / agency       | Paste script tag + add FAQ to knowledge base | AI answers from their content |
| SaaS product        | Paste script tag                             | AI handles support queries    |

---

## After Cursor Builds Everything

```bash
npx prisma migrate dev --name add_generic_widget
npx prisma generate
npm run build
```

Replace `YOUR-DOMAIN.com` in `public/widget.js` with actual production domain before deploying.
