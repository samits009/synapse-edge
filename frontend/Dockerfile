# Use Node 20 alpine as base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ── NEXT_PUBLIC_ variables ──────────────────────────────────────────────
# These are PUBLIC client-side keys baked into the browser JS bundle.
# They are NOT secrets — they are visible in the browser DevTools anyway.
# They MUST be present at build time for Next.js static page generation.
ENV NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyASKb9Bh9bfyt8DC53Z3zc8SqmTsy62Gss
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=synapse-edge-5322a.firebaseapp.com
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=synapse-edge-5322a
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=synapse-edge-5322a.firebasestorage.app
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=595062003787
ENV NEXT_PUBLIC_FIREBASE_APP_ID=1:595062003787:web:ae52c3c6b9f5ee595755ce

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output folder and static files
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
