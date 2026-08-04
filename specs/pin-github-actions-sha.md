---
title: Pin GitHub Actions to Commit SHA
status: approved
created: 2026-08-04
updated: 2026-08-04
issue: #29
---

# Pin GitHub Actions to Commit SHA

## Objective

Replace the floating major-version tags (`@v4`) used by the three third-party actions in `ci.yml` with pinned commit SHAs (plus a version comment), removing the risk of a re-tagged/compromised action silently running in CI.

## Context

- `.github/workflows/ci.yml` currently uses `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` — all floating tags.
- `CLAUDE.md`'s CI/CD section documents this as a deliberate-but-unjustified asymmetry ("`actions/*` pineados a major (`@v4`)"), unlike other documented decisions in the same file which carry explicit reasoning.
- The reference practices doc (`docs/development-standards.md`) flags this concretely, citing the 2025 `tj-actions/changed-files` compromise (delivered via a re-pointed tag, not a new release) as the concrete risk a floating tag carries.
- `dependabot-socket-firewall.yml` (added by issue #32, already merged) already SHA-pins its one security-critical step (`SocketDev/action`) while leaving its own `actions/checkout`/`pnpm/action-setup`/`actions/setup-node` steps on `@v4` "since #29 hasn't landed here yet" — this issue is scoped to `ci.yml` only per its own acceptance criteria, so `dependabot-socket-firewall.yml`'s matching steps are left as `@v4` and out of scope here (tracked as a natural follow-up, not part of this issue's DoD).
- `.github/dependabot.yml` already tracks the `github-actions` ecosystem, so pinning to SHA doesn't lose auto-update — Dependabot resolves SHA bumps the same way it resolves tag bumps.

## Requirements

### Functional Requirements

- [ ] `actions/checkout@v4` → pinned to the commit SHA of the current latest `v4.x.x` release, with a trailing `# v4.x.x` comment
- [ ] `pnpm/action-setup@v4` → same treatment
- [ ] `actions/setup-node@v4` → same treatment
- [ ] `make validate` job in `ci.yml` still runs and passes identically after pinning

### Non-Functional Requirements

- [ ] Security: SHA is the full 40-character commit hash (not abbreviated), verified against each action's actual GitHub release tag before pinning (not guessed)
- [ ] Consistency: version comment format matches the precedent already in the repo (`SocketDev/action@<sha> # v1.3.2` in `dependabot-socket-firewall.yml`)

## Architecture

### Components

- `.github/workflows/ci.yml` — three `uses:` lines updated in place, no structural change to the workflow
- `CLAUDE.md` — CI/CD section's `actions/*` pineados a major (`@v4`)` line updated to reflect SHA pinning, replacing the now-inaccurate note

## User Stories

See issue #29 body (User Story + Gherkin AC + DoD used verbatim as spec source, not duplicated here).

## Testing Strategy

No unit tests apply (workflow YAML). Verification is functional:
- YAML stays syntactically valid (visual review; no local YAML linter configured in this repo)
- A real CI run on the feature branch (triggered by `push`) completes green — same `make validate` outcome as before pinning, confirming the SHAs resolve to working action versions

## Boundaries & Constraints

### In Scope
- The three `uses:` lines in `.github/workflows/ci.yml` only

### Out of Scope
- `dependabot-socket-firewall.yml`'s own `checkout`/`pnpm`/`setup-node` steps (still `@v4` by that workflow's own documented, separate decision) — not part of this issue's acceptance criteria
- Any action version *upgrade* (e.g. moving to a newer major like `actions/checkout@v5`) — this issue pins the currently-used major version's latest patch to a SHA, it does not change behavior by bumping majors

### Technical Constraints
- Must not change `node-version: 22` or any other step configuration — pinning only

## Success Criteria

- [ ] All three action references in `ci.yml` are 40-char SHAs with version comments
- [ ] A CI run on the branch confirms `make validate` still passes
- [ ] `CLAUDE.md`'s CI/CD section updated
- [ ] Issue #29's DoD checklist fully satisfied

## Implementation Plan

See `specs/pin-github-actions-sha-plan.md`.
