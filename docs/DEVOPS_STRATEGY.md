# STS-AI DevOps Automation Strategy

**Current Date:** April 5, 2026
**Target:** <1K MAU at 12 months
**Prepared for:** Multi-service architecture (Vercel, Neon, Render, Self-hosted Docker)

---

## Executive Summary

You're at a critical inflection point: expanding from 3 n8n workflows to 9+, adding Saleor, ERPNext, TWILIO, and complex messaging (Telegram, WhatsApp, Discord, Slack). Your current approach (manual deployments, no staging, reactive monitoring) will collapse under this complexity.

**This document provides:**
1. Operations Strategy for multi-service coordination
2. Monitoring Dashboard Design (metrics, thresholds, alerts)
3. Deployment Checklists (safe migrations, versioning)
4. Incident Runbooks (troubleshooting playbooks)
5. Scaling Plan (user → infrastructure investment)
6. Cost Projections (infrastructure spend by user count)

---

## Challenge 1: Multi-Service Deployment Coordination

### Current Problem

You have a complex orchestration challenge:

```
Database Change → App Deployment → n8n Update → ERPNext Sync
(Neon)          (Vercel)         (Render)      (Docker)
```

**Example:** Adding `messageChannelId` field to `CampaignLead`:

1. PostgreSQL: Add column ✓
2. Prisma: Update schema + generate migration ✓
3. Next.js app: Update API routes to accept/validate field ✓
4. n8n workflows: Update "Update State" HTTP requests ✓
5. ERPNext: Update sync logic ✗ **If done out of order = silent failures**

If deployed out of sequence:
- App tries to write `messageChannelId` before DB column exists → 500 error
- Workflows reference field app doesn't expose → failed updates
- ERPNext sync expects field in webhook payload → discarded data

### Recommended Operations Strategy

#### 1. Versioned API Contracts

**Implement API versioning for breaking changes** (non-breaking changes deploy freely):

```typescript
// src/app/api/v1/campaigns/update-state/route.ts (current)
// src/app/api/v2/campaigns/update-state/route.ts (new version with extra field)

// Parallel run both versions during transition
```

**Decision: When to v2?**
- ✓ New required field to payload
- ✓ Removal of field
- ✓ Change in response schema
- ✗ New optional field (add to v1)
- ✗ New optional endpoint

**Versioning rules:**
- v1 = latest stable, always available
- v2 = new version, backward-incompatible
- Run v1 + v2 in parallel for 1-2 weeks
- Update n8n/ERPNext to v2
- Deprecate v1 after 30 days

#### 2. Deployment Order (Golden Rule)

```
Step 1: Database (Neon migrations)
  ├─ Backward-compatible only (ADD columns, ADD enums, CREATE tables)
  └─ Never DROP/ALTER in breaking way

Step 2: Next.js App (Vercel)
  ├─ Deploy with code that handles both old + new schema states
  ├─ Use feature flags for risky changes
  └─ Verify API health checks pass

Step 3: n8n Workflows (Render)
  ├─ Update workflow JSON to use new API version
  ├─ Test webhook in dry-run mode first
  └─ Activate one workflow at a time

Step 4: ERPNext / External Systems
  ├─ Deploy migrations/updates
  └─ Verify sync is consuming new fields correctly

Step 5: Cleanup (if backward-compat window closed)
  ├─ Remove old schema columns
  ├─ Retire old API versions
  └─ Update all remaining references
```

#### 3. Feature Flags for Safety

Add to your app for risky deployments:

```typescript
// src/lib/featureFlags.ts
const FEATURE_FLAGS = {
  USE_MESSAGE_CHANNELS: process.env.USE_MESSAGE_CHANNELS === 'true',
  ENABLE_SALEOR_SYNC: process.env.ENABLE_SALEOR_SYNC === 'true',
  ENABLE_TWILIO_OUTREACH: process.env.ENABLE_TWILIO_OUTREACH === 'true',
}

// Use in workflows:
if (FEATURE_FLAGS.USE_MESSAGE_CHANNELS) {
  // Include messageChannelId in response
} else {
  // Backward-compatible response
}
```

You can toggle these in Vercel environment variables without redeploying.

#### 4. Staging Environment (Cost vs. Safety)

**Option A: Full Staging Clone (Recommended for <1K MAU)**

```
Staging Database: Neon Pro ($50/month)
  ├─ Clone of prod schema weekly
  ├─ Anonymized production data
  └─ 7-day backups

Staging n8n: Render Pro ($50/month)
  └─ Mirror of prod instance

Staging Costs: $100/month additional

Benefit: Test schema migrations, workflow updates, ERPNext sync on realistic data
```

**Recommendation: Deploy to staging first, test for 24h, then promote to prod**

**Option B: No Staging (Current approach)**

- Risk: Breaks go straight to production
- At <100 MAU: acceptable risk
- At >100 MAU: unacceptable downtime cost

**My recommendation:** Implement staging when you hit 100 MAU or first schema migration breaks production.

#### 5. Deployment Checklist (Multi-Service)

**Before Any Deployment:**

- [ ] All changes merged to `main`
- [ ] Prisma migrations generated (if schema change)
  ```bash
  npx prisma migrate dev --name add_message_channels
  ```
- [ ] Migrations tested locally with full data set
- [ ] Git tag created: `git tag release/v1.2.3`

**Schema Migration Deployment:**

- [ ] Backup production database (Neon: automatic daily, but verify it's recent)
- [ ] Verify backup can be restored (test restore to staging)
- [ ] Deploy to staging first:
  ```bash
  cd staging && npx prisma migrate deploy
  ```
- [ ] Run sanity checks on staging:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'CampaignLead';
  \d CampaignLead; -- verify new columns exist
  ```
- [ ] Test queries that use new schema
- [ ] All tests pass
- [ ] Schedule prod migration during low-traffic window (2 AM - 4 AM UTC)
- [ ] Deploy migration to prod:
  ```bash
  npx prisma migrate deploy --skip-generate
  ```
- [ ] Verify prod database:
  ```sql
  SELECT COUNT(*) as lead_count FROM "CampaignLead";
  ```
- [ ] Monitor app logs for 15 minutes for schema-related errors

**App Deployment (Vercel):**

- [ ] Build passes locally: `npm run build`
- [ ] Unit tests pass: `npm test`
- [ ] Environment variables updated (if needed)
- [ ] Feature flags configured
- [ ] Push to `main` (automatic Vercel deployment)
- [ ] Verify deployment health: check Vercel dashboard
- [ ] Test /api/health endpoint returns 200
- [ ] Monitor Vercel logs for errors (15 min)

**n8n Workflow Update:**

- [ ] Export current workflow (backup)
  ```bash
  # In n8n UI: Click workflow → Download JSON
  cp ~/Downloads/Campaign_Launch.json ./n8n/workflows/backup_Campaign_Launch.json
  ```
- [ ] Update workflow nodes for new API version
- [ ] Enable "Dry Run" mode in n8n UI
- [ ] Test with sample lead data (1 lead)
- [ ] Verify webhook payload structure
- [ ] Disable "Dry Run" when confident
- [ ] Monitor workflow executions for 30 min
- [ ] If issues: revert to backup, debug, redeploy

**Verification (After All Deployments):**

- [ ] Run health check: `curl https://your-app.com/api/health`
- [ ] Verify database connectivity
- [ ] Check n8n executions: no errors in last 10 runs
- [ ] Sample test: trigger one campaign lead through full workflow
- [ ] Check logs in all systems (app, n8n, database)
- [ ] Monitor for 24 hours before marking complete

---

## Challenge 2: Database Migration Safety

### Current State

**What you have:**
- Neon PostgreSQL with automatic daily backups ✓
- 14 migrations already applied (Oct 2025 - Apr 2026) ✓
- Prisma migrations tracked ✓

**What you're missing:**
- Verified backup + restore procedure
- Deployment window planning
- Rollback strategy definition
- Long-running migration planning
- Index strategy for large tables

### Recommended Migration Strategy

#### 1. Backup & Restore Procedure

**Daily backups (Neon automatic):**
- Retention: 7 days (free tier)
- Frequency: Daily at 2 AM UTC
- Verification: **Test restore weekly**

**Test restore procedure (add to team process):**

```bash
# Weekly (Friday 10 AM):
# 1. In Neon dashboard: Create restore point from backup from 7 days ago
# 2. Create separate database: restore_test_20260412
# 3. Test connectivity from app:
#    psql postgresql://user:pass@restore-test.db.neon.tech/stsai_test
# 4. Verify data integrity:
#    SELECT COUNT(*) FROM "User"; -- Should match prod
#    SELECT COUNT(*) FROM "Campaign";
#    SELECT COUNT(*) FROM "EventLog"; -- Should be huge
# 5. Drop restore_test_20260412
# 6. Document: "Backup tested, restore works, 15 min RTO"
```

**Recovery Time Objective (RTO):** 15-30 minutes
- Point-in-time restore available
- Can restore to any timestamp in last 7 days
- Cost to restore: $0 (included in Neon)

#### 2. Deployment Window Planning

**Current approach:** Deploy anytime (risky at scale)
**Better approach:** Deploy during low-traffic window

**Identify your traffic pattern:**

```typescript
// src/app/api/health/route.ts
// Add this endpoint to measure traffic
export async function GET() {
  const now = new Date();
  const hour = now.getUTCHours();

  // Log traffic by hour (implement full analytics later)
  return Response.json({
    status: 'healthy',
    hour_utc: hour,
    timestamp: now.toISOString(),
  });
}

// Monitor logs for 2 weeks to find pattern:
// If mostly US audience: low traffic 6-8 AM UTC
// If mostly Europe: low traffic 10 PM - 2 AM UTC
// If global: no obvious window, use 2 AM UTC as default
```

**For now: Assume 2 AM - 4 AM UTC** (works for most audiences)

**Never deploy during:**
- Weekday 9-11 AM UTC (US east coast morning)
- 5-7 PM UTC (Europe evening)
- Any time during active user campaigns/webinars

#### 3. Safe Migration Checklist

**For every schema migration:**

```bash
# 1. Generate migration
npx prisma migrate dev --name add_new_feature

# 2. Review migration SQL (CRITICAL)
cat prisma/migrations/20260412*/migration.sql
# ✓ Verify: No data loss
# ✓ Verify: Backward compatible
# ✓ Verify: No locks on huge tables

# 3. If touching large tables (>1M rows), use CONCURRENTLY:
# Example for EventLog (10M+ rows):
# ❌ CREATE INDEX idx_event_log_user_id ON "EventLog"("userId");  -- locks table
# ✓ CREATE INDEX CONCURRENTLY idx_event_log_user_id ON "EventLog"("userId");

# 4. Test locally with large data
# (Either real prod dump or generated test data)
time npx prisma migrate deploy
# Should complete in <5 seconds for most migrations
# If >30 seconds, you have a long-running migration

# 5. Deploy to staging first
DATABASE_URL=<staging_url> npx prisma migrate deploy

# 6. Monitor for errors (15 min)
# Check: No connection errors, no timeout errors, no data corruption

# 7. Only then deploy to prod during maintenance window
```

#### 4. Rollback Strategy

**For most migrations: Forward-only (no rollback)**

```
Why? Because reverting corrupts data. Instead:
- Keep backups for 7 days
- If migration breaks: restore from backup, fix migration, reapply
- Cost: 15-30 min downtime (acceptable at <1K MAU)
```

**Reverse migration example (if schema is reversible):**

```sql
-- migration_20260412123456_add_message_channel.sql
-- UP:
ALTER TABLE "CampaignLead" ADD COLUMN "messageChannelId" UUID;

-- DOWN (if something breaks):
ALTER TABLE "CampaignLead" DROP COLUMN "messageChannelId";
```

But Prisma doesn't support `down` migrations by default. You'd need to:
1. Restore from backup, OR
2. Write custom SQL to undo

**Recommendation: Backup first, then migrate. No manual rollback strategy needed.**

#### 5. Long-Running Migrations

**Current tables that could be slow to index:**

```
EventLog: ~10M rows (growing 10K/day)
CallTranscript: ~100K rows
HuntedLead: ~1M rows (growing with campaigns)
```

**If you ever need to add index to EventLog:**

```bash
# ❌ Wrong (locks table for 30+ seconds):
CREATE INDEX idx_eventlog_userid ON "EventLog"("userId");

# ✓ Correct (concurrent, no locks):
CREATE INDEX CONCURRENTLY idx_eventlog_userid ON "EventLog"("userId");
```

**Prisma doesn't generate CONCURRENTLY by default.** Need custom migration:

```typescript
// prisma/migrations/20260412_add_concurrent_index/migration.sql
CREATE INDEX CONCURRENTLY "idx_EventLog_userId" ON "EventLog"("userId");

// This will take 5-10 minutes but won't block app
// Monitor: SELECT * FROM pg_stat_progress_create_index;
```

### Database Monitoring Queries

Add to your monitoring dashboard:

```sql
-- Table sizes (identify bloat)
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Result at <100 MAU should show:
-- EventLog: ~5-10 GB
-- All others: <1 GB

-- Connection count (detect connection leak)
SELECT count(*) FROM pg_stat_activity;
-- Should be <10 connections (Neon free = 20 max)

-- Slow queries (>1 second)
-- Enable: ALTER DATABASE yourdb SET log_min_duration_statement = 1000;
-- Then check logs for queries taking >1s
```

---

## Challenge 3: Monitoring the Full Stack

### Current State

**You have:** Nothing. No alerting, no dashboards, no health checks.

**This is a critical gap.** At <100 MAU you can survive without monitoring. At >100 MAU, you'll have outages and won't know why.

### Recommended Monitoring Strategy

#### 1. Health Check Endpoints (Add to App)

Create `/api/health` endpoint to expose system status:

```typescript
// src/app/api/health/route.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const checks = {
    api: 'healthy',
    database: 'unknown',
    timestamp: new Date().toISOString(),
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'healthy';
  } catch (error) {
    checks.database = 'unhealthy';
    return Response.json(checks, { status: 503 });
  }

  return Response.json(checks, { status: 200 });
}

// Usage:
// curl https://your-app.com/api/health
// Expect: {"api":"healthy","database":"healthy","timestamp":"..."}
// Status code: 200 (healthy) or 503 (unhealthy)
```

#### 2. Monitoring Dashboard Design

**Metrics to track (by system):**

**API Health (Next.js on Vercel):**
- Endpoint: /api/health (deployed ✓)
- Response time: P95, P99 (target: <200ms)
- Error rate: % requests with 5xx (target: <0.1%)
- Status: 200 OK or down

**Database Health (Neon PostgreSQL):**
- Connections: current / max (Neon free = 20)
- Query latency: P95, P99 (target: <100ms for reads, <500ms for writes)
- Disk usage: current / limit (usually unlimited)
- Backup status: last backup time, restore tested

**n8n Workflow Health (Render):**
- Executions: total today, success %, failure % (target: >95% success)
- Execution time: average duration (watch for slowdowns)
- Webhook deliveries: delivered / failed (target: 100% delivered)
- Uptime: n8n service available (target: 99%)

**External Integration Health:**
- Stripe webhook deliveries: delivered / retrying / failed
- Clerk auth: successful logins / failed (target: 100% success)
- Stream.io: connections, average latency
- LiveKit: agents, room utilization

**Business Metrics (High-level):**
- Campaigns launched today: count
- Campaign leads ingested: total
- Conversion rate: (joined / outreached) %
- Revenue: from Stripe integrations

#### 3. Alert Thresholds & Channels

**Critical Alerts (page immediately):**
- API down (health check 503 for >1 min)
- Database unreachable
- n8n down (Render service)
- Alert channel: Email + Slack (if you have Slack)

**Warning Alerts (email daily):**
- Error rate >1% (app)
- Query latency P99 >500ms (database)
- n8n success rate <90%
- Neon connections >18 / 20 (capacity warning)

**Info Alerts (weekly digest):**
- Total API calls
- Campaigns created
- Revenue (if any)

**Where to send alerts:**
- Email: your-email@gmail.com (always available)
- Slack: #devops-alerts channel (if team exists)
- SMS: not needed yet at <1K MAU

#### 4. Monitoring Stack Setup

**Best free-tier option for you:**

```
Uptime Robot (free tier):
├─ Health check every 5 min
├─ Alert if down >3 times in a row
├─ Email notifications
└─ Cost: $0 (free tier)

Better: Axiom (if you want centralized logs):
├─ Collect Next.js logs automatically
├─ Collect n8n logs via webhook
├─ Dashboard with queries
├─ Cost: $0 - $50/month

Best: Datadog (once at scale):
├─ Full APM (application performance monitoring)
├─ Synthetics (automated tests from multiple locations)
├─ Cost: $15+ per host (expensive for now)
```

**My recommendation for <100 MAU:**
1. Set up `/api/health` endpoint (free)
2. Add Uptime Robot free tier (monitors health every 5 min)
3. When issues arise, add Axiom for log aggregation
4. When at 500+ MAU, consider Datadog

#### 5. Logging Strategy

**Where logs go now:**
- Next.js app: Vercel logs (view in Vercel dashboard)
- n8n: Render logs (view in Render dashboard)
- Database: Neon logs (view in Neon dashboard)
- Problem: scattered across 3 platforms

**Centralized logging (add later when needed):**

```typescript
// src/lib/logger.ts
import axios from 'axios';

async function log(level: string, message: string, context?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    service: 'nextjs-app',
  };

  // Log to console (Vercel captures)
  console.log(JSON.stringify(logEntry));

  // Optional: Send to centralized log service (Axiom, Datadog, etc)
  // await axios.post('https://logs.axiom.co/...', logEntry);
}

export const logger = {
  info: (msg: string, ctx?: any) => log('INFO', msg, ctx),
  error: (msg: string, ctx?: any) => log('ERROR', msg, ctx),
  warn: (msg: string, ctx?: any) => log('WARN', msg, ctx),
};
```

### Monitoring Dashboard Template

**Create a simple Markdown file to track status manually (until automation):**

```markdown
# STS-AI System Status

Last Updated: [TIMESTAMP]

## API Health
- Endpoint: /api/health
- Status: ✓ Healthy
- Response Time: 45ms
- Error Rate (24h): 0%

## Database
- Connections: 8/20
- Query Latency (P99): 85ms
- Disk Usage: 2.5 GB / unlimited
- Last Backup: [today, 2 AM UTC]
- Backup Tested: [date]

## n8n Workflows (Render)
- Service Status: ✓ Running
- Last Check: [timestamp]
- Recent Executions: 42 total, 40 successful (95%)
- Failures: None in last 12h

## Integrations
- Stripe Webhooks: ✓ 100% delivered
- Clerk Auth: ✓ Working
- Stream.io: ✓ Operational
- LiveKit: ✓ Operational

## Issues
- None currently
```

Save as `/docs/STATUS.md`, update weekly during first 100 MAU phase.

---

## Challenge 4: Scaling Triggers & Infrastructure Investment

### Cost Projection Framework

**At what user count should you invest in upgrades?**

```
Current monthly cost:
├─ Vercel: $0 (hobby plan) → pro plan ($20/mo)
├─ Neon: $0 (free tier, 3GB, 20 connections)
├─ Clerk: $0 (generous free tier)
├─ Render: $0 (free tier) → $7/mo (manual hours)
├─ Domain: ~$12/year
└─ Total: ~$0 (in practice)

At 10 MAU: No upgrades needed
At 50 MAU: Consider upgrading? No
At 100 MAU: First upgrade needed
At 500 MAU: Multiple upgrades needed
At 1K MAU: Full production setup needed
```

### Scaling Decision Tree

```
100 MAU → 200 MAU
├─ Neon free tier still fine (3GB storage, 20 connections)
├─ Vercel hobby still fine
├─ n8n free Render still works
└─ Action: NONE, monitor database size

200 MAU → 500 MAU
├─ Database: Check EventLog table
│  └─ If >1GB: Upgrade Neon to Pro ($50/mo)
│     └─ Why: 100GB storage, 100 connections, automatic backups
├─ n8n: Monitor execution time
│  └─ If workflows >10s average: Upgrade Render ($7/mo)
├─ Vercel: Still fine
└─ Action: Upgrade Neon, consider n8n upgrade

500 MAU → 1K MAU
├─ Database: Neon Pro might be too small
│  └─ If >50GB: Upgrade to Neon Business ($200/mo) or migrate to managed AWS RDS
├─ Redis Cache: Add Redis ($20-40/mo)
│  └─ Why: Campaign dashboard queries getting slow (need caching)
├─ Separate analytics DB: EventLog queries bogging down transactional DB
│  └─ Solution: Move EventLog to ClickHouse ($50/mo)
├─ n8n: Upgrade to Pro on Render ($50/mo) or self-host on larger VPS
└─ Action: Major infrastructure refresh

1K+ MAU → 5K MAU
├─ Dedicated database server: RDS Multi-AZ ($500+/mo)
├─ Redis cluster: Multi-node ($100+/mo)
├─ n8n: Self-hosted on container cluster ($200+/mo)
├─ CDN for assets: Cloudflare ($20/mo)
└─ Full monitoring: Datadog ($500+/mo)
```

### Specific Scaling Limits

**Neon Free Tier (current):**
- Storage: 3 GB ✓ (plenty at <100 MAU)
- Connections: 20 ⚠️ (potential issue at >200 MAU)
- Shared hardware
- No automatic backups
- Decision point: At 200 MAU, upgrade to Neon Pro

**EventLog Table Growth:**
- Current estimate: ~10K rows/day (from campaigns, webinars, etc.)
- At 1 year, assuming 50 days of usage: 500K rows = 50 MB
- At 500 MAU, daily usage much higher: maybe 100K rows/day
- At 1 year: 36M rows = 3.6 GB
- Decision point: At 500 MAU, move EventLog to separate database

**n8n Execution Limits:**
- Current: Running simple workflows (scrape → send email)
- Each execution uses RAM
- Render free tier: 512 MB
- Problem: At 10+ simultaneous workflows, runs out of RAM
- Decision point: At >50 concurrent workflows/day, upgrade Render tier

**Vercel Build Times:**
- Current: Probably <2 minutes
- At 500 MAU: With more features, builds might hit 10+ minutes
- Vercel timeout: 45 minutes (fine)
- Problem: Longer builds = longer deployment time = more risk
- Solution: Optimize builds (code splitting, dynamic imports)
- Cost: Vercel Pro ($20/mo) gives priority builds

### Cost Projection Table

```
User Count | Neon   | Vercel | Render | Redis | Total
-----------|--------|--------|--------|-------|-------
  0-100   | $0     | $0     | $0     | $0    | $0
  100-200 | $0     | $0     | $0     | $0    | $0
  200-500 | $50    | $0     | $0     | $0    | $50
  500-1K  | $50    | $20    | $7     | $0    | $77
  1K-5K   | $200   | $20    | $50    | $40   | $310
  5K+     | $500   | $20    | $200   | $100+ | $820+
```

**Break-even analysis:**
- If you charge $99/month per premium user
- At 100 MAU: $9,900/month revenue vs. $0 cost = 100% margin
- At 500 MAU: $49,500/month revenue vs. $50 cost = 99.9% margin
- At 1K MAU: $99,000/month revenue vs. $77 cost = 99.9% margin
- **Infrastructure cost is negligible until 5K+ MAU**

---

## Challenge 5: Secrets & Configuration Management

### Current Threat Assessment

**Secrets you're managing:**
```
.env / .env.local:
├─ DATABASE_URL (Neon connection string)
├─ CLERK_SECRET_KEY
├─ STRIPE_API_KEY & STRIPE_WEBHOOK_SECRET
├─ LIVEKIT_API_KEY & LIVEKIT_API_SECRET
├─ OPENAI_API_KEY (probably)
├─ N8N_API_KEY
├─ OUTSCRAPER_API_KEY
├─ VAPI_API_KEY
├─ ELEVENLABS_API_KEY
├─ STREAM_IO_API_KEY
├─ GOOGLE_AI_API_KEY
└─ ~15 more APIs
```

**Risk: If any secret in git history:**
```bash
# Anyone with repo access can do:
git log --all --full-history -S "LIVEKIT_API_KEY"
# And find your key with historical value
```

### Secrets Management Strategy

#### 1. Secrets Storage

**Current (good): Environment variables in managed platforms**
- Vercel env vars ✓ (encrypted, good)
- Render env vars ✓ (encrypted, good)
- Your local .env ✓ (never commit)

**Never do:**
- ❌ Commit `.env` to git
- ❌ Store in code comments
- ❌ Store in database
- ❌ Send in Slack/Discord/email
- ❌ Log with console.log in production

**Verify current state:**

```bash
# Check if .env is in git
git status
# Should show: ignored by '.gitignore'

# Verify .gitignore has .env
cat .gitignore | grep "^\.env"

# Check if secrets ever committed
git log --all --full-history -S "LIVEKIT_API" -- "*.ts" "*.tsx" "*.env*"
# Should return: nothing
```

#### 2. Secrets Rotation Schedule

**Why rotate?** If a developer leaves, you revoke all their access. If a secret is leaked, rotate immediately.

**Rotation schedule:**

```
Every 90 days:
├─ Stripe API keys (create new, update app, delete old)
├─ Clerk secret key (in Clerk dashboard)
├─ N8N_API_KEY (custom, just change in Vercel + Render)
├─ LIVEKIT_API_SECRET (in LiveKit console)
└─ Third-party API keys (VAPI, ElevenLabs, etc)

Per-incident:
├─ If developer leaves: rotate all keys
├─ If key leaked: rotate that key immediately
├─ If account compromised: rotate all keys
```

**Rotation process:**

```bash
# Example: Rotate N8N_API_KEY

# 1. Generate new key
NEW_KEY=$(openssl rand -hex 32)
echo "New key: $NEW_KEY"

# 2. Update Vercel (via CLI or dashboard)
vercel env add N8N_API_KEY "$NEW_KEY"

# 3. Update Render
# (Via Render dashboard: Settings > Environment Variables)

# 4. Test: Deploy new version, test n8n webhooks

# 5. Document rotation
echo "$(date): Rotated N8N_API_KEY" >> ROTATION_LOG.md

# 6. Delete old key (after 24h to ensure no failures)
#    Tomorrow, confirm no webhook delivery issues, then remove from all platforms
```

#### 3. Access Control (Principle of Least Privilege)

**For each integration, create scoped credentials:**

```
Stripe:
├─ Restricted key #1: Can only read payment data (for analytics)
├─ Restricted key #2: Can only refund (for support)
└─ Admin key: Kept separate, never in code

Clerk:
├─ Instance key: Can manage users
├─ API key: Can validate tokens (what your app needs)
└─ Webhook secret: For webhook validation

n8n:
├─ API key: Can only trigger workflows (what Render needs)
└─ Admin key: Can modify workflows (for you only)
```

**Never use:** "master key" for everything

#### 4. Secret Leakage Response Plan

**If you accidentally commit a secret:**

```bash
# 1. IMMEDIATE: Rotate the secret
#    Example: If DATABASE_URL committed
#    → Create new Neon branch, get new URL
#    → Update all places (Vercel, local .env)

# 2. Force-push to remove from history (⚠️ careful!)
git log --oneline | head -20
# Find the commit with secret

git rebase -i <commit-before-secret>
# Mark commit with secret as "drop"
# Force push: git push -f origin main

# 3. Verify secret no longer in history
git log --all -S "old_secret_value"
# Should return: nothing

# 4. Even safer: Assume compromise
#    → Anyone who cloned repo before you removed it might have old secret
#    → Rotate all connected secrets (database, APIs, etc)
#    → File security incident report if customers affected

# 5. Check for public exposure
#    → Search GitHub, Pastebin for your leaked secret
#    → If found, report to Stripe/Clerk/etc for emergency rotation
```

#### 5. Environment Variable Checklist

Before every deployment, verify:

```bash
# 1. No secrets in code
grep -r "STRIPE_KEY\|API_KEY\|PASSWORD" src/ --include="*.ts" --include="*.tsx"
# Should return: nothing

# 2. .env is in .gitignore
grep "^\.env" .gitignore

# 3. All required vars set in Vercel
vercel env list
# Should show all vars used in app

# 4. All required vars set in Render (for n8n)
# (Check Render dashboard)

# 5. Local .env has test values
cat .env | head
# Should show: dummy values, not real keys

# 6. No git history with secrets
git log --all -p | grep -i "api_key\|secret"
# Should return: nothing
```

---

## Deployment Checklist (Quick Reference)

Use this before any production deployment.

### Pre-Deployment (1 day before)

- [ ] Code reviewed and merged to `main`
- [ ] All tests pass locally
- [ ] Database migrations generated (if needed)
- [ ] Migrations tested locally
- [ ] No secrets in code/git history
- [ ] Staging deployment successful (if changes exist)
- [ ] Rollback plan defined (restore from backup)
- [ ] Team notified of planned downtime (if any)

### Database Migration

- [ ] Backup verified (test restore)
- [ ] Deployment window confirmed (2 AM - 4 AM UTC)
- [ ] Migration SQL reviewed for locks/safety
- [ ] Deployed to staging 24h prior
- [ ] Sanity queries passed on staging
- [ ] `npx prisma migrate deploy` ready
- [ ] Post-migration sanity checks written
- [ ] Monitoring logs reviewed for errors (post-deploy)

### App Deployment (Vercel)

- [ ] Feature flags configured (if needed)
- [ ] Environment variables updated (if needed)
- [ ] Build succeeds: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] Push to `main` and monitor Vercel deployment
- [ ] Wait for deployment to complete (5-10 min)
- [ ] Test health check: `curl /api/health`
- [ ] Manual smoke test: 1 campaign end-to-end
- [ ] Monitor error logs for 15 minutes

### n8n Workflow Update

- [ ] Current workflow exported (backup)
- [ ] New workflow nodes configured
- [ ] Dry-run test with sample data
- [ ] Webhook payload structure verified
- [ ] Dry-run disabled, workflow activated
- [ ] Monitor executions for 30 minutes
- [ ] Check error messages, logs

### Post-Deployment

- [ ] All systems healthy (health check endpoint)
- [ ] Database connectivity verified
- [ ] n8n workflows executing without errors
- [ ] One full end-to-end test run (campaign launch)
- [ ] Logs scanned for errors/warnings
- [ ] 24-hour monitoring window started
- [ ] Incident response team on alert

---

## Incident Runbooks

### Incident #1: API Down (500 errors)

**Symptom:** `/api/health` returns 503 or connection timeout

**Response Time Target:** <5 minutes to identify

```
Step 1: Verify it's actually down (1 min)
├─ Check Vercel status dashboard
├─ Check uptime monitor alert
├─ Curl health endpoint from multiple locations
└─ Verify it's not your internet

Step 2: Identify root cause (2-3 min)
├─ Check Vercel deployment logs
│  └─ If recent deploy: likely app code issue
├─ Check database connectivity
│  └─ Can Vercel connect to Neon?
└─ Check environment variables
│  └─ Did they get updated correctly?

Step 3: Immediate mitigation (1-2 min)
├─ Option A: Rollback to last known good deploy
│  ├─ Vercel: Click "Rollback" on previous deployment
│  └─ Time: ~30 seconds
├─ Option B: Fix the bug and redeploy
│  ├─ If obvious fix: commit and push to main
│  └─ Time: ~2-5 minutes
└─ Option C: Disable feature with flag
│  ├─ Set feature flag false in Vercel env vars
│  ├─ Redeploy with new flag value
│  └─ Time: ~2 minutes

Step 4: Verify recovery (1 min)
├─ Health check returns 200
├─ Test API endpoint manually
├─ Monitor logs for errors
└─ 5-minute observation

Step 5: Post-incident
├─ Write incident report
├─ Add test case to prevent regression
├─ Improve rollback documentation
└─ Review Vercel logs for any patterns
```

**Runbook for common causes:**

```
If Vercel logs show "Cannot connect to database":
├─ Check DATABASE_URL is set in Vercel
├─ Check Neon is running (Neon dashboard)
├─ Check connection count (SELECT count(*) FROM pg_stat_activity)
│  └─ If >20: hit connection limit, upgrade Neon
└─ Restart Neon compute (free, takes 30s)

If Vercel logs show "require('module') is not a function":
├─ A package installation issue
├─ Solution: Clear Vercel build cache + redeploy
│  ├─ Vercel dashboard > Settings > Deploy Hooks > Clear Cache
│  └─ Redeploy

If Vercel logs show "500 Internal Server Error" with stack trace:
├─ App code has a bug
├─ Solution: Revert last change and redeploy
│  ├─ Vercel: Click "Rollback" on previous deployment
│  └─ Or: revert commit and push to main
```

### Incident #2: Database Too Slow

**Symptom:** `/api/health` returns 200 but takes >5 seconds

**Response Time Target:** <10 minutes to identify

```
Step 1: Confirm slowness (1 min)
├─ Measure latency multiple times
├─ curl -w "@curl-format.txt" /api/health
└─ If consistently >5s: database is slow

Step 2: Identify root cause (3-5 min)
├─ Check for long-running queries:
│  └─ SELECT query, now() - query_start AS elapsed
│      FROM pg_stat_activity
│      WHERE state = 'active'
│      ORDER BY elapsed DESC;
├─ Check table sizes:
│  └─ SELECT tablename, pg_size_pretty(pg_total_relation_size(...))
│      FROM pg_tables ORDER BY size DESC;
├─ Check connection count:
│  └─ SELECT count(*) FROM pg_stat_activity;

Step 3: Mitigation options (2-5 min)
├─ Option A: Kill long-running query
│  ├─ SELECT pg_terminate_backend(pid) FROM pg_stat_activity
│  └─ Only if it's a rogue/stuck query
├─ Option B: Restart Neon compute
│  ├─ Neon dashboard > Compute > Restart
│  └─ Takes ~30 seconds, clears temp state
├─ Option C: Optimize query
│  ├─ Find slow query in app code
│  ├─ Add index if missing
│  └─ Redeploy
└─ Option D: Scale Neon (if hitting limits)
│  ├─ Upgrade to Neon Pro
│  └─ ~5 minute switchover

Step 4: Verify recovery
├─ Latency drops below 1 second
├─ Monitor CPU/memory on Neon dashboard
└─ 5-minute observation

Step 5: Root cause analysis
├─ If it was a stuck query: improve query timeout handling
├─ If it was table bloat: schedule index rebuilds
├─ If it was traffic spike: plan caching strategy
```

### Incident #3: n8n Workflows Failing

**Symptom:** Campaigns launching but leads not getting outreach messages

**Response Time Target:** <15 minutes to identify and fix

```
Step 1: Verify failure (2 min)
├─ Login to n8n dashboard (http://localhost:5678)
├─ Check "Executions" tab
├─ Look for "failed" status (red)
└─ Click failed execution to see error

Step 2: Common failure causes (5 min)
├─ Webhook authentication failed
│  └─ Check: x-api-key header sent by n8n matches N8N_API_KEY in app
├─ HTTP endpoint not found
│  └─ Check: /api/campaigns/update-state exists in app
├─ Outscraper API rate limited
│  └─ Check: API quota at outscraper.com
├─ Email/Telegram credentials broken
│  └─ Check: Gmail/Telegram auth still valid in n8n credentials
└─ Data mapping error
│  └─ Check: webhook response structure changed

Step 3: Fix options (5 min)
├─ If webhook auth issue:
│  ├─ Rotate N8N_API_KEY (Vercel env vars)
│  ├─ Update n8n environment variable
│  ├─ Restart n8n (Render: Manual Restart)
├─ If API endpoint issue:
│  ├─ Verify endpoint exists: curl /api/campaigns/update-state
│  ├─ Check recent deployments for deletion
│  ├─ If deleted: restore from previous deployment
├─ If API quota issue:
│  ├─ Pause campaign outreach temporarily
│  ├─ Wait for quota reset (usually daily)
│  └─ Upgrade API tier if chronic
└─ If credential issue:
│  ├─ Re-authenticate in n8n (click credential > Connect)
│  └─ Test connection before re-enabling workflow

Step 4: Verify recovery (2 min)
├─ Manually trigger test execution:
│  ├─ In n8n UI: Workflow > Manual Execution
│  └─ Should execute without error
├─ Monitor last 5 executions
├─ Confirm email/telegram reaches target

Step 5: Post-incident
├─ Document the cause
├─ Add alerting for this failure type
├─ Improve error messages in n8n workflows
```

### Incident #4: Database Backup Failure

**Symptom:** Neon stops creating automatic backups (or you discover during test)

**Response Time Target:** <1 hour to remediate

```
Step 1: Verify backup status (5 min)
├─ Neon dashboard > Backups
├─ Check: Last backup timestamp
├─ If older than 24h: something is wrong
└─ Check: Backup size (should be >0 bytes)

Step 2: Common issues (10 min)
├─ Database too large for free tier
│  └─ Neon free: automatic backups only, not manual
├─ Neon service issue
│  └─ Check Neon status page
├─ Disk full (unlikely but possible)
│  └─ Check database size: SELECT pg_database_size(current_database());

Step 3: Mitigation (15 min)
├─ If approaching size limit:
│  ├─ Backup manually to export file:
│  │  ├─ pg_dump -U <user> -d <database> > backup.sql
│  │  └─ Upload to cloud storage (Google Drive, S3, etc)
│  ├─ Or upgrade to Neon Pro (auto handles larger dbs)
├─ If Neon service issue:
│  ├─ Wait for Neon to recover OR
│  ├─ Migrate to AWS RDS (manual, 1-2 hours)

Step 4: Test recovery (10 min)
├─ Create restore point from latest backup
├─ Verify restore can complete
├─ Document: "Backup tested [date], RTO: 15 min"

Step 5: Permanent fix
├─ If chronically failing: upgrade Neon tier
├─ If database growing too fast: archive old EventLog entries
```

---

## 90-Day Operational Roadmap

### Week 1-2: Foundation (Do immediately)

- [ ] Create `/api/health` endpoint
- [ ] Test backup restore procedure
- [ ] Document deployment order
- [ ] Create deployment checklist (above)
- [ ] Add feature flags system
- [ ] Setup `.env.example` for team

### Week 3-4: Monitoring

- [ ] Sign up for Uptime Robot (free tier)
- [ ] Add health check monitoring every 5 min
- [ ] Setup email alerts for downtime
- [ ] Create STATUS.md dashboard (manual updates)
- [ ] Document alert thresholds

### Week 5-8: First Major Change

- [ ] Execute first schema migration (with new checklist)
- [ ] Test full deployment sequence (DB → App → n8n)
- [ ] Document lessons learned
- [ ] Verify monitoring caught any issues

### Week 9-12: Automation & Documentation

- [ ] Document n8n workflows as Infrastructure as Code (JSON exports)
- [ ] Create incident runbooks (use templates above)
- [ ] Train team (if exists) on deployment process
- [ ] Setup secrets rotation schedule
- [ ] Document database growth projections

### Beyond Week 12: Scale Up

- [ ] As you hit 50-100 MAU: Add staging environment
- [ ] As you hit 200+ MAU: Upgrade Neon to Pro
- [ ] As you hit 500+ MAU: Add Redis cache
- [ ] As you hit 1K MAU: Full infrastructure refresh (Datadog, etc)

---

## Summary: What to Do Right Now

### Today (Critical)

1. **Create health check endpoint**
   ```bash
   # Add to src/app/api/health/route.ts
   # Takes 15 minutes
   ```

2. **Test database backup restore**
   ```bash
   # Neon dashboard > Backups > Create restore point
   # Verify you can access restored copy
   # Takes 20 minutes
   ```

3. **Add `.env.example`**
   ```bash
   # cp .env .env.example
   # Remove all secret values
   # Add to git
   ```

### This Week

4. **Create deployment checklist** (use one above)
   - Print or save as `/docs/DEPLOYMENT.md`

5. **Document current n8n workflows**
   - Export each workflow as JSON
   - Save to `/n8n/workflows/` directory
   - Add to git for version control

6. **Setup Uptime Robot** (free tier)
   - Add your `/api/health` endpoint
   - Setup email alerts
   - Test: Verify you get alert when endpoint down

### This Month

7. **Create incident runbook** (use templates above)
   - Save as `/docs/INCIDENTS.md`
   - Test one scenario

8. **Plan first staging environment**
   - Estimate cost: $100/month
   - Decide: implement now or at 100 MAU?

9. **Document API contract versioning**
   - Create `/src/app/api/v1/` directory
   - Plan v2 release for next major feature

---

## Cost Summary

| Item | Current | At 100 MAU | At 500 MAU | At 1K MAU |
|------|---------|-----------|-----------|-----------|
| Vercel | $0 | $0 | $0 | $20 |
| Neon PostgreSQL | $0 | $0 | $50 | $200 |
| Render (n8n) | $0 | $0 | $0 | $50 |
| Redis | - | - | $0 | $40 |
| Monitoring | $0 | $0 | $0 | $50 |
| **Total Monthly** | **$0** | **$0** | **$50** | **$360** |

**Bottom line:** Infrastructure is free until 200 MAU. After that, costs scale linearly with users. At 1K MAU, you're spending ~$0.30/user/month on infrastructure (very healthy margin).

---

## Questions?

This document answers your original 5 challenges:

1. **Multi-Service Coordination** → API versioning + deployment order checklist
2. **Database Safety** → Backup strategy + migration checklist
3. **Monitoring** → Health checks + alert thresholds + dashboard template
4. **Scaling** → Cost projections + decision tree
5. **Secrets** → Rotation schedule + access control + leakage response

Use this as your operational bible as you scale from <100 MAU to 1K+ MAU.
