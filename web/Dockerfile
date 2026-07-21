# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Vitrine publique (Next.js 14, output: standalone).
#
# ⚠️ Les NEXT_PUBLIC_* sont figées AU BUILD (cf. web/.env.example). Elles doivent
# donc être fournies en --build-arg avec les VRAIES URLs de prod, sinon le build
# échoue volontairement (SITE_URL localhost) ou l'app pointe vers du localhost.
#   docker build \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://humanbcorp.com \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.humanbcorp.com \
#     --build-arg NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.humanbcorp.com \
#     -t humanbcorp-vitrine ./web
# ---------------------------------------------------------------------------

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DASHBOARD_URL
ARG NEXT_PUBLIC_REVALIDATE=60
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_DASHBOARD_URL=$NEXT_PUBLIC_DASHBOARD_URL \
    NEXT_PUBLIC_REVALIDATE=$NEXT_PUBLIC_REVALIDATE \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# public/ (dont le service worker PWA généré) + sortie standalone + assets statiques
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
