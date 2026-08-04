# Implementation Plan: Pin GitHub Actions to Commit SHA

**Spec**: `specs/pin-github-actions-sha.md`
**Created**: 2026-08-04
**Status**: approved

## Components

### 1. `.github/workflows/ci.yml`
- **Purpose**: pin the three `uses:` lines to commit SHA
- **Files**: `.github/workflows/ci.yml`
- **Effort**: XS

### 2. `CLAUDE.md` documentation update
- **Purpose**: replace the "pineados a major (`@v4`)" note with the new pinned state
- **Files**: `CLAUDE.md`
- **Effort**: XS

## Dependencies

### Build Order
1. `ci.yml` pin (foundation)
2. CLAUDE.md docs (depends on final SHAs chosen)
3. Verification (CI run on push)

### External Dependencies
None — SHAs resolved from each action's own public GitHub repo tags via `gh api`.

## Risks & Assumptions

### Risks
- **Risk**: pinning to a specific SHA instead of a floating tag means future patch releases (e.g. a security fix in `actions/checkout`) require a manual/Dependabot-driven bump instead of being picked up automatically. **Mitigation**: `.github/dependabot.yml` already tracks `github-actions`; Dependabot bumps SHA pins the same way it bumps tags, so this is a non-issue in practice.

### Assumptions
- The latest published `v4.x.x` tag for each action is the correct one to pin (not jumping to a newer major) — confirmed via `gh api repos/<owner>/<repo>/tags`, filtering for `v4.` prefix, before writing this plan.

## Milestones

- [ ] Milestone 1: `ci.yml` updated with 3 SHA-pinned actions + comments
- [ ] Milestone 2: CI run on the branch passes (`make validate` green)
- [ ] Milestone 3: `CLAUDE.md` updated, PR opened referencing issue #29

## Tasks

### Foundation
- [ ] **Task 1**: Pin `actions/checkout`, `pnpm/action-setup`, `actions/setup-node` to SHA in `ci.yml`
  - **Acceptance**: each `uses:` line is `owner/repo@<40-char-sha> # vX.Y.Z`
  - **Files**: `.github/workflows/ci.yml`
  - **Tests**: none (workflow file); verified functionally in Task 2
  - **Effort**: XS

### Integration
- [ ] **Task 2**: Push branch, confirm CI run passes
  - **Acceptance**: `gh run list` shows a green run for the branch's push, `make validate` job succeeded
  - **Files**: none
  - **Tests**: manual verification via `gh run list`/`gh run view`
  - **Effort**: XS

### Polish
- [ ] **Task 3**: Update `CLAUDE.md`'s CI/CD section
  - **Acceptance**: the "pineados a major" line replaced to reflect SHA pinning
  - **Files**: `CLAUDE.md`
  - **Tests**: none (docs)
  - **Effort**: XS

- [ ] **Task 4**: Open PR closing #29
  - **Acceptance**: PR references `Closes #29`, DoD checklist satisfied
  - **Files**: none
  - **Tests**: none
  - **Effort**: XS

## Effort Estimate

**Total Estimated**: ~30 min (XS all around)

| Phase | Effort |
|-------|--------|
| Foundation (Task 1) | XS |
| Integration (Task 2) | XS |
| Polish (Tasks 3-4) | XS |
