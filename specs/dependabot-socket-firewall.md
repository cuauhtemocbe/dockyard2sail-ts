---
title: Dependabot Socket Firewall Gate
status: approved
created: 2026-08-04
updated: 2026-08-04
issue: #32
---

# Dependabot Socket Firewall Gate

## Objective

Add a CI-only gate that reinstalls a Dependabot-authored PR's dependencies through Socket Firewall Free (`sfw`) and automatically closes the PR if `sfw` blocks a package for malicious/compromised behavior — closing the "automated PRs in volume, unaudited by a human" gap for this repo's 3-ecosystem Dependabot setup.

## Context

- `.github/dependabot.yml` tracks npm, docker, and github-actions on a weekly interval; prior sessions merged 6 Dependabot PRs in one sitting, exactly the volume/no-human-review risk profile this gate targets.
- The pattern is already implemented and merged in the sibling repo `dockyard2sail-py` (`.github/workflows/dependabot-socket-firewall.yml`, commit `89d33ea`, PR #37): a bot-only job that installs deps through `sfw` and calls `gh pr close` on failure.
- The sibling repo is Python/Poetry, which `sfw` doesn't support directly — it exports `poetry.lock` to `requirements.txt` first and runs `sfw pip install` against that. This repo is npm/pnpm, which `sfw` supports natively, so no export/translation step is needed — `sfw pnpm install --frozen-lockfile` runs directly against `pnpm-lock.yaml`.
- Filed as issue #32 from the `dev-standards-gap` audit; explicitly lower priority than #29/#30/#31 (no incident, just closing a known gap already validated elsewhere).

## Requirements

### Functional Requirements

- [ ] New GitHub Actions workflow, gated to `github.actor == 'dependabot[bot]'`, triggered on `pull_request` targeting `main`
- [ ] Job installs dependencies via `sfw pnpm install --frozen-lockfile` against the PR's resolved `pnpm-lock.yaml`
- [ ] If the `sfw` install step fails (Socket Firewall blocked a package), the job closes the PR via `gh pr close` with a comment explaining why
- [ ] A clean dependency bump (no flagged package) leaves the PR open, unaffected by this job
- [ ] Human-authored PRs never trigger this job (the `if:` gate short-circuits the job entirely, not just skips steps)

### Non-Functional Requirements

- [ ] Security: `permissions: pull-requests: write` scoped to this job only — never at workflow level, and never added to the existing `ci.yml` (which stays `contents: read`)
- [ ] Security: the `SocketDev/action` step (the actual security-critical third party here, since it runs with `pull-requests: write`) is pinned to a commit SHA, matching the validated sibling implementation — independent of whether the rest of this repo's actions are SHA-pinned yet (that's the separate, still-open issue #29)
- [ ] Consistency: `actions/checkout` and pnpm/Node setup steps follow this repo's existing `ci.yml` convention (floating major-version tags, e.g. `@v4`) rather than the sibling's SHA-pinning, since #29 hasn't landed here yet

## Architecture

### Components

- `.github/workflows/dependabot-socket-firewall.yml` — new, standalone workflow file (not a job added to `ci.yml`), triggered on `pull_request` only, mirroring the sibling repo's separation of concerns (this gate is bot-specific and has elevated permissions; `ci.yml` stays generic and read-only).

### External Dependencies

- `SocketDev/action` (GitHub Action): installs the `sfw` CLI in `firewall-free` mode. Pinned to the same commit SHA the sibling repo validated same-day (`ba6de6cc0565af1f42295590380973573297e31f` / `v1.3.2`).
- `sfw` CLI: supports `npm`/`yarn`/`pnpm`/`pip`/`uv`/`cargo` natively — for this repo, `sfw pnpm install --frozen-lockfile` needs no lockfile translation (unlike the Poetry case in the sibling repo).

## User Stories

See issue #32 body (already contains the full User Story + Gherkin AC + DoD — used verbatim as spec source per this task's instructions, not duplicated here).

## Testing Strategy

CI workflow behavior can't be unit-tested with Vitest; verification is functional, against real GitHub Actions runs:

- **Clean case**: trigger against an existing open Dependabot PR (e.g. #23/#24/#25/#33/#36/#37) and confirm the job runs, `sfw` passes, PR stays open.
- **Gate correctness**: confirm the job does NOT run on a human-authored PR (inspect workflow runs for a non-bot PR — should show 0 runs of this workflow).
- Blocked-package case is not practically testable without a real malicious package in the dependency tree — accepted as unverified per DoD's "verified against at least one real Dependabot PR (clean case)" wording, which only requires the clean path.

## Boundaries & Constraints

### In Scope

- One new workflow file, bot-gated, npm/pnpm-only (this repo has no Python/Poetry or other ecosystems needing lockfile translation)

### Out of Scope

- SHA-pinning the rest of this repo's actions (`actions/checkout`, `pnpm/action-setup`, `actions/setup-node` in `ci.yml`) — tracked separately by issue #29
- Docker-ecosystem Dependabot PRs — `sfw` has no Docker-image-scanning mode; out of scope for this gate (docker CVE scanning is already covered by Trivy per issue #30, not by Socket Firewall)
- github-actions-ecosystem Dependabot PRs — same reasoning, `sfw` doesn't scan Action bumps; those go through normal review

### Technical Constraints

- Must not modify `ci.yml`'s workflow-level `permissions: contents: read` — the write permission is job-scoped in the new file only
- Must use `pnpm` (this repo's exclusive package manager per `CLAUDE.md`) — no `npm`/`yarn` fallback

## Success Criteria

- [ ] `.github/workflows/dependabot-socket-firewall.yml` exists, syntactically valid, gated correctly
- [ ] A real open Dependabot PR in this repo triggers the workflow and passes (clean case verified)
- [ ] A human-authored PR does not trigger the workflow
- [ ] `CLAUDE.md`'s CI/CD section documents the new gate and why it's scoped to bot PRs only
- [ ] Issue #32's DoD checklist fully satisfied

## Implementation Plan

See `specs/dependabot-socket-firewall-plan.md`.
