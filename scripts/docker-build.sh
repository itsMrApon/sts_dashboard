#!/usr/bin/env bash
# Builds the Docker image with every NEXT_PUBLIC_* value from an env file as a --build-arg
# (Next inlines them at build time; Clerk needs its publishable key to prerender).
# Secrets are never passed: only NEXT_PUBLIC_* lines are read.
#
#   DOCKER_CONTEXT=sts scripts/docker-build.sh -t sts-ai .
#   ENV_FILE=.env.production DOCKER_CONTEXT=sts scripts/docker-build.sh \
#     --build-arg NEXT_PUBLIC_APP_URL=https://sudotechserve.com -t sts-ai .
#
# Extra --build-arg flags you pass come after the file's, so they win.
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"
DOCKER="${DOCKER:-docker}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE (set ENV_FILE=...)" >&2
  exit 1
fi

build_args=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#export }"
  [[ "$line" =~ ^NEXT_PUBLIC_[A-Z0-9_]+= ]] || continue
  key="${line%%=*}"
  value="${line#*=}"
  # Strip one pair of surrounding quotes.
  if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then
    value="${BASH_REMATCH[1]}"
  fi
  build_args+=(--build-arg "$key=$value")
done < "$ENV_FILE"

if [[ ${#build_args[@]} -eq 0 ]]; then
  echo "No NEXT_PUBLIC_* values in $ENV_FILE" >&2
  exit 1
fi

context_args=()
if [[ -n "${DOCKER_CONTEXT:-}" ]]; then
  context_args=(--context "$DOCKER_CONTEXT")
fi

echo "Passing $(( ${#build_args[@]} / 2 )) NEXT_PUBLIC_* build args from $ENV_FILE" >&2
exec "$DOCKER" ${context_args[@]+"${context_args[@]}"} build "${build_args[@]}" "$@"
