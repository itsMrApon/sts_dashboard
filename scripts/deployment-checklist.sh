#!/usr/bin/env bash
# deployment-checklist.sh
# Run this before any production deployment
# Usage: bash deployment-checklist.sh

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        STS-AI Production Deployment Checklist              ║"
echo "║         Pre-deployment verification script                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"

CHECKS_PASSED=0
CHECKS_FAILED=0

check() {
    local description=$1
    local command=$2

    echo ""
    echo "▶ $description"

    if eval "$command" > /dev/null 2>&1; then
        echo "  ✓ PASS"
        ((CHECKS_PASSED++))
    else
        echo "  ✗ FAIL"
        ((CHECKS_FAILED++))
    fi
}

# Pre-deployment checks
echo ""
echo "════ Code Quality ════"

check "Git status clean" "git status --porcelain | wc -l | grep -q '^0$'"
check "No uncommitted changes" "git diff --quiet"
check "Current branch is main" "git rev-parse --abbrev-ref HEAD | grep -q '^main$'"
check ".env in .gitignore" "grep -q '^\.env' .gitignore"

echo ""
echo "════ Secrets & Security ════"

check "No API keys in recent commits" "! git log --oneline -20 | grep -i 'key\|secret' || true"
check "No .env file in git history" "! git log --all --full-history -S 'DATABASE_URL' -- '.env*' | head -1"

echo ""
echo "════ Dependencies ════"

check "Package.json exists" "test -f package.json"
check "Node modules installed" "test -d node_modules"
check "Prisma client generated" "test -d node_modules/.prisma/client"

echo ""
echo "════ Build & Tests ════"

check "Build succeeds" "npm run build > /dev/null 2>&1"

echo ""
echo "════ Database ════"

check "Prisma migrations exist" "test -d prisma/migrations"
check "Database schema file exists" "test -f prisma/schema.prisma"

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Deployment Summary                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"

TOTAL=$((CHECKS_PASSED + CHECKS_FAILED))
echo ""
echo "  ✓ Passed: $CHECKS_PASSED / $TOTAL"
if [ $CHECKS_FAILED -gt 0 ]; then
    echo "  ✗ Failed: $CHECKS_FAILED / $TOTAL"
    echo ""
    echo "❌ Deployment BLOCKED - Fix failures above"
    exit 1
else
    echo ""
    echo "✅ All checks passed! Ready for deployment"
    echo ""
    echo "Next steps:"
    echo "  1. Create git tag: git tag release/v$(date +%Y%m%d)"
    echo "  2. Push to main: git push origin main"
    echo "  3. Deploy to staging (if applicable)"
    echo "  4. Verify /api/health returns 200"
    echo "  5. Monitor logs for 15 minutes"
    exit 0
fi
