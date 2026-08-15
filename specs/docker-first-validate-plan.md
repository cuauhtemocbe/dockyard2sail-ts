# Implementation Plan: Delegate `make validate` to Docker Instead of the Host

**Spec**: GitHub issue [#53](https://github.com/cuauhtemocbe/dockyard2sail-ts/issues/53) (issue serves as spec source — Specify phase skipped, issue already contains user story, technical context, Gherkin acceptance criteria and DoD)
**Created**: 2026-08-15
**Status**: draft

## Scoping decision

`validate`'s steps split into two groups by what they actually depend on:

1. **Node/pnpm-dependent** (`lock-check`, `typecheck`, `test`, `build`, `audit`, `check-docs`): these are the reason a contributor needs Node/pnpm on the host today. Moving them to `docker compose exec app <cmd>` is what actually satisfies the issue's user story ("no Node/pnpm on the host").
2. **Docker-native, host-invoked** (`check-docker-cmd-shell-form.sh`, `docker-port-smoke-test.sh`): neither needs Node or pnpm — they need the Docker CLI/daemon directly, which the host already has to have (it's what runs `docker compose exec` for group 1 in the first place). Running them via `docker compose exec app ...` would need Docker-in-Docker (socket passthrough or a nested daemon) to give the `app` container its own access to the host's Docker daemon — real complexity (non-root socket permissions, GID mapping across hosts, a privilege-escalation surface to document) that buys nothing: Scenario 1 only requires "Docker installed, no Node/pnpm", and these two scripts already satisfy that running exactly as they do today.

**Decision (confirmed)**: only group 1 migrates to `docker compose exec app`. `check-docker-cmd-shell-form` and `docker-port-smoke-test` Makefile targets are **untouched** — no `up-d` dependency, no container involvement, called directly from `make validate` exactly as today. No `Dockerfile.dev` changes and no Docker socket passthrough.

## Components

### 1. `docker-compose.yml`
- **Purpose**: add a named volume for `node_modules` (`node_modules:/app/node_modules`, declared alongside the existing `pnpm-store` volume), mounted so it shadows that subpath of the `.:/app` bind mount. Without this, `node_modules` — created by `pnpm install` running inside the container — lands on the host too (it's just `.:/app`'s bind mount reflecting back), which can produce native-binary mismatches if the host OS/arch differs from the Linux container (exactly the class of bug this migration is trying to route around by moving `pnpm install` into Docker), and leaves Node artifacts on a host that, per the issue's premise, shouldn't need Node at all. This also **resolves** the "bind-mounted `node_modules` written with the container's UID" risk (see Risks) — `node_modules` is no longer part of the bind mount, so host-permission mismatches on it can't happen.
- **Files**: `docker-compose.yml`
- **Effort**: XS

### 2. `Makefile`
- **Purpose**: add `up` (foreground) and `up-d` (detached, `docker compose up -d --build --wait`) targets. Rewrite the Node/pnpm-dependent steps to run via `docker compose exec app <cmd>`, each depending on `up-d`: `lock-check` (`pnpm install --frozen-lockfile`), plus new targets `lint`, `typecheck`, `test`, `build`, `audit`, `check-docs` (wraps `check-docs.sh`, needs `node` for the version check). `check-docker-cmd-shell-form` and `docker-port-smoke-test` stay exactly as they are (host-invoked, no `up-d` dependency — see Scoping decision). `validate` becomes a thin composition of all of the above, preserving its current step-header echo output.
- **Files**: `Makefile`
- **Effort**: M

### 3. `.github/workflows/ci.yml`
- **Purpose**: for the 6 jobs that currently use `pnpm/action-setup` + `actions/setup-node` (`lock-check`, `lint`, `typecheck`, `test`, `build`, `audit-and-docs`), drop those steps and replace the `pnpm ...` run step with `make <target>` (e.g. `run: make lint`). `docker-checks`, `trivy-fs`, and `docker-image` are **unchanged** — none of them ever used `setup-node`, so there's nothing to migrate.
- **Files**: `.github/workflows/ci.yml`
- **Effort**: M

### 4. `.husky/pre-push` and `.husky/pre-merge-commit`
- **Purpose**: the protected-branch path already calls `make validate` — once Component 2 lands, it delegates to Docker automatically, no hook edit needed there. The **feature-branch fast path** in both hooks currently runs `pnpm run typecheck` directly on the host; replace with `make typecheck` (new target from Component 2) so the light path is Docker-first too.
- **Files**: `.husky/pre-push`, `.husky/pre-merge-commit`
- **Effort**: XS

### 5. `src/test/ci-workflow.test.ts`
- **Purpose**: extend the existing js-yaml structural suite to assert the 6 migrated jobs no longer reference `actions/setup-node`/`pnpm/action-setup` and that their run step invokes `make <target>`; assert `docker-checks`/`trivy-fs`/`docker-image` are structurally unchanged (regression guard against accidentally migrating them).
- **Files**: `src/test/ci-workflow.test.ts`
- **Effort**: S

### 6. `CLAUDE.md` documentation
- **Purpose**: update the CI/CD section (6 jobs now run via `make <target>` inside Docker, not `setup-node`); note in the Docker/Makefile section that `node_modules` lives in a named volume (not the host) and that `check-docker-cmd-shell-form`/`docker-port-smoke-test` remain host-invoked by design (they need Docker itself, not Node/pnpm).
- **Files**: `CLAUDE.md`
- **Effort**: S

### Explicitly out of scope
- **`Dockerfile.dev`**: no changes — no Docker socket passthrough needed (see Scoping decision).
- **`.husky/pre-commit`**: unaffected — runs `gitleaks` + `lint-staged`, never calls `pnpm`/`make` directly. A prior discovery in this repo's memory already established `lint-staged` must stay host-invoked per-file (moving it to a whole-project Docker command breaks its staged-file-scoped design).
- **`down`/cleanup Makefile target**: not requested by the issue's AC.
- **CI Docker layer caching** for the 6 migrated jobs' `Dockerfile.dev` build: real speed win, not required by any Gherkin scenario or the DoD — noted as a risk/follow-up, not an in-scope task.

## Dependencies

### Build Order
1. `docker-compose.yml` (`node_modules` named volume) — foundation for Component 2.
2. `Makefile` (new/rewritten targets).
3. Local verification: `make validate` on this machine with Node/pnpm shadowed off `$PATH`, confirming all Node/pnpm-dependent steps still succeed via Docker, the two Docker-native steps still work unchanged, and `node_modules` no longer appears on the host filesystem.
4. `.github/workflows/ci.yml` migration (6 jobs) + `ci-workflow.test.ts` extension (TDD: extend tests first against current `ci.yml`, watch them fail, then migrate the workflow).
5. `.husky/pre-push` / `.husky/pre-merge-commit` feature-branch path.
6. `CLAUDE.md` docs.
7. Push a feature branch, confirm CI green end-to-end; separately confirm a push to a protected branch actually invokes `make validate` through Docker.

### External Dependencies
None new — no new packages, no changes to `Dockerfile.dev`.

## Risks & Assumptions

### Risks
- **CI job runtime increases**: 6 jobs each now build/pull `Dockerfile.dev` before running their check, instead of the lighter `setup-node` + `pnpm install` path. **Mitigation**: accepted trade-off, explicit in the issue itself ("slower CI in exchange for the Docker-first guarantee"). If it regularly exceeds the current `timeout-minutes: 10`, bump it — not pre-emptively guessed here.
- ~~`pnpm install --frozen-lockfile` writing into the bind-mounted `node_modules` as the container's `node` UID could produce host-unreadable files~~ — **resolved** by Component 1 (`node_modules` named volume shadows the bind mount, so it's never written to the host at all).
- **Existing local `node_modules`/`.pnpm-store` on a dev's host** (from before this change) won't automatically disappear — first `make validate` after this lands should note that a stale host-side `node_modules` can be safely removed (informational, not a blocking risk).

### Assumptions
- GitHub-hosted `ubuntu-latest` runners have `docker compose` (v2 plugin) preinstalled — true as of current runner images; first CI run of the migrated jobs is the actual check.
- The existing `pnpm-store` named volume in `docker-compose.yml` needs no changes — `docker compose exec` reuses the same running container/volumes already used for interactive dev.

### Post-first-CI-run correction
The first real CI run (PR #60) caught a design gap this plan missed: each `lint`/`typecheck`/`test`/`build`/`audit`/`check-docs` target originally depended only on `up-d`, not on `lock-check`. Locally that's invisible — the same container/volume persists across separate `make` invocations, so running `make validate` (or even just `make lint` after any prior target) always found `node_modules` already populated. In CI, each job is a fresh runner with its own fresh named volume — nothing had installed dependencies before `pnpm lint`/`pnpm test:coverage` ran, so every migrated job except `audit-and-docs`/`lock-check` failed with `sh: vitest: not found` (or the lint/tsc equivalent). Fix: `lint`, `typecheck`, `test`, `build`, `audit`, `check-docs` now depend on `lock-check` (not `up-d` directly) so each is self-sufficient regardless of invocation order or fresh state — verified locally by tearing down all volumes and running `make lint` standalone.

## Milestones

- [ ] Milestone 1: `docker-compose.yml` + `Makefile` updated; `make validate` runs successfully end-to-end on this machine with Node/pnpm shadowed off `$PATH` (matches the issue's DoD wording: "verified in a clean environment with Docker but no Node/pnpm installed on the host"), and `node_modules` no longer appears on the host
- [ ] Milestone 2: `ci.yml` migrated (6 jobs), `ci-workflow.test.ts` green, CI run on a feature branch confirms all 9 jobs pass
- [ ] Milestone 3: `.husky` hooks updated, verified against a real push to a feature branch and to a protected branch
- [ ] Milestone 4: `CLAUDE.md` updated, PR opened closing #53

## Tasks

### Foundation
- [ ] **Task 1**: Add `node_modules` named volume to `docker-compose.yml`
  - **Acceptance**: `node_modules` declared as a named volume (alongside `pnpm-store`), mounted at `/app/node_modules`; after `docker compose exec app pnpm install`, `node_modules` is visible inside the container but absent from the host's working directory
  - **Files**: `docker-compose.yml`
  - **Tests**: manual — inspect host filesystem after install
  - **Effort**: XS

- [ ] **Task 2**: Add `up`/`up-d` and Node/pnpm-dependent targets to `Makefile`
  - **Acceptance**: `up-d` runs `docker compose up -d --build --wait`; `lock-check`, `lint`, `typecheck`, `test`, `build`, `audit`, `check-docs` all depend on `up-d` and run their command via `docker compose exec app`; `check-docker-cmd-shell-form` and `docker-port-smoke-test` are untouched (still host-invoked, no `up-d` dependency); `validate` composes all of the above, preserving the existing step-header echo output
  - **Files**: `Makefile`
  - **Tests**: manual — `make validate` end-to-end, and each new target individually (`make lint`, `make typecheck`, etc.)
  - **Effort**: M

- [ ] **Task 3**: Verify Scenario 1 (no Node/pnpm on host)
  - **Acceptance**: with `pnpm`/`node` shadowed off `$PATH`, `make validate` still completes successfully — Node/pnpm-dependent steps via Docker, `check-docker-cmd-shell-form`/`docker-port-smoke-test` via the host's own Docker install (no Node/pnpm needed for either)
  - **Files**: none
  - **Tests**: manual, matches the issue's DoD wording exactly
  - **Effort**: S

### Features
- [ ] **Task 4**: Extend `ci-workflow.test.ts`
  - **Acceptance**: new/updated assertions — the 6 migrated jobs have no `setup-node`/`pnpm/action-setup` step and their check-running step is `make <target>`; `docker-checks`, `trivy-fs`, `docker-image` remain structurally unchanged
  - **Files**: `src/test/ci-workflow.test.ts`
  - **Tests**: this task is the tests — write against current `ci.yml` first (red), then Task 5 makes them pass (green)
  - **Effort**: S

- [ ] **Task 5**: Migrate the 6 `ci.yml` jobs
  - **Acceptance**: `lock-check`, `lint`, `typecheck`, `test`, `build`, `audit-and-docs` each: checkout only, then `run: make <target>` — no `setup-node`/`pnpm/action-setup` steps left; `docker-checks`/`trivy-fs`/`docker-image` untouched
  - **Files**: `.github/workflows/ci.yml`
  - **Tests**: `ci-workflow.test.ts` (Task 4) passes; real CI run on the feature branch confirms green
  - **Effort**: M

### Integration
- [ ] **Task 6**: Update `.husky/pre-push` and `.husky/pre-merge-commit` feature-branch fast path
  - **Acceptance**: both hooks' non-protected-branch path calls `make typecheck` instead of `pnpm run typecheck`; protected-branch path (`make validate`) needs no edit since it already delegates transitively
  - **Files**: `.husky/pre-push`, `.husky/pre-merge-commit`
  - **Tests**: manual — push to a feature branch and confirm `make typecheck` runs; push to a protected branch and confirm `make validate` runs, both via Docker
  - **Effort**: XS

- [ ] **Task 7**: Push branch, confirm CI green and hook behavior on a real push
  - **Acceptance**: PR-triggered CI run shows all 9 jobs passing (6 migrated + `docker-checks`/`trivy-fs`/`docker-image` unaffected); feature-branch push locally triggers `make typecheck` via Docker
  - **Files**: none
  - **Tests**: manual verification via `gh run list`/`gh run view` and hook output
  - **Effort**: XS

### Polish
- [ ] **Task 8**: Update `CLAUDE.md`
  - **Acceptance**: CI/CD section reflects `make <target>`-based jobs instead of `setup-node`; Docker/Makefile section documents the `node_modules` named volume and why `check-docker-cmd-shell-form`/`docker-port-smoke-test` stay host-invoked
  - **Files**: `CLAUDE.md`
  - **Tests**: none (docs); `scripts/check-docs.sh`'s `check_claude_md_exceptions` still passes (still mentions "CI/CD (GitHub Actions)")
  - **Effort**: S

- [ ] **Task 9**: Open PR closing #53
  - **Acceptance**: PR references `Closes #53`; all 4 Gherkin scenarios have passing automated verification per the DoD; CHANGELOG.md entry added under `[Unreleased]`
  - **Files**: `CHANGELOG.md`
  - **Tests**: none
  - **Effort**: XS

## Effort Estimate

**Total Estimated**: ~0.5-1 day (smaller than the issue's own "Effort: L" estimate, now that the Docker-socket-passthrough complexity is scoped out)

| Phase | Effort |
|-------|--------|
| Foundation (Tasks 1-3) | XS + M + S |
| Features (Tasks 4-5) | S + M |
| Integration (Tasks 6-7) | XS + XS |
| Polish (Tasks 8-9) | S + XS |
