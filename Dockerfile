# ---------- Builder ----------
FROM node:22-alpine AS builder

RUN apk add --no-cache git
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run typecheck && pnpm run build

# ---------- Production ----------
# Pinned by digest for byte-for-byte reproducible builds (Dockerfile.dev intentionally
# stays on the floating tag — see practices reference). Refresh with:
#   docker pull node:22-alpine && docker inspect --format='{{index .RepoDigests 0}}' node:22-alpine
# Dependabot (.github/dependabot.yml, docker ecosystem) keeps this from going stale automatically.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS production

RUN apk add --no-cache curl
ENV NODE_ENV=production
ENV PNPM_HOME="/home/nodeuser/.local/share/pnpm"
ENV PATH="$PNPM_HOME/bin:$PNPM_HOME:$PATH"
ENV PORT=8080

RUN corepack enable && corepack prepare pnpm@latest --activate

# Create user without privileges
RUN adduser -D -u 10001 nodeuser

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodeuser:nodeuser /app/dist ./dist

# Install a simple HTTP server
RUN pnpm add -g serve

USER nodeuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1

CMD ["serve", "-s", "dist", "-l", "8080"]
