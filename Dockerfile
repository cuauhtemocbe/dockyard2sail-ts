# ---------- Builder ----------
FROM node:20-alpine AS builder

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
FROM node:20-alpine AS production

RUN apk add --no-cache curl
ENV NODE_ENV=production
ENV PNPM_HOME="/home/node/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
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
