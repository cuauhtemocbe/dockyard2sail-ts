---
title: Dynamic Port Binding in Production Container
status: completed
created: 2026-08-13
updated: 2026-08-13
issue: #46
---

# Dynamic Port Binding in Production Container

## Objective

Make the production Docker image's `CMD` actually honor the `PORT` environment variable at container start, so the image can be deployed to cloud hosts that inject a dynamic port without failing.

## Context

- `Dockerfile`'s production stage sets `ENV PORT=8080` and `EXPOSE 8080`, but the current `CMD ["serve", "-s", "dist", "-l", "8080"]` uses exec form with the port hardcoded as a literal argument.
- Exec-form `CMD` arrays (`["executable", "arg1", "arg2"]`) do not go through a shell, so `$PORT`-style substitution never happens even though `ENV PORT=8080` is set — the `8080` in `CMD` is just a string, disconnected from the `ENV` line above it. Setting `PORT=3000` at `docker run` time today has zero effect on which port `serve` binds to.
- This breaks deployment on any platform that assigns a container a dynamic port via `PORT` (a common convention, e.g. Heroku-style buildpacks, some PaaS/cloud run targets) — the app keeps listening on 8080 while the platform routes traffic to the port it told the container to use, causing failed health checks / unreachable deploys.
- Found via an audit of this repo against `development-standards.md` (dockyard2sail-ts previously audited 2025-07-27; the `dev-standards-gap` label already exists in this repo for findings of this kind).
- The suggested fix in the issue is to switch to shell-form `CMD`, e.g. `CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]`, which does go through a shell and therefore does expand `$PORT`, defaulting to 8080 when unset.
- The existing `HEALTHCHECK` (`CMD curl -f http://localhost:8080/ || exit 1`) also hardcodes port 8080. **Decision**: this spec fixes `HEALTHCHECK` in the same change (see Open Questions §1) — leaving it hardcoded would defeat the purpose of the fix, since any container run with a non-default `PORT` would report unhealthy despite serving traffic correctly.

## Requirements

### Functional Requirements

- [ ] Production stage `CMD` uses shell form so `$PORT` is expanded at container start (e.g. `CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]`)
- [ ] Running the container without setting `PORT` results in `serve` listening on port 8080 (preserves current default behavior)
- [ ] Running the container with `PORT=<N>` set (any valid port, e.g. 3000) results in `serve` listening on port `<N>`
- [ ] `HEALTHCHECK` also uses shell form with `${PORT:-8080}` expansion, so `docker inspect`'s reported health status stays accurate regardless of which `PORT` the container was run with
- [ ] Behavior is verified by an automated smoke test that builds the production image and exercises both the default and the injected-port scenarios (see Testing Strategy)
- [ ] A static, Docker-build-free check fails if the production `CMD` line reverts to hardcoded exec form (fast-feedback regression guard)

### Non-Functional Requirements

- [ ] Reliability: no regression to the container's current default (unset `PORT` → 8080) — existing deployments that don't set `PORT` must keep working unchanged
- [ ] Maintainability: the fix stays a minimal, localized change to the production stage of `Dockerfile` — no new runtime dependencies introduced
- [ ] CI coverage: the new behavior is checked automatically on every push (not only on `main`), per the issue's Definition of Done — see Open Questions for exactly where this runs

## Architecture

### Components

- `Dockerfile` (production stage only) — `CMD` instruction changes from exec form to shell form with `${PORT:-8080}` expansion. `ENV PORT=8080`, `EXPOSE 8080`, and the builder stage are unaffected.
- A new smoke-test script (e.g. `scripts/docker-port-smoke-test.sh`) — builds the production image once, then runs it twice (once with no `PORT` override, once with `PORT` set to a non-default value) and asserts each container answers on the expected port.
- CI/`make validate` wiring for the new script — exact location is an open question (see below).

### Data Model

Not applicable — no persisted data or schema involved. The only "state" is the `PORT` environment variable read at container start.

### External Dependencies

- `serve` (already an existing runtime dependency, installed globally in the production stage via `pnpm add -g serve`) — no version change required; only how it's invoked changes.
- Docker CLI — required by the smoke-test script to build and run the image (already assumed available in CI, since `Dockerfile` presumably isn't otherwise validated by `make validate` today — confirm no existing image-build step exists to avoid duplicating one).

## User Stories

See GitHub issue #46 body — User Story and Gherkin acceptance criteria are used verbatim as the source for this spec, not duplicated here.

## Testing Strategy

### Unit Tests
Not directly applicable to a Dockerfile instruction change — there's no TypeScript unit under test here. (See Open Questions for whether a lightweight non-Docker test, e.g. asserting the literal `CMD` string in `Dockerfile` uses shell form, should exist as a fast-feedback complement to the smoke test.)

### Integration Tests
The smoke-test script is the primary verification mechanism:
- Build the production image from `Dockerfile`.
- Scenario 1 (default): run the container with no `PORT` set, wait for it to be ready, `curl`/request `http://localhost:8080/` (mapped from the container's default), assert HTTP 200.
- Scenario 2 (injected): run the container with `PORT=3000` (or another non-default value) set, map that same port on the host, `curl`/request `http://localhost:3000/`, assert HTTP 200.
- Clean up containers/images started by the script regardless of pass/fail.

### E2E Tests
Not applicable — this is infrastructure/deployment behavior, not application UI/user-flow behavior.

### Performance Tests
Not applicable — no performance requirement in scope.

## Boundaries & Constraints

### In Scope
- Changing the production stage `CMD` in `Dockerfile` to shell form with `${PORT:-8080}` expansion.
- A smoke-test script that automates both Gherkin scenarios from issue #46.
- Wiring that script so it runs on every push per the Definition of Done (exact mechanism: open question).

### Out of Scope
- Changes to the builder stage of `Dockerfile`.
- Any change to `Dockerfile.dev` / the DevContainer setup (dev environment doesn't use `serve` or this `CMD`).
- General Docker image hardening/optimization unrelated to port binding.
- Making `HEALTHCHECK` dynamic as well (see Open Questions §1 — resolved in scope).

### Technical Constraints
- Must not change the default listening port (8080) when `PORT` is unset — backward compatible with current deployments.
- Must not introduce new runtime dependencies into the production image (keep the minimal-attack-surface property already documented in `Dockerfile`'s comments, e.g. the removal of `npm`/`npx`).
- Smoke-test script must be safe to run repeatedly in CI (idempotent container/image naming, cleanup on both success and failure paths).

## Success Criteria

- [ ] `Dockerfile`'s production `CMD` and `HEALTHCHECK` are both shell form and expand `$PORT` (verifiable by inspecting the built image's `Cmd`/`Healthcheck` config via `docker inspect`, or by the smoke test itself)
- [ ] `docker inspect --format='{{.State.Health.Status}}'` reports `healthy` for a container run with a non-default `PORT`
- [ ] Smoke-test script exists, builds the production image, and both Gherkin scenarios from issue #46 pass when run locally against the host-mapped port via `curl`
- [ ] A static check (grep/regex, no Docker build) fails when `CMD` is reverted to hardcoded exec form, and passes on the fixed `Dockerfile`
- [ ] Both checks are invoked from a new `Makefile` target wired into `make validate`, so they run in `pre-push`/`pre-merge-commit` to `main`/`develop` and in `ci.yml` on every push
- [ ] `pnpm typecheck` and `pnpm lint` remain green (no regression introduced by this change, even though it touches no TypeScript)
- [ ] All Gherkin scenarios in issue #46 have a corresponding passing automated check

## Open Questions

_Resolved during spec review (2026-08-13) by the orchestrating session, per user delegation — none required a product decision beyond what's documented here._

1. **Scope of the `HEALTHCHECK` fix.** The existing `HEALTHCHECK` hardcodes `curl -f http://localhost:8080/`. If `CMD` becomes dynamic via `$PORT`, a container run with a non-default `PORT` would have `serve` correctly listening on the injected port while `HEALTHCHECK` keeps probing 8080 and would report unhealthy even though the app is fine. Options considered:
   - (a) Fix `HEALTHCHECK` in this same change too, e.g. `CMD ["sh", "-c", "curl -f http://localhost:${PORT:-8080}/ || exit 1"]`, keeping `CMD` and `HEALTHCHECK` consistent.
   - (b) Leave `HEALTHCHECK` hardcoded to 8080 and document the resulting gap/limitation (accept that health checks are only meaningful when `PORT` is unset or equals 8080).
   - (c) Leave `HEALTHCHECK` as-is and open a separate follow-up issue for it, out of scope of #46 as literally scoped (#46's title and Gherkin ACs only mention `CMD`/listening port, not `HEALTHCHECK`).
   The issue body itself flags this as a decision point without resolving it. Recommend (a) for consistency, since leaving it broken seems like an oversight rather than a deliberate scope cut — but this is a product/architecture call this spec should not make unilaterally.

   **Decision: (a).** Fixing `CMD` but not `HEALTHCHECK` leaves the feature broken for its own stated purpose — a container correctly serving traffic on a non-default `PORT` would report unhealthy, which is exactly the kind of deployment failure this issue exists to prevent on platforms that gate routing/restarts on health status.

2. **Where does the smoke-test script get wired in?** The DoD says "wired into `make validate` or a CI step that runs on every push (not only main)." Options:
   - (a) Add a `docker-smoke-test` target to the `Makefile` and call it from `validate`, so it runs identically in local pre-push/pre-merge-commit hooks and in `ci.yml`'s `make validate` step. Matches this repo's existing pattern of "hooks and CI both run the same `make validate`" (per `CLAUDE.md`'s CI/CD section) but adds real time to every local `pre-push` (image build + two container runs) and requires Docker to be installed on every dev's host for the hook to succeed, not just for `docker compose` usage.
   - (b) Add a separate, dedicated step/job in `ci.yml` (outside `make validate`) that runs on every push, not gated behind the pre-push hook. Avoids slowing down local git hooks and avoids a hard Docker-on-host requirement for `pre-push`, but is a second thing to keep synced with `make validate`'s scope (this repo's `CLAUDE.md` notes hooks and CI "run the same `make validate` so they don't diverge" — a separate step is a deliberate exception to that pattern, similar to how the Dependabot Socket Firewall workflow already exists as a separate workflow for its own reasons).
   No default is assumed here since it's an explicit fork in the DoD's own wording ("or").

   **Decision: (a).** A new `Makefile` target, called from `validate`. Preserves this repo's documented invariant that hooks and CI run the same `make validate` so they never diverge (per `CLAUDE.md`'s CI/CD section), rather than opening a third exception path alongside the already-separate Trivy and Dependabot Socket Firewall steps (which exist for unrelated, specific reasons — extra scan tooling and elevated PR-write permissions, respectively — not applicable here). The added cost is scoped: `pre-push` only runs full `make validate` for pushes to `main`/`develop` (other branches only run `pnpm typecheck` per existing hook config), so this doesn't slow down every local push, only the ones that already run the full gate.

3. **How to verify, in an automated and CI-safe way, the underlying "exec-form CMD doesn't expand env vars" defect** — i.e., a regression test that would have caught the original bug, not just a smoke test that happens to pass once the fix is applied. Options:
   - (a) Smoke-test script only (integration-level): sufficient to prove both Gherkin scenarios pass, but doesn't by itself document the exec-vs-shell-form mechanism, and could pass "by accident" if `serve` had ignored `-l` and used some other default matching the test's expectations.
   - (b) A cheap static check as a fast-feedback complement, e.g. a script/test asserting `Dockerfile`'s production `CMD` line is shell form and contains `PORT` (grep/regex-based, no Docker required) — catches an accidental future revert to exec form without needing a full image build.
   - (c) Both (a) and (b) — belt and suspenders, matching this repo's general pattern of pairing fast unit-style checks with slower integration verification.
   No default assumed; depends on how much weight the team wants on Docker-build-time feedback vs. instant feedback.

   **Decision: (c), both.** The static check is nearly free to add and catches an accidental revert to exec-form `CMD` instantly, without needing a Docker build; the smoke test remains the source of truth that the actual runtime behavior is correct. Matches this repo's existing pattern of pairing fast static checks with slower integration verification (e.g. `pnpm lint`/`typecheck` before `build`/`test:coverage` in `make validate`'s own ordering).

4. **Does the smoke-test script need `curl` installed on the host running it, or should verification happen from inside the container/via `docker exec`?** The production image already installs `curl` for its own `HEALTHCHECK`, but the *smoke-test script* itself runs on the host (or CI runner) that builds and starts the container, and needs some way to make an HTTP request to the container's mapped port. Options:
   - (a) Require `curl` on the host/CI runner (already present on `ubuntu-latest` GitHub-hosted runners; would need documenting as a new local prerequisite alongside `gitleaks`/`make` if run via `pre-push`).
   - (b) Use `docker exec <container> curl ...` to run the check from inside the container itself (reuses the `curl` already installed in the production image, no host dependency, but only proves the app is reachable from inside its own container, not that the host-to-container port mapping is correct — which is closer to what a real deployment needs verified).
   - (c) Use a host-side tool that's already a hard dependency of this repo instead of `curl` (e.g. Node's built-in `fetch` via a tiny script, since Node is already required to run `pnpm`) to avoid adding any new host prerequisite.
   Depends on the answer to Open Question 2 (a local Makefile target needs to work on every dev's host; a CI-only step has more freedom to assume `ubuntu-latest`'s preinstalled tools).

   **Decision: (a).** `curl` from the host/CI runner, against the host-mapped port. This is the only option that actually proves the host→container port mapping works end-to-end — the literal thing the Gherkin acceptance criteria describe ("a request to http://localhost:PORT/ returns HTTP 200"). `curl` is already a documented local prerequisite pattern in this repo (`HEALTHCHECK` itself uses it inside the image, `gitleaks`/`make` are already host prerequisites for hooks), and is preinstalled on `ubuntu-latest`.
