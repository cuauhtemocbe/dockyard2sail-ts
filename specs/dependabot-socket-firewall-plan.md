# Implementation Plan: Dependabot Socket Firewall Gate

**Spec**: `specs/dependabot-socket-firewall.md`
**Created**: 2026-08-04
**Status**: approved

## Components

### 1. `.github/workflows/dependabot-socket-firewall.yml`
- **Purpose**: bot-gated job that runs `sfw pnpm install --frozen-lockfile` against a Dependabot PR and closes it via `gh pr close` if `sfw` blocks a package
- **Files**: `.github/workflows/dependabot-socket-firewall.yml` (new)
- **Effort**: S

### 2. `CLAUDE.md` documentation update
- **Purpose**: document the new gate in the CI/CD section, matching the existing pattern of documenting workflow decisions and their scope
- **Files**: `CLAUDE.md`
- **Effort**: XS

### 3. Functional verification
- **Purpose**: confirm the clean-case scenario against a real Dependabot PR, and confirm the gate doesn't fire for human PRs
- **Files**: none (observing GitHub Actions run history)
- **Effort**: XS

## Dependencies

### Build Order
1. Workflow file (foundation — everything else verifies it)
2. CLAUDE.md docs (depends on final workflow shape, in case anything changes during review)
3. Verification (depends on the workflow being pushed and a Dependabot PR existing to trigger against — repo already has 6 open Dependabot PRs, e.g. #23/#24/#25/#33/#36/#37)

### External Dependencies
- `SocketDev/action@ba6de6cc0565af1f42295590380973573297e31f` (`v1.3.2`) — installs the `sfw` CLI, same version validated in the sibling repo same-day

## Risks & Assumptions

### Risks
- **Risk**: `sfw pnpm install --frozen-lockfile` syntax/flag support unverified against pnpm specifically (sibling repo only validated the pip path). **Mitigation**: verify via a real run against an open Dependabot PR (Milestone 2); if `sfw` doesn't accept `--frozen-lockfile` or needs different flags, adjust in a follow-up commit before considering the issue done.
- **Risk**: closing a PR mid-run on a false positive is a live action against a real GitHub Issue/PR the user may not expect. **Mitigation**: this is the intended, spec'd behavior (issue #32's AC explicitly wants this) — flagged here only so the user knows the first live trigger against a real open PR could close it if `sfw` (incorrectly) flags something.

### Assumptions
- `sfw` supports `pnpm` natively without a lockfile translation step (per issue #32's own technical context: "only pip/uv, npm/yarn/pnpm, cargo") — assumed correct, confirmed at Milestone 2.
- The existing 6 open Dependabot PRs are all legitimate minor/patch bumps — none expected to trip a real Socket Firewall block, so Milestone 2 exercises the clean path only, consistent with the spec's Testing Strategy.

## Milestones

- [ ] Milestone 1: Workflow file created, YAML valid, matches spec's gating/permissions requirements
- [ ] Milestone 2: Pushed to a branch, verified against a real open Dependabot PR (clean pass) via `gh run list`/`gh run view`
- [ ] Milestone 3: CLAUDE.md updated, PR opened referencing issue #32, issue #32 DoD checklist satisfied

## Tasks

### Foundation
- [ ] **Task 1**: Create `.github/workflows/dependabot-socket-firewall.yml`
  - **Acceptance**: `pull_request` trigger on `main`; job `if: github.actor == 'dependabot[bot]'`; job-scoped `permissions: pull-requests: write, contents: read`; steps: checkout → setup pnpm/node → `SocketDev/action` (firewall-free, SHA-pinned) → `sfw pnpm install --frozen-lockfile` (`continue-on-error: true`) → conditional `gh pr close` step on failure
  - **Files**: `.github/workflows/dependabot-socket-firewall.yml`
  - **Tests**: YAML lint (`actionlint` if available, else visual review); no unit tests apply to workflow files
  - **Effort**: S

### Integration
- [ ] **Task 2**: Push branch, open draft/real PR, verify against a real open Dependabot PR
  - **Acceptance**: workflow run visible in `gh run list` for a Dependabot PR, completes with `sfw` passing; a check on a human PR (e.g. this feature's own PR) confirms the job is skipped/absent since `github.actor` isn't `dependabot[bot]`
  - **Files**: none
  - **Tests**: manual verification via `gh run list --workflow=dependabot-socket-firewall.yml`
  - **Effort**: XS

### Polish
- [ ] **Task 3**: Update `CLAUDE.md`'s CI/CD section
  - **Acceptance**: new subsection or paragraph documenting the gate, its bot-only scope, and why permissions are job-scoped
  - **Files**: `CLAUDE.md`
  - **Tests**: none (docs)
  - **Effort**: XS

- [ ] **Task 4**: Close out issue #32
  - **Acceptance**: PR referencing `Closes #32`, DoD checklist in the issue satisfied
  - **Files**: none
  - **Tests**: none
  - **Effort**: XS

## Effort Estimate

**Total Estimated**: ~1 session (S+XS+XS+XS)

| Phase | Effort |
|-------|--------|
| Foundation (Task 1) | S |
| Integration (Task 2) | XS |
| Polish (Tasks 3-4) | XS |
