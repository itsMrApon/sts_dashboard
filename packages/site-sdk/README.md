# @sts-ai/site-sdk

Fetch published STS-AI workspace profile and services for creator websites.

```ts
import { createStsSiteClient } from '@sts-ai/site-sdk'

const client = createStsSiteClient({
  apiBase: process.env.NEXT_PUBLIC_STS_AI_URL!,
  workspaceId: process.env.NEXT_PUBLIC_STS_WORKSPACE_ID!,
  siteKey: process.env.STS_SITE_KEY!,
})

const profile = await client.getProfile()
const services = await client.getServices('insurance')
```

## Endpoints

- `GET /api/public/v1/workspaces/{workspaceId}/profile`
- `GET /api/public/v1/workspaces/{workspaceId}/services?type=insurance`
