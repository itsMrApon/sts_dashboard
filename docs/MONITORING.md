# Monitoring Setup Guide

**Status:** Ready to implement immediately
**Estimated Time:** 30 minutes total
**Cost:** $0 (first 90 days)

---

## Overview

You'll implement 3 levels of monitoring:

1. **Tier 1: Health Checks (FREE)** - Basic endpoint monitoring
2. **Tier 2: Uptime Monitoring (FREE)** - 5-minute polling with email alerts
3. **Tier 3: Logs & Dashboards (Optional, $20-50/month)** - Advanced later

---

## Tier 1: Health Check Endpoint (5 minutes)

Already created in `src/app/api/health/route.ts`

### Deploy it

```bash
# 1. The file is already there, just deploy
git add src/app/api/health/route.ts
git commit -m "Add: Health check endpoint"
git push origin main

# 2. Wait for Vercel deployment (~2 min)

# 3. Test it
curl https://your-domain.com/api/health

# Expected output:
# {
#   "api": "healthy",
#   "database": "healthy",
#   "timestamp": "2026-04-05T10:30:00Z",
#   "uptime": 3600,
#   "duration_ms": 45
# }
```

### What it checks

- ✓ API is running
- ✓ Database is reachable
- ✓ Response time (<5 seconds)
- ✓ Proper JSON response

### How to interpret results

```
Status 200 + database=healthy → Everything OK
Status 200 + database=unhealthy → Database issue only
Status 503 → API or database down
Timeout (no response) → API completely down
Response time >5 seconds → Something is slow
```

---

## Tier 2: Uptime Robot Monitoring (10 minutes)

Uptime Robot is free, monitors your health endpoint every 5 minutes, alerts you if it goes down.

### Setup

1. Go to https://uptimerobot.com
2. Sign up (free account)
3. Click "Add New Monitor"
4. Select:
   - **Monitor Type:** HTTPS
   - **URL:** `https://your-domain.com/api/health`
   - **Check Interval:** 5 minutes (free tier default)
   - **Name:** "STS-AI API Health"

5. Click "Create Monitor"
6. Wait ~1 minute for first check
7. Should show "Up" (green)

### Alert Configuration

1. Click: Menu > Notification Settings
2. Add Alert Contact:
   - **Email:** your-email@gmail.com
   - **Threshold:** Alert after 1 failed check (=5 minutes down)

3. Back to Monitor, click "Edit"
4. Set alerts: ✓ All notification types
5. Save

### Test It Works

```bash
# 1. Stop your API temporarily (kill Vercel)
#    (Just kidding, don't actually do this)
#
# 2. Or simulate failure: temporarily return 503 from /api/health
#    Update the code to return 503, deploy, wait 5 min
#    You should get alert email
#
# 3. Fix the code, redeploy
#    Alert says it's back up
```

### What Uptime Robot monitors

- ✓ Response time (tracks average, max, min)
- ✓ Status codes (alerts if not 200)
- ✓ Response content (optional regex matching)
- ✓ SSL certificate expiry
- ✓ Downtime history (useful for SLA reporting)

---

## Tier 3: Log Aggregation (Optional, for later)

When you hit 100+ MAU and logs become hard to track across platforms.

### Option A: Axiom (Recommended for you)

```
Cost: Free tier up to 100 GB/month
Best for: SaaS applications like yours
Setup time: 15 minutes

What it collects:
├─ Vercel app logs
├─ n8n workflow logs (via webhook)
├─ Custom app logs
└─ Queryable dashboard
```

**Setup later when needed:**
```bash
# 1. Sign up: https://axiom.co
# 2. Create dataset called "production"
# 3. Add Vercel integration:
#    ├─ Axiom dashboard > Integrations > Vercel
#    └─ Follow OAuth flow
# 4. Test: Generate logs in app, see them in Axiom within 30s
# 5. Create dashboard: query your logs
```

### Option B: Datadog (Professional monitoring)

```
Cost: $15-50/month per host
Best for: Enterprise applications
Setup time: 1 hour
Features: APM, metrics, traces, security

Only needed at 500+ MAU
```

---

## Monitoring Dashboard (Manual, Free)

Create a simple status dashboard in Markdown:

### File: `docs/STATUS.md`

```markdown
# STS-AI System Status

**Last Updated:** 2026-04-05 14:30 UTC
**Status:** ✅ All Systems Operational

## Incident-Free Streak
🔥 32 days without critical incident

## API Health
- Endpoint: https://your-domain.com/api/health
- Status: ✅ Healthy
- Response Time: 45ms (average)
- Uptime (30d): 99.98%
- Last Incident: March 3 (database connection pool exhausted)

## Database Health
- Service: Neon PostgreSQL
- Status: ✅ Healthy
- Connections: 8 / 20 (free tier)
- Storage: 2.5 GB / 3 GB (free tier)
- Last Backup: 2026-04-05 02:00 UTC
- Backup Tested: 2026-04-03 (restore successful, RTO: 15min)

## n8n Workflows (Render)
- Service: ✅ Running
- Uptime: 99.9%
- Executions (24h): 156 total, 152 successful (97.4%)
- Failed: 4 (1 Outscraper timeout, 3 email sends)
- Avg Execution Time: 2.3 minutes

## External Integrations
- Stripe Webhooks: ✅ All delivered
- Clerk Authentication: ✅ Working
- Stream.io Video: ✅ Operational
- LiveKit: ✅ Agents operational
- Telegram: ✅ Messages delivering
- Email: ✅ SMTP working

## Known Issues
- None currently

## Upcoming Maintenance
- None scheduled this week

## Metrics (24-hour window)
| Metric | Value | Target |
|--------|-------|--------|
| API Error Rate | 0.02% | <0.1% |
| Database Latency (P99) | 85ms | <500ms |
| Workflow Success Rate | 97.4% | >95% |
| n8n Uptime | 99.9% | >99% |

## Contact
- On-Call: your-email@gmail.com
- Issues: Create GitHub issue
- Slack: #devops-alerts (when team grows)

---

**Update this dashboard:**
- Daily: Check/update status
- Weekly: Update metrics
- Monthly: Write incident summary
```

**Update process:**
```bash
# Weekly status update
git pull origin main
# Update docs/STATUS.md
# Keep it automated? (see Tier 3 for dashboards)

# Commit changes
git add docs/STATUS.md
git commit -m "Update: System status dashboard"
git push origin main
```

---

## Monitoring Checklist (Daily/Weekly)

### Daily (30 seconds)

```
☐ Check Uptime Robot: any alerts?
  └─ https://uptimerobot.com
☐ Check Vercel: any failed deployments?
  └─ https://vercel.com/dashboard
☐ Check email: any alerts?
  └─ Search: "health", "down", "error"
```

### Weekly (5 minutes)

```
☐ Review error logs
  ├─ Vercel: Functions > Logs
  ├─ n8n: Executions tab
  └─ Check for patterns
☐ Check database stats
  ├─ Size: SELECT pg_database_size(...)
  ├─ Connections: SELECT count(*) FROM pg_stat_activity
  └─ Any concerning growth?
☐ Update STATUS.md dashboard
  └─ New metrics, incidents resolved, etc
☐ Test health endpoint manually
  └─ curl https://your-domain.com/api/health
```

### Monthly (15 minutes)

```
☐ Review SLA/uptime for month
  └─ Uptime Robot shows this
☐ Check for deprecation warnings
  └─ Dependencies, API versions, etc
☐ Plan for next quarter
  └─ At current growth, when to upgrade infrastructure?
☐ Review this monitoring guide
  └─ Update with lessons learned
```

---

## Alerting Philosophy

**At <100 MAU:**
- Alert only on critical (API down, database down)
- Too many alerts = alert fatigue = ignore them

**At 100-500 MAU:**
- Add warnings (error rate >1%, latency >1s)
- Setup Slack integration (if team exists)

**At 500+ MAU:**
- Full monitoring (Datadog or similar)
- On-call rotation
- SLA targets defined and tracked

---

## Common Alert Scenarios

### Scenario: Got "API Down" alert at 3 AM

```
Step 1: Verify it's real (1 min)
├─ Curl health endpoint from phone
├─ Check Uptime Robot dashboard
├─ Try accessing app in browser

Step 2: Quick diagnosis (2 min)
├─ Check Vercel status page
├─ Check Neon status page
├─ Check recent deployments

Step 3: Decide if urgent (30s)
├─ If Vercel issue: wait for status update (usually fixed in <15 min)
├─ If database issue: try restart (can wait til morning if not critical)
├─ If code issue: rollback to previous version

Step 4: Act (3-10 min)
├─ If clear fix: apply it
├─ If unclear: document and investigate in morning
└─ Verify fixed, then sleep

Total time: <20 min, usually <5 min
```

### Scenario: Database latency alert (P99 > 500ms)

```
Step 1: Confirm (1 min)
├─ Run: SELECT now() - query_start FROM pg_stat_activity
├─ Check if any query >10 seconds

Step 2: Diagnosis (2 min)
├─ Check table sizes: too much data?
├─ Check connections: too many concurrent?
├─ Check CPU: Neon dashboard

Step 3: Quick fix (1-5 min)
├─ Restart database (often helps)
├─ Or: optimize slow query (add index, add LIMIT)
└─ Or: wait and monitor (might be one-time spike)

Step 4: Long-term fix
├─ If recurring: upgrade Neon tier
├─ If slow query: add caching layer
└─ If table bloat: archive old data
```

---

## Cost of Monitoring Stack

| Tool | Tier | Cost | When to use |
|------|------|------|-----------|
| Uptime Robot | Free | $0 | Now (critical) |
| Vercel Logs | Included | $0 | Now (included) |
| Neon Logs | Included | $0 | Now (included) |
| STATUS.md | DIY | $0 | Now (manual) |
| Axiom | Free tier | $0 | At 100 MAU |
| Datadog | Pro | $15+/month | At 500+ MAU |
| PagerDuty | Team tier | $50+/month | At 1K+ MAU (on-call) |

**At <100 MAU: $0/month for monitoring**

---

## What You're Monitoring For

**Availability:**
- Is the API up? (health check)
- Is the database responding? (health check)
- Are n8n workflows executing? (n8n Executions tab)

**Performance:**
- How fast is the API? (response time in Uptime Robot)
- Is the database slow? (query latency)
- Are workflows taking too long? (execution time)

**Errors:**
- Are there 5xx errors? (check logs)
- Are workflows failing? (n8n Executions)
- Are API keys invalid? (check logs for 401s)

**Capacity:**
- How many database connections? (before hitting limit)
- How much storage? (before quota exceeded)
- How many concurrent users? (before performance degrades)

---

## Going Deeper (Advanced)

If you want more sophisticated monitoring later:

### Query-based alerting (Axiom)

```
Alert if: error_rate > 1% in last 5 min
Alert if: response_time_p99 > 1000ms in last 5 min
Alert if: workflow_failure_rate > 5% in last 1h
```

### Distributed tracing (Datadog)

```
See every request:
├─ Which services it hits
├─ How long each service took
├─ Where it failed (if failed)
└─ Useful for debugging complex flows
```

### Continuous profiling

```
Find memory leaks, CPU hogs
├─ Which function is slow?
├─ Which query is being called 10M times?
└─ Optimize the hotspots
```

---

## Next Steps

### Week 1: Do Today (5 min)
- [ ] Vercel: Deploy `/api/health` endpoint
- [ ] Test it: `curl https://your-domain.com/api/health`

### Week 2: Setup Monitoring (10 min)
- [ ] Sign up for Uptime Robot
- [ ] Add health endpoint check
- [ ] Setup email alerts
- [ ] Test: Verify you get alert email

### Week 3: Create Dashboard (5 min)
- [ ] Create `docs/STATUS.md`
- [ ] Add manual update to weekly routine

### Week 4-12: Observe & Learn
- [ ] Check Uptime Robot daily
- [ ] Update dashboard weekly
- [ ] Document any incidents
- [ ] When ready: Move to Tier 3 (Axiom, Datadog)

---

## Support

**If monitoring isn't working:**

1. Check Uptime Robot configuration
   - Right URL? (should have `https://`)
   - Check is enabled? (toggle should be ON)
   - Check interval set? (default 5 min)

2. Test health endpoint manually
   ```bash
   curl -i https://your-domain.com/api/health
   # Should return 200
   ```

3. Check email filters
   - Uptime Robot emails might be in spam
   - Add to contacts: support@uptimerobot.com

4. Verify Vercel deployment
   - Check deployment succeeded
   - Check function isn't throwing error

---

**Last Updated:** April 5, 2026
**Next Review:** July 5, 2026
