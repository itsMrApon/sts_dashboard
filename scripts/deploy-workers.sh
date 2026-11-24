#!/usr/bin/env bash
# Builds and (re)starts the voice and scrape workers on the server, next to the web app.
#
#   scripts/deploy-workers.sh                 all workers
#   scripts/deploy-workers.sh voice-agent     just one (or: scrape-agent)
#   scripts/deploy-workers.sh status          what's running, health and recent logs
#
# Uses the `sts` Docker context (images are built on the server) and deploy/workers.compose.yml.
# The workers and the app share the private network `sts-net`; scripts/deploy.sh joins the app to it.
#
# Overrides (env): DOCKER_CONTEXT=sts  ENV_FILE=.env.production
set -Eeuo pipefail

CONTEXT="${DOCKER_CONTEXT:-sts}"
ENV_FILE="${ENV_FILE:-.env.production}"
NETWORK="sts-net"

cd "$(git rev-parse --show-toplevel)"

log() { printf '\033[1m==>\033[0m %s\n' "$*" >&2; }
die() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }
d() { docker --context "$CONTEXT" "$@"; }
compose() { d compose --env-file "$ENV_FILE" -f deploy/workers.compose.yml "$@"; }

[[ -f "$ENV_FILE" ]] || die "env file not found: $ENV_FILE (set ENV_FILE=...)"

if [[ "${1:-}" == "status" ]]; then
  compose ps
  for name in sts-voice-agent sts-scrape-agent sts-jobs-worker; do
    log "$name (last 5 log lines)"
    d logs --tail 5 "$name" 2>&1 || true
  done
  exit 0
fi

d network inspect "$NETWORK" >/dev/null 2>&1 || { log "Creating network $NETWORK"; d network create "$NETWORK" >/dev/null; }

log "Building and starting ${*:-all workers} on '$CONTEXT'"
compose up -d --build --remove-orphans "$@"

log "Waiting for health checks"
deadline=$((SECONDS + 180))
for name in sts-voice-agent sts-scrape-agent; do
  [[ $# -gt 0 && " $* " != *" ${name#sts-} "* ]] && continue
  while :; do
    status="$(d inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null || echo missing)"
    [[ "$status" == "healthy" ]] && { log "$name is healthy"; break; }
    if (( SECONDS > deadline )) || [[ "$status" == "unhealthy" || "$status" == "missing" ]]; then
      d logs --tail 40 "$name" >&2 || true
      die "$name is $status"
    fi
    sleep 5
  done
done

# The jobs worker has no health endpoint: check it is running and show what it said.
if [[ $# -eq 0 || " $* " == *" jobs-worker "* ]]; then
  sleep 5
  [[ "$(d inspect -f '{{.State.Running}}' sts-jobs-worker 2>/dev/null)" == "true" ]] || { d logs --tail 40 sts-jobs-worker >&2 || true; die "sts-jobs-worker is not running"; }
  log "sts-jobs-worker is running: $(d logs --tail 1 sts-jobs-worker 2>&1)"
fi

if ! d inspect -f '{{json .NetworkSettings.Networks}}' sts-ai 2>/dev/null | grep -q "\"$NETWORK\""; then
  printf '\033[33mNote:\033[0m the app container is not on %s yet; run scripts/deploy.sh (it joins it).\n' "$NETWORK" >&2
fi
log "Workers are up"
