# DevOps Quick Reference Card

**Print this and keep it handy!**

---

## Emergency Actions

### API is Down (500 errors)
```
1. Check Vercel dashboard
2. Try rollback: Previous deployment > Rollback
3. Check database: Neon console, is it running?
4. If still down: Restart Neon compute
5. Monitor: curl /api/health every minute
```

### Database Connection Errors
```
1. Check connections: SELECT count(*) FROM pg_stat_activity
2. If >18/20: problem
3. Solution: Neon dashboard > Compute > Restart
4. Or: Upgrade Neon tier (if frequent)
```

### n8n Workflows Failing
```
1. Login to n8n: localhost:5678
2. Check Executions tab for red errors
3. Check error message (API key? 404? Timeout?)
4. Fix: Re-authenticate credentials or update API URL
5. Restart n8n: Render dashboard > Manual Restart
```

### Can't Deploy
```
1. Check build error: Vercel dashboard > Deployments
2. Common: TypeScript error → npm run build (local)
3. Common: npm dependency → npm install
4. Common: Migration locked → npx prisma migrate resolve
5. Push to main (automatic deployment)
```

### Disk Space Issues
```
1. Check table sizes:
   SELECT tablename, pg_size_pretty(pg_total_relation_size(...))
2. If EventLog >2GB: Archive old records
3. If storage >90%: Upgrade Neon tier
4. Monitor: Weekly check of sizes
```

---

## Daily Tasks (2 minutes)

```
☐ Check Uptime Robot: Any alerts?
  └─ https://uptimerobot.com
☐ Check email: Any error notifications?
☐ Health check: curl /api/health
```

---

## Weekly Tasks (10 minutes)

```
☐ Review error logs (Vercel, n8n)
☐ Check database connections: SELECT count(*)...
☐ Check storage: SELECT pg_database_size(...)
☐ Update docs/STATUS.md
☐ Monitor workflow success rates
```

---

## Monthly Tasks (15 minutes)

```
☐ Review uptime stats (Uptime Robot dashboard)
☐ Check dependency updates
☐ Review infrastructure costs
☐ Plan infrastructure upgrades (at what MAU?)
☐ Test database backup restore
```

---

## Important URLs

| Service | URL |
|---------|-----|
| Vercel Dashboard | https://vercel.com/dashboard |
| Neon Console | https://console.neon.tech |
| Render Dashboard | https://render.com/dashboard |
| n8n Workflows | localhost:5678 |
| Uptime Robot | https://uptimerobot.com |
| Health Endpoint | https://your-domain.com/api/health |
| GitHub Repo | https://github.com/your-repo |
| Stripe Dashboard | https://dashboard.stripe.com |
| Clerk Dashboard | https://dashboard.clerk.com |

---

## Environment Variables

### Production (Vercel)
```
DATABASE_URL              Neon connection string
CLERK_SECRET_KEY         From Clerk dashboard
STRIPE_API_KEY           From Stripe dashboard
LIVEKIT_API_KEY          From LiveKit console
LIVEKIT_API_SECRET       From LiveKit console
N8N_API_KEY              Custom, rotate quarterly
```

### n8n (Render)
```
APP_URL                  https://your-domain.com
N8N_API_KEY              Must match Vercel
OUTSCRAPER_API_KEY       From Outscraper
```

### Local Development
```
DATABASE_URL             test connection string
# Other vars from .env.example
```

---

## Database Queries

### Check Health
```sql
-- Connection count
SELECT count(*) FROM pg_stat_activity;

-- Table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(...))
FROM pg_tables ORDER BY size DESC;

-- Database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Slow queries
SELECT query, now() - query_start FROM pg_stat_activity
WHERE state = 'active' ORDER BY query_start;
```

### Kill Hung Query
```sql
-- Find the problematic query
SELECT pid, query, query_start FROM pg_stat_activity
WHERE state = 'active' AND query_start < now() - interval '30 seconds';

-- Kill it
SELECT pg_terminate_backend(PID);  -- Replace PID with actual ID
```

---

## Deployment Flow

```
1. npm run build          (verify locally)
2. git add, commit        (create changes)
3. git push origin main   (automatic Vercel deployment)
4. Wait 2-5 minutes       (Vercel builds and deploys)
5. Verify:
   ├─ Vercel dashboard shows green
   ├─ curl /api/health returns 200
   └─ Manual test: 1 user action
6. Monitor logs for 15 minutes
7. If issues: Rollback (Vercel dashboard)
```

---

## Secrets Rotation (Quarterly)

### Rotation Schedule
```
Every 90 days:
□ Stripe API keys (create new in Stripe, update app, delete old)
□ Clerk secret (rotate in Clerk dashboard)
□ N8N_API_KEY (update Vercel + Render)
□ LIVEKIT_API_SECRET (rotate in LiveKit)
□ Third-party keys (Vapi, ElevenLabs, etc)

Also rotate:
□ When developer leaves
□ If key is suspected leaked
□ If account is compromised
```

---

## Scaling Thresholds

```
Users | Action
------|--------
100   | Monitor only
200   | Upgrade Neon ($50/mo)
500   | Add Redis cache ($20/mo)
1000  | Upgrade Vercel Pro ($20/mo)
      | Move EventLog to ClickHouse
1000+ | Full infrastructure review
      | Consider Datadog monitoring
```

---

## SLA Targets

```
Metric              | Current | Target | 1K MAU
--------------------|---------|--------|----------
API Uptime          | 99.9%   | 99%    | 99.5%
Database Latency P99| <200ms  | <500ms | <100ms
n8n Success Rate    | 95%     | 95%    | 98%
Backup RTO          | 15min   | 1h     | 30min
Data Loss (RPO)     | 24h     | 24h    | 1h
```

---

## Alert Severity Levels

### Critical (Page Immediately)
- API down (health check 503 for >1 min)
- Database unreachable
- Payment processing broken

### Warning (Email within hour)
- Error rate >1%
- Latency spike >2 sec
- n8n success rate <90%
- Connection count >18/20

### Info (Daily digest)
- Traffic metrics
- Successful deployments
- Workflow execution counts

---

## Common Error Messages

| Error | Meaning | Fix |
|-------|---------|-----|
| `Cannot connect to database` | Neon down or creds wrong | Check Neon status, verify URL |
| `401 Unauthorized` | API key invalid | Check/rotate API key |
| `404 Not Found` | Endpoint doesn't exist | Check endpoint is deployed |
| `502 Bad Gateway` | Server error | Check logs, restart service |
| `503 Service Unavailable` | All requests failing | Check Vercel/Neon status |
| `TimeoutError` | Request too slow | Check database, restart compute |
| `ENOSPC` (no space) | Disk full | Check storage, upgrade tier |

---

## Incident Report Template

```
# Incident: [Date] [Service] [Issue]

## Timeline
- HH:MM UTC: Detected
- HH:MM UTC: Diagnosed
- HH:MM UTC: Fixed

## Impact
- Duration: X minutes
- Users affected: N/A
- Data loss: None

## Root Cause
[What actually happened]

## Fix
[What was done]

## Prevention
[To prevent next time]

## Action Items
- [ ] Task 1
- [ ] Task 2
```

---

## Useful Commands

```bash
# Check build locally
npm run build

# Run tests
npm test

# Generate new migration
npx prisma migrate dev --name "description"

# Apply migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Reset database (dev only!)
npx prisma migrate reset

# View database
npx prisma studio

# Deploy checklist
bash scripts/deployment-checklist.sh

# View git log
git log --oneline -20

# Create tag
git tag release/v1.2.3

# View current status
git status
```

---

## Support Contacts

| Service | Status | Support |
|---------|--------|---------|
| Vercel | https://vercel.statuspage.io | Dashboard chat |
| Neon | https://status.neon.tech | Dashboard > Help |
| Render | https://status.render.com | Dashboard > Help |
| Stripe | https://status.stripe.com | Stripe dashboard |
| Clerk | https://clerk.statuspage.io | Clerk dashboard |

---

## Last Updated
April 5, 2026

## Next Review
July 5, 2026 (Quarterly)

---

**Keep this card in:**
- Your desk drawer (print)
- Your phone (screenshot)
- Your Slack (bookmark)
- Your docs (docs/QUICK_REFERENCE.md)
