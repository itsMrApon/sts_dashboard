# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the browser bundle by `next build`, and Clerk needs its
# publishable key to prerender, so they must be passed at build time (--build-arg / Coolify
# "build variables"). They are public by design; real secrets stay runtime-only.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/callback
ARG NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/callback
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/home
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/home
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_STS_AI_URL
ARG NEXT_PUBLIC_STS_SITE_KEY
ARG NEXT_PUBLIC_STREAM_API_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_STRIPE_CLIENT_ID
ARG NEXT_PUBLIC_STRIPE_SUBSCRIPTION_PRICE_ID
ARG NEXT_PUBLIC_LIVEKIT_CONNECTION_ENDPOINT
ARG NEXT_PUBLIC_DEFAULT_LLM_MODEL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL \
    NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL \
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_STS_AI_URL=$NEXT_PUBLIC_STS_AI_URL \
    NEXT_PUBLIC_STS_SITE_KEY=$NEXT_PUBLIC_STS_SITE_KEY \
    NEXT_PUBLIC_STREAM_API_KEY=$NEXT_PUBLIC_STREAM_API_KEY \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_STRIPE_CLIENT_ID=$NEXT_PUBLIC_STRIPE_CLIENT_ID \
    NEXT_PUBLIC_STRIPE_SUBSCRIPTION_PRICE_ID=$NEXT_PUBLIC_STRIPE_SUBSCRIPTION_PRICE_ID \
    NEXT_PUBLIC_LIVEKIT_CONNECTION_ENDPOINT=$NEXT_PUBLIC_LIVEKIT_CONNECTION_ENDPOINT \
    NEXT_PUBLIC_DEFAULT_LLM_MODEL=$NEXT_PUBLIC_DEFAULT_LLM_MODEL
# Fail in seconds, not after a full build, when the build args were not passed.
RUN test -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" || { \
      echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. Build with scripts/docker-build.sh (reads NEXT_PUBLIC_* from .env) or pass --build-arg." >&2; \
      exit 1; }
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules ./node_modules
# The app runs as `nextjs` and writes .next/cache (fetch cache, optimized images), so it owns .next.
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run migrations then start (Coolify can also run migrate as a separate pre-deploy command)
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
