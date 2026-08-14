# ---------- Builder ----------
FROM node:26-alpine AS builder

RUN apk add --no-cache git
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# corepack is no longer bundled with the Node image as of node:26 — install
# pnpm directly via npm instead (works identically on every Node line).
RUN npm install -g pnpm@9.0.0

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
FROM node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66 AS production

RUN apk add --no-cache curl
ENV NODE_ENV=production
ENV PNPM_HOME="/home/nodeuser/.local/share/pnpm"
ENV PATH="$PNPM_HOME/bin:$PNPM_HOME:$PATH"
ENV PORT=8080

# corepack is no longer bundled with the Node image as of node:26 — install
# pnpm directly via npm instead (works identically on every Node line).
# Pinned well ahead of the builder stage's pnpm@9.0.0 (which tracks
# packageManager for lockfile-resolution parity): this pnpm only ever runs
# `pnpm add -g serve` and is discarded before the image ships, so it's pinned
# purely to whatever version has zero known HIGH/CRITICAL CVEs in itself and
# its bundled deps (tar, glob, minimatch, cross-spawn, ...) — verify with
# `trivy image` after bumping (issue #56).
RUN npm install -g pnpm@11.21.0

# Create user without privileges
RUN adduser -D -u 10001 nodeuser

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodeuser:nodeuser /app/dist ./dist

# Install a simple HTTP server
RUN pnpm add -g serve

# Remove npm/npx — the base image bundles them, but this project uses pnpm
# exclusively and nothing at runtime (serve, a standalone pnpm-installed
# binary) shells out to them. Less attack surface, fewer bundled CVEs.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

USER nodeuser

EXPOSE 8080

# Health check
# Explicit `sh -c "..."` (not a plain executable array) so ${PORT:-8080} is
# expanded by the shell at container start — a plain exec-form array
# (e.g. ["curl", "-f", "http://localhost:8080/"]) never goes through a shell,
# so $PORT substitution silently never happens there. See CMD below for the
# same reasoning.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["sh", "-c", "curl -f http://localhost:${PORT:-8080}/ || exit 1"]

# Explicit `sh -c "..."` so ${PORT:-8080} expands at container start, honoring
# PORT when the platform injects one (e.g. cloud hosts assigning a dynamic
# port) and falling back to 8080 when it's unset — matches ENV PORT=8080
# above. The previous plain exec-form array (`["serve", "-s", "dist", "-l",
# "8080"]`) never went through a shell, so `$PORT` substitution never happened
# even with ENV PORT=8080 set.
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
