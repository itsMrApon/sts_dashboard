# LiveKit Voice Agent – Setup

The voice agent integration has been copied into this project. Complete setup:

## 1. Environment variables

Add to `.env` or `.env.local`:

```env
# LiveKit (get from https://cloud.livekit.io)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# Optional: protect agent-config so only your Python worker can call it
SAAS_API_KEY=your_internal_secret
```

## 2. Python agent (livekit-agent)

Run the Python voice agent separately (from `livekit-agent` repo):

- Ensure it has the same `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- Optional: set `SAAS_API_URL=https://your-sts-ai-url/api` and `SAAS_API_KEY` so the agent loads config from this app

## 3. Where the feature lives

- **Backend:** `src/lib/livekit/`, `src/app/api/livekit/`, `src/app/api/rooms/`
- **Frontend:** `src/components/voice-agent/`, `src/app/(protectedRoutes)/voice-agent/page.tsx`
- **Route:** Visit `/voice-agent` (or the path under your protected routes) to talk to the sales agent

## 4. Dependencies (already installed)

- livekit-server-sdk
- @livekit/protocol
- livekit-client
- @livekit/components-react
