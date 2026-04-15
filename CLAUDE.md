# CLAUDE.md

Creator: `5h1fa7`
Project: `sts-ai`
Role default: Senior System Architect + hands-on full-stack AI engineer

## Mission
- Build and scale AI-first product experiences in this repo using clean architecture, reliable realtime systems, and fast iteration.
- Prefer production-safe decisions: observability, graceful failures, explicit contracts, and minimal regressions.

## Repo Scan Baseline
- Runtime: Next.js App Router (v15), React 19, Prisma, TypeScript.
- Package manager in use: npm (`package-lock.json` present).
- Main application surface: `src/app` (App Router with protected/public route groups and API routes).
- AI/realtime integration spans LiveKit, Gemini, Deepgram, Vapi, and Stream.

## Tech Stack
- Framework: Next.js `15.2.4` (App Router).
- Language: TypeScript `^5` (strictness follows project tsconfig and linting).
- UI: React `19`, Tailwind CSS `4`, Radix UI, Sonner.
- Data: Prisma `6.x`, PostgreSQL (Neon in current env).
- Auth/Billing: Clerk, Stripe.
- Realtime/Voice: LiveKit (`client`, `server-sdk`, `components-react`), Stream, Vapi.
- AI libs:
  - `@google/generative-ai` (Gemini)
  - LiveKit agent pipeline integrations
  - Deepgram (through Python LiveKit agent pipeline)

## Architecture Notes
- Frontend + backend web app in one Next.js codebase.
- Python LiveKit worker exists under `agents/python/livekit-agent` and is required for voice-agent runtime.
- Text chat and voice are separate flows; do not assume voice dependencies for text-only APIs.
- Keep boundaries clear:
  - `src/app/api/**`: transport + request/response layer
  - `src/lib/**`: business logic, AI helpers, integrations
  - `src/actions/**`: server actions/orchestration

## Coding Standards (Senior-level / 3+ years)

### Naming and Structure
- Use explicit, intention-revealing names. Avoid vague names (`data`, `temp`, `helper`).
- Components: PascalCase, one concern per component.
- Functions/variables: camelCase.
- Constants: UPPER_SNAKE_CASE only for true constants.
- API route files should keep thin handlers and delegate heavy logic to `src/lib/**`.

### TypeScript Discipline
- Avoid `any`; prefer explicit types and narrowed unions.
- Validate boundary inputs (API params/body/query) with clear guards.
- Keep shared domain types centralized (`src/lib/type.ts` and domain-specific modules).

### React / Next.js Rules
- Prefer Server Components by default.
- Mark Client Components only when browser APIs, hooks, or interactivity require it.
- Keep client state localized; avoid unnecessary global state.
- Optimize for route-level loading/error boundaries.

### Performance and Realtime
- Treat voice/video paths as latency-sensitive; avoid blocking work in hot paths.
- Any disconnect/reconnect logic must be deterministic and idempotent.
- Use explicit timeout handling for external services (LLM/STT/TTS/webhooks).

### Bangla Language Optimization
- Preserve Bangla Unicode content end-to-end; never force ASCII normalization for user language content.
- Keep language-aware model/stt configuration explicit (e.g., Bangla/English mode selection).
- Avoid lossy text transforms in transcripts, prompts, and stored messages.
- Test Bangla punctuation/tokenization behavior when updating prompt or STT logic.

## Workflows

### Development
- Install deps: `npm install`
- Start dev: `npm run dev`
- Lint: `npm run lint`
- Build (includes Prisma generate): `npm run build`
- Start production build locally: `npm run start`

### Database / Prisma
- Generate Prisma client: `npx prisma generate`
- Check migration/db status: `npx prisma migrate status`
- If DB errors occur, verify `DATABASE_URL` reachability before debugging app logic.

### Voice Agent (Python worker)
- Worker path: `agents/python/livekit-agent`
- Typical run command:
  - `cd agents/python/livekit-agent`
  - `uv run python -m agent.main dev`
- Voice features depend on this worker; text chat does not.

### Deployment Checklist
- `npm run lint`
- `npm run build`
- Confirm env vars for Clerk/Stripe/LiveKit/DB/AI providers.
- Confirm Prisma connectivity before rollout.

## Critical Paths (AI + Realtime)

### Core AI/Voice
- `src/lib/messages/geminiText.ts`
- `src/lib/livekit/livekitVoiceAgent.ts`
- `src/lib/livekit/livekitClient.ts`
- `src/lib/livekit/voice-agent-config.ts`
- `agents/python/livekit-agent/agent/main.py`
- `agents/python/livekit-agent/agent/pipeline.py`
- `agents/python/livekit-agent/agent/config.py`

### API Endpoints (high-impact)
- `src/app/api/chat/[roomName]/route.ts`
- `src/app/api/livekit/connection-details/route.ts`
- `src/app/api/rooms/[roomName]/agent-config/route.ts`
- `src/app/api/transcripts/ingest/route.ts`

### Message/Context Logic
- `src/lib/messages/buildAgentContext.ts`
- `src/lib/messages/verifyRoomOwnership.ts`

## MCP Usage
- Preferred project filesystem MCP: `sts-ai-brain`.
- Use it for deep project scans, file discovery, and structured context retrieval before large refactors.

## Collaboration Defaults for AI Assistant
- Think architecturally first, then implement minimally.
- Do not rewrite stable modules without strong reason.
- Preserve existing product behavior unless user asks to change it.
- When debugging, isolate by layer: UI -> API -> lib -> external provider -> DB.
- Always explain root cause, not only symptom fix.

## Active Tasks
- [ ] Task:
  - Context:
  - Owner:
  - Status:
  - Next step:
- [ ] Task:
  - Context:
  - Owner:
  - Status:
  - Next step:

## Lessons Learned
- Date:
  - Issue:
  - Root cause:
  - Fix:
  - Prevention:
- Date:
  - Issue:
  - Root cause:
  - Fix:
  - Prevention:

## Ignore for Context
- `node_modules/**`
- `.next/**`
- `dist/**`

//alias bridge="litellm --model gemini/gemini-2.0-pro-exp --port 4000"