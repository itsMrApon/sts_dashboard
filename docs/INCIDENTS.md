# Incident Response Runbook

**Last Updated:** April 5, 2026
**Maintainer:** DevOps Team
**On-Call Rotation:** As needed (no formal rotation at <100 MAU)

---

## Table of Contents

1. [API Down](#incident-api-down)
2. [Database Slow](#incident-database-slow)
3. [n8n Workflows Failing](#incident-n8n-workflows-failing)
4. [Database Backup Failed](#incident-database-backup-failed)
5. [Memory/Resource Exhaustion](#incident-memory-exhaustion)
6. [Deployment Failed](#incident-deployment-failed)
7. [Security Incident (Leaked Secret)](#incident-security-leaked-secret)

---

## Incident: API Down

**Severity:** CRITICAL
**Time to Detect:** <5 minutes (Uptime Robot alert)
**Time to Resolve:** <10 minutes (if rollback), <30 minutes (if fix needed)

### Symptoms

- Health check endpoint (`/api/health`) returns 503 or timeout
- Uptime monitor sends alert
- Users cannot access application
- Vercel shows red status on dashboard

### Quick Diagnosis (2 minutes)

```bash
# Step 1: Verify the problem
curl -v https://your-app.com/api/health
# Expected: 200 with {"api":"healthy","database":"healthy"}
# Actual: 503 or connection refused

# Step 2: Check Vercel status
# Open: https://vercel.com/dashboard
# Look for red deployment indicator
# Check: Recent deployments tab

# Step 3: Check database
# Open: https://console.neon.tech
# Verify: Database is running
# Verify: Connection count <20
```

### Root Cause Identification (2-3 minutes)

| Symptom | Root Cause | Check |
|---------|-----------|-------|
| Vercel shows failed deployment | Bad code in last commit | Check Vercel build log |
| Deployment succeeded but 503 | Database connection issue | Can Vercel connect to Neon? |
| Intermittent 503 (flaky) | Connection pool exhausted | SELECT count(*) FROM pg_stat_activity |
| 503 + high CPU on Vercel | Code has infinite loop or memory leak | Check Vercel logs for stack trace |

### Resolution Options (in order of speed)

#### Option A: Rollback (Fastest, 1 minute)

```bash
# If last deployment caused the issue:
# 1. Open Vercel dashboard
# 2. Click on failed deployment
# 3. Click "Rollback" button
# 4. Wait for rollback to complete (~30 seconds)
# 5. Verify health check returns 200
# 6. Resume investigating root cause
```

#### Option B: Restart Database (2 minutes)

```bash
# If database is hung:
# 1. Open Neon console
# 2. Click on your project > Compute
# 3. Click "Restart" button
# 4. Wait for restart (~30 seconds)
# 5. Test health check
```

#### Option C: Fix & Redeploy (5-15 minutes)

```bash
# If the issue is identifiable and fixable:
# 1. Identify the bad code in logs
# 2. Fix locally
# 3. Test: npm run build && npm run test
# 4. Commit: git commit -m "Fix: [issue]"
# 5. Push: git push origin main
# 6. Wait for Vercel deployment
# 7. Verify health check
```

### Verification (1 minute)

```bash
# 1. Health check returns 200
curl -w "\nStatus: %{http_code}\n" https://your-app.com/api/health

# 2. Database is responsive
# (Automated in health check)

# 3. One quick manual test
# Login to app and create a campaign (or simplest user action)

# 4. Monitor logs for errors
# Vercel dashboard: Functions > Logs
# Look for new errors in last 5 minutes

# 5. Set alert observation timer
# Watch for 15 minutes for recurrence
```

### Post-Incident

- [ ] Write incident report (What happened? How to prevent?)
- [ ] Add regression test to prevent this exact issue
- [ ] If rollback was needed: Fix the issue properly and redeploy tomorrow
- [ ] Update runbook if this revealed new patterns

---

## Incident: Database Slow

**Severity:** HIGH
**Time to Detect:** <5 minutes (health check latency spikes)
**Time to Resolve:** <15 minutes

### Symptoms

- Health check returns 200 but takes >5 seconds
- API endpoints return 200 but slowly
- Users report "page loads slowly"
- Vercel response time metrics spike
- Database CPU is >80%

### Quick Diagnosis (2 minutes)

```bash
# Step 1: Measure current latency
for i in {1..5}; do
  curl -w "Request $i: %{time_total}s\n" https://your-app.com/api/health
done

# Step 2: Check database connections
# Connect to Neon:
psql postgresql://username:password@host.db.neon.tech/database
SELECT count(*) FROM pg_stat_activity;
# If >18/20: approaching connection limit

# Step 3: Check for long-running queries
SELECT query, now() - query_start AS elapsed
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY elapsed DESC
LIMIT 10;

# If any query >10 seconds: something is slow
```

### Root Cause Identification (3-5 minutes)

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| One query taking 30+ seconds | Missing index, table scan on 10M+ rows | Add index, restart Neon compute |
| Connection count = 20/20 | Connection leak in app | Rollback, check connection pooling |
| CPU 100%, many queries | Traffic spike + N+1 queries | Upgrade Neon, optimize queries |
| Disk full (unlikely) | EventLog table bloated | Archive old records |

### Resolution Options

#### Option A: Kill Long-Running Query (1 minute)

```bash
# Only if there's a rogue query stuck:
SELECT pid, query, state
FROM pg_stat_activity
WHERE state = 'active'
AND query_start < now() - interval '30 seconds';

# Kill the stuck query:
SELECT pg_terminate_backend(12345); -- Replace 12345 with PID
```

#### Option B: Restart Database (2 minutes)

```bash
# This clears temp state and reconnects:
# 1. Neon dashboard > Compute > Restart button
# 2. Wait ~30 seconds for restart
# 3. Re-measure latency

# Why this often fixes things:
# - Clears connection cache
# - Resets statistics
# - Kills rogue queries
```

#### Option C: Add Missing Index (5-10 minutes)

```bash
# If slow query is obvious (e.g., EventLog scan):
EXPLAIN ANALYZE SELECT * FROM "EventLog" WHERE "userId" = '...';
-- If shows: Seq Scan, not Index Scan → missing index

-- Add index:
CREATE INDEX CONCURRENTLY idx_eventlog_userid ON "EventLog"("userId");

-- Verify:
EXPLAIN SELECT * FROM "EventLog" WHERE "userId" = '...';
-- Should now show: Index Scan
```

#### Option D: Upgrade Neon (5 minutes)

```bash
# If connection limit hit:
# 1. Neon dashboard > Plan
# 2. Upgrade to Pro ($50/month, 100 connections)
# 3. Apply immediately
# 4. Re-measure latency
```

### Verification (2 minutes)

```bash
# 1. Latency drops below 1 second
for i in {1..3}; do
  curl -w "%{time_total}s\n" https://your-app.com/api/health
done

# 2. No long-running queries
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
# Should be <5

# 3. CPU below 50%
# (Check Neon dashboard)

# 4. Monitor for 5 minutes
# Verify slowness doesn't return
```

### Post-Incident

- [ ] If you added an index: note it in database maintenance log
- [ ] If you restarted: monitor connection count next week
- [ ] If you upgraded: celebrate! You're scaling
- [ ] Implement query caching if this keeps happening

---

## Incident: n8n Workflows Failing

**Severity:** HIGH (users can't launch campaigns)
**Time to Detect:** <15 minutes (workflow execution monitoring)
**Time to Resolve:** <20 minutes (usually credential fix)

### Symptoms

- Campaign launches but leads don't get messages
- n8n Executions show "Failed" status
- Error message in n8n: "HTTP request failed" or "Authentication failed"
- No emails/Telegrams being sent

### Quick Diagnosis (5 minutes)

```bash
# Step 1: Login to n8n
# Open http://localhost:5678 (or your Render instance)
# Click: Executions tab

# Step 2: Find failed execution
# Look for red icon, click to view details
# Note the error message

# Step 3: Identify the failing node
# Error message shows which step failed, e.g.:
# "Error at HTTP Request 'Update State': 401 Unauthorized"
# This means the webhook auth failed
```

### Root Cause by Error Message

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | API key wrong or expired | Check x-api-key header matches app N8N_API_KEY |
| `404 Not Found` | Webhook URL changed | Check /api/campaigns/update-state endpoint exists |
| `429 Too Many Requests` | Rate limited | Increase wait time between requests |
| `Network error: timeout` | Request too slow | Check database is responsive |
| `Error: Authentication failed` | Gmail/Telegram credentials expired | Re-authenticate in n8n > Credentials |

### Resolution by Root Cause

#### If API Authentication Failed

```bash
# 1. Check current API key in app
grep N8N_API_KEY .env
# Note the value

# 2. Check n8n environment variables
# Render dashboard > Environment tab
# Verify: N8N_API_KEY matches above

# 3. If different: update n8n env var
# Render dashboard > N8N_API_KEY > Edit
# Paste the correct value
# Click "Save"

# 4. Restart n8n
# Render dashboard > Manual Restart button

# 5. Test workflow
# In n8n: Select workflow > Manual Execution
# Should complete without error
```

#### If Endpoint Not Found (404)

```bash
# 1. Check endpoint exists
curl -X POST https://your-app.com/api/campaigns/update-state \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{"test": "data"}'

# If 404: endpoint missing
# If 401: endpoint exists but auth failed
# If 200: endpoint is fine (error was elsewhere)

# 2. If 404: Check recent deployment
# Vercel dashboard > Deployments
# If recent deploy removed endpoint: rollback

# 3. If endpoint correct: update n8n workflow
# Copy correct webhook URL
# Update HTTP Request node in workflow
```

#### If Credentials Expired (Gmail/Telegram)

```bash
# 1. n8n dashboard > Credentials tab
# 2. Find the credential (Gmail, Telegram, etc)
# 3. Click: Connect / Re-authenticate
# 4. Follow provider's auth flow
# 5. Save and re-test workflow
```

### Verification (3 minutes)

```bash
# 1. Manually run test workflow
# n8n: Select workflow > Manual Execution
# Should complete successfully

# 2. Check execution details
# No errors in logs
# All nodes show green checkmarks

# 3. Test end-to-end
# If possible: create test campaign with 1 lead
# Verify: lead receives message (email/telegram)

# 4. Monitor for 10 minutes
# n8n Executions tab
# Verify: no new failures
```

### Post-Incident

- [ ] Document what failed and why
- [ ] Check if credentials need rotation (security review)
- [ ] If authentication keeps failing: automate key rotation
- [ ] Add monitoring for workflow error rate

---

## Incident: Database Backup Failed

**Severity:** CRITICAL (data loss risk)
**Time to Detect:** Once per day (daily backup check)
**Time to Resolve:** <1 hour

### Symptoms

- No backup created today (Neon dashboard)
- Last backup is >24 hours old
- Backup size is 0 bytes or suspiciously small

### Quick Diagnosis (5 minutes)

```bash
# Step 1: Check Neon dashboard
# Navigate to: https://console.neon.tech
# Project > Backups

# Look for:
# - Last backup timestamp (should be today)
# - Backup size (should be >500MB for your current data)
# - Backup status (should be "Completed" or "In Progress")

# Step 2: Verify database size
psql postgresql://user:pass@host.db.neon.tech/database
SELECT pg_size_pretty(pg_database_size(current_database()));
# Note the size
```

### Root Cause Identification (5 minutes)

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| No backup today | Neon service issue | Wait for recovery, contact Neon support |
| Last backup 48h old | Free tier (daily backups only) | Upgrade to Neon Pro for more frequent backups |
| Backup size = 0 bytes | Database corruption | Restart database, check table integrity |
| Database size > free limit | Too much data | Archive old records or upgrade tier |

### Resolution Options

#### Option A: Manual Backup Export (10 minutes)

```bash
# If automated backups failing, create manual backup:
pg_dump -h host.db.neon.tech \
        -U user \
        -d database \
        --format=custom \
        > backup_20260405.dump

# Then upload somewhere safe:
# Google Drive, AWS S3, Dropbox, etc.

# To restore this backup:
# pg_restore -h newhost -U user -d database backup_20260405.dump
```

#### Option B: Test Restore Point (15 minutes)

```bash
# Even if automated backups work, verify they're restorable:
# 1. Neon dashboard > Backups > Create restore point
# 2. Create a test database from this point
# 3. Connect to restored database
psql postgresql://user:pass@restored-host.db.neon.tech/restored-db
# 4. Run sanity checks
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Campaign";
SELECT COUNT(*) FROM "CampaignLead";
# 5. Verify numbers match production
# 6. Delete test database
```

#### Option C: Upgrade to Neon Pro (5 minutes)

```bash
# If backups are critical and failing:
# 1. Neon dashboard > Plan
# 2. Upgrade to Pro
# 3. More frequent backups = better protection
# 4. Larger storage limits
```

### Verification (10 minutes)

```bash
# 1. Manual backup created
# Check file size:
ls -lh backup_*.dump

# 2. Test restore works
# Create restore point and test connection

# 3. Verify database integrity
# Run sanity queries

# 4. Document
# Create/update file: docs/BACKUP_STATUS.md
# Record: "Backup tested [date], RTO: 15 min, RPO: <24h"
```

### Post-Incident

- [ ] If free tier insufficient: upgrade to Pro
- [ ] If automated backups broken: setup manual daily backup script
- [ ] Test restore procedure at least weekly
- [ ] Document RTO/RPO in operations manual

---

## Incident: Memory/Resource Exhaustion

**Severity:** CRITICAL
**Time to Detect:** <5 minutes (health check fails or slow)
**Time to Resolve:** <15 minutes

### Symptoms

- API returns 503: "out of memory"
- Vercel functions timeout (>30 seconds)
- n8n workflows stop executing
- System becomes unresponsive

### Quick Diagnosis (2 minutes)

```bash
# Step 1: Identify which service
# Vercel: Check dashboard > Functions > Logs
# n8n: Check Render logs
# Database: Check Neon dashboard

# Step 2: Check resource usage
# Vercel: Automatic scaling, shows usage in logs
# n8n: Render dashboard > Metrics tab
# Database: Neon dashboard > Monitoring
```

### Root Cause (by service)

#### Vercel (Node.js app)

```bash
# Common causes:
# 1. Memory leak in code (infinite array growth)
#    → Look for: loops that append without clearing
# 2. Large data operation (loading 10M rows into memory)
#    → Look for: SELECT * without LIMIT
# 3. Dependency bloat (too many npm packages)
#    → Check: npm ls | wc -l

# Fix:
# 1. If code issue: rollback to previous version
# 2. If data issue: optimize query (add LIMIT)
# 3. If bloat: reduce dependencies, redeploy
```

#### n8n (Render)

```bash
# Common causes:
# 1. Recursive workflow (workflow calls itself)
# 2. Large data processing (loading 1M records)
# 3. Too many concurrent executions

# Fix:
# 1. Check workflow for loops
# 2. Add Split in Batches node to process data slowly
# 3. Upgrade Render tier to handle more memory
```

#### Database (Neon)

```bash
# Common causes:
# 1. Memory cache too large
# 2. Many concurrent connections
# 3. Large query trying to sort 10M rows in memory

# Fix:
# 1. Restart database (clears cache)
# 2. Check SELECT count(*) FROM pg_stat_activity
#    Kill unnecessary connections
# 3. Optimize slow query, add indexes
```

### Resolution

#### Quick Fix (1-3 minutes)

```bash
# For Vercel:
# Restart function by redeploying
git commit --allow-empty -m "Restart: clear memory"
git push origin main

# For n8n:
# Render dashboard > Manual Restart

# For Neon:
# Neon dashboard > Compute > Restart
```

#### Deeper Investigation (5-15 minutes)

```bash
# Identify which operation caused explosion
# Look at logs for what was happening when it started
# If code: rollback to previous version
# If query: optimize or add index
# If workflow: simplify logic
```

### Verification (2 minutes)

```bash
# 1. Service responsive again
curl https://your-app.com/api/health

# 2. Resource metrics normal
# Vercel: memory usage <200MB
# n8n: memory <400MB
# Neon: cache stable

# 3. Test basic operation
# Create campaign or simple action
```

### Post-Incident

- [ ] Identify root cause
- [ ] Fix permanently (code, query, logic)
- [ ] Add monitoring for memory usage
- [ ] If happening frequently: upgrade resource tier

---

## Incident: Deployment Failed

**Severity:** HIGH (can't ship changes)
**Time to Detect:** Immediate (during push/deployment)
**Time to Resolve:** <20 minutes

### Symptoms

- `git push origin main` fails
- Vercel build fails
- Prisma migration fails
- Error message in deploy logs

### Quick Diagnosis (by error type)

```bash
# 1. Git push fails
git push origin main
# Error: "permission denied" → check SSH keys
# Error: "conflicts" → resolve merge conflicts locally

# 2. Vercel build fails
# Check Vercel dashboard > Deployments > [failed deployment]
# Look for error in "Build" tab
# Common: "Cannot find module", "TypeScript errors", "npm install failed"

# 3. Prisma migration fails
npx prisma migrate deploy
# Error: "Field not found" → schema mismatch
# Error: "Timeout" → database locked
# Error: "Syntax error" → bad migration SQL
```

### Common Failures & Fixes

| Error | Root Cause | Fix |
|-------|-----------|-----|
| `TypeScript error` | Code has type issues | Fix TypeScript errors locally, rebuild, push |
| `Cannot find module` | npm dependency missing | Run `npm install` locally, push lockfile |
| `Port already in use` | Service already running | Kill existing process or restart |
| `Migration timeout` | Database locked | Restart database, wait 1 min, redeploy |
| `Permission denied (publickey)` | SSH key issue | Regenerate GitHub deploy key |

### Resolution by Error

#### TypeScript Errors

```bash
# Fix locally
npm run build
# Read error messages, fix code

# Verify
npm run build # should succeed

# Commit and push
git add -A
git commit -m "Fix: TypeScript errors"
git push origin main
```

#### Missing Dependencies

```bash
# Reinstall
npm install

# Verify
npm run build

# Commit lockfile
git add package-lock.json
git commit -m "Update: npm dependencies"
git push origin main
```

#### Database Migration Locked

```bash
# Check what's happening
psql postgresql://user:pass@host.db.neon.tech/database
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC;

# If stuck migration:
# Option A: Restart database
#   Neon dashboard > Compute > Restart

# Option B: Manual cleanup (risky)
#   DELETE FROM "_prisma_migrations" WHERE status = 'Rolling back';
#   npx prisma migrate resolve --rolled-back <migration_name>

# Then retry deploy
npx prisma migrate deploy
```

### Verification (2 minutes)

```bash
# 1. Deployment succeeded
# Vercel dashboard shows green checkmark

# 2. Build completed
# Build log shows: "Build completed successfully"

# 3. Health check works
curl https://your-app.com/api/health

# 4. No new errors in logs
# Vercel dashboard > Functions > Logs (last 5 min)
```

### Post-Incident

- [ ] Document the error and fix
- [ ] If it's a recurring error: add test to catch it locally
- [ ] Update deployment checklist if needed

---

## Incident: Security - Leaked Secret

**Severity:** CRITICAL
**Time to Detect:** Ideally immediately via monitoring; realistically days later
**Time to Resolve:** <1 hour (for rotation)

### Symptoms

- Secret found in public GitHub history
- API calls using old credentials succeed from unknown source
- Suspicious activity on integrated service (Stripe, Clerk, etc)
- Security scanner alerts about exposed secret

### Immediate Response (10 minutes)

```bash
# Step 1: IMMEDIATELY rotate the secret
# Example: If DATABASE_URL leaked

# Create new database (or new connection in Neon)
# Copy new connection string
# Update Vercel environment variable
# Update Render environment variable (if needed)
# Redeploy app and n8n

# Step 2: Verify new secret works
# Test app functions normally
# Test n8n workflows execute

# Step 3: Revoke old secret
# If it's an API key: delete it
# If it's a password: mark as compromised in service
```

### Investigate Scope (10-15 minutes)

```bash
# Step 1: Find what was exposed
git log --all -S "STRIPE_SECRET_KEY" --oneline
# Shows all commits containing the string

# Step 2: How long was it exposed?
git show <commit>
# Check: When was it added? When was it removed?
# Exposure window = time between add and removal

# Step 3: Who had access?
# If in git history: anyone who cloned before removal
# If on GitHub: anyone who searched GitHub
# If in logs: any service that ingested logs

# Step 4: Check for abuse
# Example: Stripe → check for unauthorized charges
# Example: Database → check audit log for unauthorized queries
```

### Remediation Steps

```bash
# Step 1: Remove from git history (if there)
git log --all --full-history -p -S "API_KEY_VALUE" -- . | head -100
# Identify the commits

# Option A: If recent
git rebase -i <commit-before-leak>
# Mark the commit as "drop"
git push -f origin main

# Option B: If far back
# Use BFG tool (safer than rebase -i)
bfg --delete-files 'FILE_WITH_SECRET' .

# Step 2: Force-push (⚠️ destructive)
git push -f origin main
# Everyone who cloned before this must re-clone

# Step 3: Even safer: assume compromise
# Treat as if everyone with repo access has the old secret
# Rotate not just this secret, but all related ones
```

### Verification (5 minutes)

```bash
# 1. New secret works in app
# Deploy and verify health check

# 2. Old secret no longer valid
# Try using old key
curl -H "Authorization: Bearer $OLD_KEY" https://api.stripe.com
# Should return: 401 or similar error

# 3. Check service audit logs
# Stripe dashboard > Logs
# Check for unusual activity in window when key was exposed
```

### Post-Incident (security)

- [ ] Document: What was exposed, when, how long
- [ ] File incident report (if customer data involved)
- [ ] Notify affected customers (required by law if PII exposed)
- [ ] Implement secret scanning in CI/CD:
  ```bash
  # Add to GitHub Actions:
  - name: Scan for secrets
    uses: trufflesecurity/trufflehog@main
    with:
      path: ./
      base: ${{ github.event.repository.default_branch }}
  ```
- [ ] Implement pre-commit hook:
  ```bash
  npm install husky@latest --save-dev
  # Configure: block commits with secrets
  ```

---

## When to Escalate

**If you can't fix it in 30 minutes:**

1. **Contact Vercel Support** (if Vercel issue)
   - Status: https://vercel.statuspage.io
   - Support: https://vercel.com/support

2. **Contact Neon Support** (if database issue)
   - Status: https://status.neon.tech
   - Support: In Neon dashboard

3. **Contact Render Support** (if n8n/server issue)
   - Status: https://status.render.com
   - Support: In Render dashboard

4. **Check Status Pages**
   - https://status.stripe.com (if Stripe integration issue)
   - https://clerk.statuspage.io (if Clerk issue)
   - https://status.discord.com (if messaging issue)

---

## Incident Template

Copy this for every incident you respond to:

```markdown
# Incident Report: [Date] [Service] [Issue]

## Timeline
- 13:45 UTC: Incident detected (alert or report)
- 13:47 UTC: Diagnosis started
- 14:02 UTC: Root cause identified
- 14:10 UTC: Fix deployed
- 14:12 UTC: Verified resolved

## Impact
- Duration: 17 minutes
- Affected users: N/A (small user base)
- Data loss: None
- Severity: HIGH

## Root Cause
[What actually caused it]

## Resolution
[What was done to fix it]

## Prevention
[What will prevent this in future]

## Action Items
- [ ] Task 1
- [ ] Task 2
```

---

## Quick Reference Card (Print this!)

```
╔════════════════════════════════════════════╗
║      STS-AI Incident Response Guide        ║
╚════════════════════════════════════════════╝

API DOWN?
├─ Check Vercel dashboard
├─ Verify database is running (Neon)
├─ Try: Rollback last deployment
└─ If still down: Restart database

DATABASE SLOW?
├─ Check connections: SELECT count(*) FROM pg_stat_activity
├─ Look for queries >10s
├─ Try: Restart compute
└─ If persists: Upgrade Neon tier

n8n FAILING?
├─ Check executions tab for error
├─ Verify API authentication
├─ Re-authenticate credentials
└─ If still failing: Restart n8n

OUT OF MEMORY?
├─ Identify which service
├─ Quick fix: Restart that service
└─ Deep fix: Find memory leak in logs

CAN'T DEPLOY?
├─ Check TypeScript errors
├─ Verify npm install
├─ Check database migration status
└─ Use Vercel rollback if needed

SECRET LEAKED?
├─ IMMEDIATELY rotate the secret
├─ Remove from git history (git push -f)
├─ Check for abuse in service logs
└─ Document what happened

UNKNOWN ERROR?
├─ Check logs in: Vercel, Neon, Render dashboards
├─ Search for error message online
├─ Try: Restart the service
└─ If blocked: Contact platform support
```

---

## Resources

- **Vercel Status:** https://vercel.statuspage.io
- **Neon Console:** https://console.neon.tech
- **Render Dashboard:** https://render.com/dashboard
- **n8n Docs:** https://docs.n8n.io
- **Prisma Docs:** https://www.prisma.io/docs

---

**Last Updated:** April 5, 2026
**Next Review:** July 5, 2026 (quarterly)
