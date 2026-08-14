# Implementation Plan: Dynamic Port Binding in Production Container

**Spec**: `specs/dynamic-port-binding.md`
**Created**: 2026-08-13
**Status**: approved

**Open Questions resolved** (see spec's Open Questions section for full rationale): (1) `HEALTHCHECK` fixed in same change, (2) wired into `Makefile` → `make validate`, (3) both static check + smoke test, (4) `curl` from host/CI runner.

## Components

### 1. `Dockerfile` production stage `CMD`/`HEALTHCHECK`
- **Purpose**: switch both `CMD` and `HEALTHCHECK` from exec form to shell form so `${PORT:-8080}` expands at container start
- **Files**: `Dockerfile`
- **Effort**: XS

### 2. Docker port smoke-test script
- **Purpose**: build the production image once, run it twice (default port, injected `PORT=3000`), curl each from the host and assert HTTP 200, assert `docker inspect` health status is `healthy` for the injected-port case, clean up after itself
- **Files**: `scripts/docker-port-smoke-test.sh` (new)
- **Effort**: S

### 3. Static "shell-form CMD" fast-feedback check
- **Purpose**: cheap regression guard (no Docker build) that `Dockerfile`'s production `CMD` line stays shell form and references `PORT`
- **Files**: standalone check, e.g. `scripts/check-docker-cmd-shell-form.sh`, invoked before the smoke test
- **Effort**: XS

### 4. `make validate` wiring
- **Purpose**: run both the static check and the smoke-test script automatically as part of `make validate`, so they run in `pre-push`/`pre-merge-commit` (to `main`/`develop`) and in `ci.yml` on every push
- **Files**: `Makefile`
- **Effort**: XS

### 5. `CLAUDE.md` documentation update
- **Purpose**: document the new smoke-test script and where it's wired in, matching this repo's pattern of keeping `CLAUDE.md` in sync with new validation steps (see e.g. the Trivy fs scan entry)
- **Files**: `CLAUDE.md`
- **Effort**: XS

## Dependencies

### Build Order
1. `Dockerfile` `CMD` and `HEALTHCHECK` change (foundation — everything else verifies this)
2. Static fast-feedback check (can be built alongside the smoke test)
3. Smoke-test script (depends on step 1 existing to have something to test)
4. `make validate` wiring (depends on steps 2–3 existing)
5. `CLAUDE.md` docs update (last, describes the finished state)

### External Dependencies
- Docker CLI/daemon — required to build and run the production image; assumed available in CI (`ubuntu-latest` ships Docker) and on dev hosts that already use `docker compose` per `CLAUDE.md`'s Docker section.
- No new npm/pnpm dependencies.

## Risks & Assumptions

### Risks
- **Risk**: adding a Docker build + two container runs to `make validate` adds real time to local `pre-push` for pushes to `main`/`develop` (the only branches where the hook runs full `make validate` today). **Mitigation**: accepted trade-off per the spec's decision on Open Question 2 — keeps hook/CI parity intact; scoped to the already-heaviest hook path, not every push.
- **Risk**: port collisions in CI/local runs if the smoke-test script's chosen host ports (e.g. 8080, 3000) are already in use. **Mitigation**: script should fail fast with a clear message rather than hang, and clean up any container it started even on failure.

### Assumptions
- No existing Docker image build/test step exists anywhere in `make validate` or `ci.yml` today (confirmed: `ci.yml` only runs `make validate` + Trivy fs scan; `make validate` has no `docker build` step) — this is genuinely new capability being added to validation, not a duplicate.
- `serve`'s `-l` flag accepts a plain port number and binds correctly when passed via shell-expanded `${PORT:-8080}` — same binary, same flag, only the shell-vs-exec form changes, so this is low-risk but worth confirming with a real `docker run` during implementation.
- GitHub-hosted `ubuntu-latest` runners have Docker available without extra setup steps (standard GitHub Actions assumption, not verified against this specific workflow file).

## Milestones

- [ ] Milestone 1: `Dockerfile` production `CMD` and `HEALTHCHECK` updated; manual `docker build` + `docker run` with and without `PORT` confirms both scenarios work, including health status
- [ ] Milestone 2: static check + `scripts/docker-port-smoke-test.sh` automate both scenarios and pass locally
- [ ] Milestone 3: both checks wired into `make validate`; a real push/PR shows them running in `ci.yml` and green
- [ ] Milestone 4: `CLAUDE.md` updated; `pnpm typecheck` and `pnpm lint` still green

## Tasks

### Foundation (Build First)
- [ ] **Task 1**: Update `Dockerfile` production stage `CMD` and `HEALTHCHECK` to shell form with `${PORT:-8080}` expansion
  - **Acceptance**: `CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]` and `HEALTHCHECK ... CMD ["sh", "-c", "curl -f http://localhost:${PORT:-8080}/ || exit 1"]` (or equivalent); `docker build` succeeds; manual `docker run` with no `PORT` listens on 8080 and reports healthy, with `PORT=3000` listens on 3000 and reports healthy (`docker inspect --format='{{.State.Health.Status}}'`)
  - **Files**: `Dockerfile`
  - **Tests**: manual `docker run` verification now, automated in Task 3
  - **Effort**: XS

### Features (Build Second)
- [ ] **Task 2**: Add a static fast-feedback check that `Dockerfile`'s `CMD` is shell form and references `PORT`
  - **Acceptance**: a grep/regex-based check fails if `CMD` reverts to a hardcoded exec-form array; passes on the fixed `Dockerfile`
  - **Files**: `scripts/check-docker-cmd-shell-form.sh` (new)
  - **Tests**: run against current (fixed) `Dockerfile` (passes) and a deliberately reverted copy (fails)
  - **Effort**: XS

- [ ] **Task 3**: Write `scripts/docker-port-smoke-test.sh`
  - **Acceptance**: script builds the production image, runs Scenario 1 (default port, expects HTTP 200 on 8080 + healthy status) and Scenario 2 (`PORT=3000`, expects HTTP 200 on 3000 + healthy status), exits non-zero on any failure, cleans up containers/images it created
  - **Files**: `scripts/docker-port-smoke-test.sh` (new)
  - **Tests**: the script itself is the test; run it locally and confirm both scenarios pass, then confirm it correctly fails (non-zero exit) against the pre-fix `Dockerfile` (checked out via `git stash`/branch compare) to prove it actually catches the original bug
  - **Effort**: S

### Integration (Build Third)
- [ ] **Task 4**: Wire the static check and the smoke test into `make validate`
  - **Acceptance**: `make validate` runs both checks; pushing to `main`/`develop` triggers them via `pre-push`, and every push triggers them via `ci.yml` (which already runs `make validate`); visible as passing in the run output/logs
  - **Files**: `Makefile`
  - **Tests**: a real `git push` and a CI run (`gh run list`/`gh run view`) confirm both steps run and are green
  - **Effort**: XS

- [ ] **Task 5**: Update `CLAUDE.md`'s Docker section to document the new checks and their role
  - **Acceptance**: new paragraph(s) describing the static check and the smoke-test script, what each verifies, and how they're invoked (`make validate`)
  - **Files**: `CLAUDE.md`
  - **Tests**: none (docs)
  - **Effort**: XS

- [ ] **Task 6**: Final quality gates and PR
  - **Acceptance**: `pnpm typecheck`, `pnpm lint`, `make validate` all green; PR references `Closes #46`; issue #46's DoD checklist fully satisfied
  - **Files**: none
  - **Tests**: full `make validate` run
  - **Effort**: XS

## Effort Estimate

**Total Estimated**: roughly 2-3 hours of focused work (S effort per the issue's own "Effort: S" label).

| Phase | Effort |
|-------|--------|
| Foundation (Task 1) | XS |
| Features (Tasks 2-3) | S |
| Integration (Tasks 4-6) | S |
