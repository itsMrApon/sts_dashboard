#!/usr/bin/env bash
# Deploys sts-ai to the server through the `sts` Docker context, tied to a git commit.
#
#   scripts/deploy.sh                  build + deploy the current commit of main
#   scripts/deploy.sh list             show images on the server and which one is live
#   scripts/deploy.sh rollback <sha>   run an older image again (no rebuild)
#
# Guards: you must be on main, with no uncommitted/untracked changes, and in sync with
# origin/main, so every deploy matches a commit anyone can check out.
#
# Images are tagged sts-ai:<12-char sha> (and :latest). The new container must answer
# /api/health with 200 within HEALTH_TIMEOUT seconds, or the previous container is restored.
#
# Overrides (env): DOCKER_CONTEXT=sts  ENV_FILE=.env.production  DEPLOY_BRANCH=main
#   HEALTH_TIMEOUT=120  KEEP_IMAGES=5  REBUILD=1 (rebuild an existing sha)
#   ALLOW_ANY_BRANCH=1 (hotfix from another pushed branch)
#
# Note: rollback does not undo Prisma migrations. Keep migrations additive (add first,
# drop in a later deploy) so the previous image still works against the new schema.
set -Eeuo pipefail

APP_NAME="sts-ai"
IMAGE="sts-ai"
PREVIOUS_NAME="${APP_NAME}-previous"
PUBLISH="127.0.0.1:3020:3000"
# Private network shared with the voice and scrape workers (scripts/deploy-workers.sh):
# the app reaches the scrape worker at http://sts-scrape-agent:8100, the voice worker reaches it at http://sts-ai:3000.
NETWORK="sts-net"
CONTEXT="${DOCKER_CONTEXT:-sts}"
ENV_FILE="${ENV_FILE:-.env.production}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
KEEP_IMAGES="${KEEP_IMAGES:-5}"

cd "$(git rev-parse --show-toplevel)"

log() { printf '\033[1m==>\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[33mWarning:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }
d() { docker --context "$CONTEXT" "$@"; }
container_exists() { d container inspect "$1" >/dev/null 2>&1; }
image_exists() { d image inspect "$1" >/dev/null 2>&1; }

require_env_file() {
  [[ -f "$ENV_FILE" ]] || die "env file not found: $ENV_FILE (set ENV_FILE=...)"
}

# Refuse to deploy anything that is not an exact, pushed commit.
check_git() {
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$branch" != "$DEPLOY_BRANCH" && "${ALLOW_ANY_BRANCH:-}" != "1" ]]; then
    die "on branch '$branch'. Deploy from '$DEPLOY_BRANCH' (merge your PR first), or set ALLOW_ANY_BRANCH=1 for a hotfix."
  fi

  if [[ -n "$(git status --porcelain)" ]]; then
    git status --short >&2
    die "uncommitted or untracked changes. Commit or stash them first."
  fi

  log "Checking origin/$branch"
  git fetch --quiet origin "$branch" 2>/dev/null || die "branch '$branch' is not on origin. Push it first."
  local head remote
  head="$(git rev-parse HEAD)"
  remote="$(git rev-parse "origin/$branch")"
  if [[ "$head" != "$remote" ]]; then
    if git merge-base --is-ancestor HEAD "origin/$branch"; then
      die "behind origin/$branch. Run: git pull"
    fi
    die "local commits not on origin/$branch. Run: git push"
  fi
}

# Exit code 0 once /api/health answers 200 from inside the container.
wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) code restarts
  log "Waiting up to ${HEALTH_TIMEOUT}s for /api/health (migrations run first)"
  while (( SECONDS < deadline )); do
    restarts="$(d inspect -f '{{.RestartCount}}' "$APP_NAME" 2>/dev/null || echo 0)"
    if [[ "$restarts" != "0" ]]; then
      warn "container crashed and restarted ($restarts times)"
      return 1
    fi
    code="$(d exec "$APP_NAME" node -e \
      "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(5000)}).then(r=>process.stdout.write(String(r.status))).catch(()=>process.stdout.write('000'))" \
      2>/dev/null || echo 000)"
    if [[ "$code" == "200" ]]; then
      return 0
    fi
    sleep 3
  done
  return 1
}

# Put the container that was live before this run back in place. Safe to call twice.
restore_previous() {
  trap - INT TERM ERR
  if ! container_exists "$PREVIOUS_NAME"; then
    warn "no previous container to restore"
    return 0
  fi
  log "Restoring previous container"
  d rm -f "$APP_NAME" >/dev/null 2>&1 || true
  d rename "$PREVIOUS_NAME" "$APP_NAME"
  d update --restart unless-stopped "$APP_NAME" >/dev/null
  d start "$APP_NAME" >/dev/null
  log "Previous version is running again"
}

# Swap the live container to $1, keeping the old one stopped until the new one is healthy.
swap_to() {
  local image="$1"

  if container_exists "$PREVIOUS_NAME"; then
    if container_exists "$APP_NAME"; then
      d rm -f "$PREVIOUS_NAME" >/dev/null
    else
      die "'$PREVIOUS_NAME' exists but '$APP_NAME' does not (an earlier deploy was interrupted). Restore it with: docker --context $CONTEXT rename $PREVIOUS_NAME $APP_NAME && docker --context $CONTEXT start $APP_NAME"
    fi
  fi

  trap 'restore_previous; exit 1' INT TERM ERR

  if container_exists "$APP_NAME"; then
    log "Stopping current container (kept as $PREVIOUS_NAME)"
    d stop "$APP_NAME" >/dev/null
    d rename "$APP_NAME" "$PREVIOUS_NAME"
    # So a server reboot mid-deploy doesn't start both and clash on the port.
    d update --restart no "$PREVIOUS_NAME" >/dev/null
  fi

  d network inspect "$NETWORK" >/dev/null 2>&1 || d network create "$NETWORK" >/dev/null

  log "Starting $image"
  d run -d --name "$APP_NAME" --restart unless-stopped -p "$PUBLISH" --network "$NETWORK" --env-file "$ENV_FILE" "$image" >/dev/null

  if wait_healthy; then
    trap - INT TERM ERR
    d rm "$PREVIOUS_NAME" >/dev/null 2>&1 || true
    log "Live: $image"
    return 0
  fi

  warn "new container is not healthy. Last 40 log lines:"
  d logs --tail 40 "$APP_NAME" >&2 || true
  restore_previous
  die "deploy of $image failed; previous version restored"
}

# The Inngest jobs worker runs the app's code from the app's image, so after a swap it is
# recreated on the same image (only when it was deployed: scripts/deploy-workers.sh jobs-worker).
refresh_jobs_worker() {
  local image="$1"
  d inspect sts-jobs-worker >/dev/null 2>&1 || return 0
  log "Restarting the jobs worker on $image"
  JOBS_IMAGE="$image" d compose --env-file "$ENV_FILE" -f deploy/workers.compose.yml up -d --no-deps --force-recreate jobs-worker >/dev/null 2>&1 \
    || warn "the jobs worker did not restart; run scripts/deploy-workers.sh jobs-worker"
}

# Keep the newest KEEP_IMAGES sha-tagged images, never the live one.
prune_images() {
  local live_tag="$1" tag
  d images "$IMAGE" --format '{{.Tag}}' \
    | grep -E '^[0-9a-f]{12}$' \
    | tail -n +"$((KEEP_IMAGES + 1))" \
    | while read -r tag; do
        [[ "$tag" == "$live_tag" ]] && continue
        log "Removing old image $IMAGE:$tag"
        d rmi "$IMAGE:$tag" >/dev/null 2>&1 || true
      done
}

cmd_deploy() {
  require_env_file
  check_git

  local full_sha sha branch image
  full_sha="$(git rev-parse HEAD)"
  sha="${full_sha:0:12}"
  branch="$(git rev-parse --abbrev-ref HEAD)"
  image="$IMAGE:$sha"

  log "Deploying $sha: $(git log -1 --format=%s)"

  if image_exists "$image" && [[ "${REBUILD:-}" != "1" ]]; then
    log "Image $image already on the server, skipping build (REBUILD=1 to force)"
  else
    DOCKER_CONTEXT="$CONTEXT" ENV_FILE="$ENV_FILE" scripts/docker-build.sh \
      -t "$image" -t "$IMAGE:latest" \
      --label "org.opencontainers.image.revision=$full_sha" \
      --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --label "sts.deploy.branch=$branch" \
      .
  fi

  swap_to "$image"
  refresh_jobs_worker "$image"
  prune_images "$sha"

  cat >&2 <<EOF

Deployed $image.
Mark the release if it's one you'll want to find later:
  git tag v<x.y.z> $sha && git push --tags
Roll back:
  scripts/deploy.sh rollback <older-sha>   (see: scripts/deploy.sh list)
EOF
}

cmd_rollback() {
  local ref="${1:-}" full tag
  [[ -n "$ref" ]] || die "usage: scripts/deploy.sh rollback <sha>  (see: scripts/deploy.sh list)"
  require_env_file

  if full="$(git rev-parse --verify --quiet "$ref^{commit}")"; then
    tag="${full:0:12}"
  else
    tag="$ref"
  fi
  image_exists "$IMAGE:$tag" || die "image $IMAGE:$tag is not on the server. Run: scripts/deploy.sh list"

  warn "rollback does not undo database migrations"
  log "Rolling back to $IMAGE:$tag${full:+ ($(git log -1 --format=%s "$full"))}"
  swap_to "$IMAGE:$tag"
  refresh_jobs_worker "$IMAGE:$tag"
}

cmd_list() {
  local live_id="" id tag created subject marker
  live_id="$(d inspect -f '{{.Image}}' "$APP_NAME" 2>/dev/null || true)"
  live_id="${live_id#sha256:}"
  printf '%-4s %-14s %-16s %s\n' "" "TAG" "BUILT" "COMMIT" >&2
  d images "$IMAGE" --format '{{.ID}}|{{.Tag}}|{{.CreatedSince}}' | while IFS='|' read -r id tag created; do
    marker=""
    [[ -n "$live_id" && "$live_id" == "$id"* ]] && marker="LIVE"
    subject=""
    if [[ "$tag" =~ ^[0-9a-f]{12}$ ]]; then
      subject="$(git log -1 --format=%s "$tag" 2>/dev/null || echo '(commit not in local repo)')"
    fi
    printf '%-4s %-14s %-16s %s\n' "$marker" "$tag" "$created" "$subject"
  done
  # The live image may have lost its tag (e.g. :latest moved to a newer build).
  if [[ -n "$live_id" ]] && ! d images "$IMAGE" --format '{{.ID}}' | grep -q "^${live_id:0:12}"; then
    printf '%-4s %-14s %-16s %s\n' "LIVE" "<untagged>" "" "image ${live_id:0:12}, built before deploy.sh" >&2
  fi
}

case "${1:-deploy}" in
  deploy) cmd_deploy ;;
  rollback) shift; cmd_rollback "$@" ;;
  list) cmd_list ;;
  -h|--help|help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "unknown command '$1'. Use: deploy | list | rollback <sha>" ;;
esac
