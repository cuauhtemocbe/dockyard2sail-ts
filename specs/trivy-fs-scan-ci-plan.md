# Implementation Plan: Automated Trivy Filesystem Scan in CI

**Spec**: `specs/trivy-fs-scan-ci.md`
**Created**: 2026-08-04
**Status**: approved

## Components

### 1. `.github/workflows/ci.yml`
- **Purpose**: add SHA-pinned `aquasecurity/trivy-action` fs scan step (vuln+secret+config), fail on HIGH/CRITICAL
- **Files**: `.github/workflows/ci.yml`
- **Effort**: S

### 2. `.trivyignore`
- **Purpose**: documented, empty-by-default ignore file for future accepted findings
- **Files**: `.trivyignore` (new)
- **Effort**: XS

### 3. `CLAUDE.md` documentation update
- **Purpose**: document the new step in the CI/CD section
- **Files**: `CLAUDE.md`
- **Effort**: XS

## Dependencies

### Build Order
1. `.trivyignore` (referenced by the workflow step)
2. `ci.yml` step
3. CLAUDE.md docs
4. Verification (CI run on push)

### External Dependencies
- `aquasecurity/trivy-action@<sha>` (pinned to latest stable tag's commit SHA, resolved via `gh api repos/aquasecurity/trivy-action/tags`)

## Risks & Assumptions

### Risks
- **Risk**: a future dependency bump introduces a real HIGH/CRITICAL and blocks an unrelated PR (including Dependabot PRs) until triaged. **Mitigation**: this is the intended, spec'd behavior (issue #30's AC explicitly wants fail-closed on HIGH/CRITICAL) — `.trivyignore` is the documented escape hatch for accepted risk.

### Assumptions
- Zero HIGH/CRITICAL findings currently exist in the repo (confirmed via local `trivy fs .` baseline run before writing the spec) — so the first CI run is expected green without needing real `.trivyignore` entries.

## Milestones

- [ ] Milestone 1: `.trivyignore` + `ci.yml` step added, scanners/severity/exit-code configured per spec
- [ ] Milestone 2: CI run on the branch passes (Trivy step green given the zero-HIGH/CRITICAL baseline)
- [ ] Milestone 3: `CLAUDE.md` updated, PR opened referencing issue #30

## Tasks

### Foundation
- [ ] **Task 1**: Create `.trivyignore` (header comment documenting format, no entries)
  - **Acceptance**: file exists at repo root
  - **Files**: `.trivyignore`
  - **Tests**: none
  - **Effort**: XS

- [ ] **Task 2**: Add Trivy fs scan step to `ci.yml`
  - **Acceptance**: SHA-pinned `aquasecurity/trivy-action` step with `scan-type: fs`, `scanners: vuln,secret,config`, `severity: HIGH,CRITICAL`, `exit-code: 1`; runs on the same `push`/`pull_request` triggers as `validate`
  - **Files**: `.github/workflows/ci.yml`
  - **Tests**: none (workflow file); verified functionally in Task 3
  - **Effort**: S

### Integration
- [ ] **Task 3**: Push branch, confirm CI run passes
  - **Acceptance**: `gh run list` shows a green run including the new Trivy step
  - **Files**: none
  - **Tests**: manual verification via `gh run list`/`gh run view`
  - **Effort**: XS

### Polish
- [ ] **Task 4**: Update `CLAUDE.md`'s CI/CD section
  - **Acceptance**: new paragraph documenting the Trivy fs scan step, its scanners, and `.trivyignore`'s role
  - **Files**: `CLAUDE.md`
  - **Tests**: none (docs)
  - **Effort**: XS

- [ ] **Task 5**: Open PR closing #30
  - **Acceptance**: PR references `Closes #30`, DoD checklist satisfied
  - **Files**: none
  - **Tests**: none
  - **Effort**: XS

## Effort Estimate

**Total Estimated**: ~45 min (S+XS+XS+XS+XS)

| Phase | Effort |
|-------|--------|
| Foundation (Tasks 1-2) | S |
| Integration (Task 3) | XS |
| Polish (Tasks 4-5) | XS |
