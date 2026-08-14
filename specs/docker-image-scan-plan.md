# Implementation Plan: Build and Scan the Production Docker Image on Push to Main

**Spec**: GitHub issue [#50](https://github.com/cuauhtemocbe/dockyard2sail-ts/issues/50) (issue serves as spec source — Specify phase skipped, issue already contains user story, technical context, Gherkin acceptance criteria and DoD)
**Created**: 2026-08-13
**Status**: draft

## Components

### 1. `.github/workflows/ci.yml`
- **Purpose**: add a `docker-image` job that builds the production image (`docker build -f Dockerfile .`) and runs a Trivy `scan-type: image` scan against it, gated to `push` on `main` only, depending on `lint` + `test` (per issue's explicit "after lint/test pass" requirement — mirrors `build`'s existing `needs: [lint, test]`)
- **Files**: `.github/workflows/ci.yml`
- **Effort**: S

### 2. `src/test/ci-workflow.test.ts`
- **Purpose**: extend the existing js-yaml structural test suite (same approach used for the CI job-split story, #48) to cover the 3 Gherkin scenarios: job exists, `needs` includes `lint`+`test`, and the `if` gate matches the `push`+`main` condition (this single condition structurally covers both "runs on push to main" and "skipped on PR", since a PR event never satisfies `github.event_name == 'push'`)
- **Files**: `src/test/ci-workflow.test.ts`
- **Effort**: XS

### 3. `CLAUDE.md` documentation update
- **Purpose**: document the new `docker-image` job in the CI/CD section, alongside the existing job list and gating explanation
- **Files**: `CLAUDE.md`
- **Effort**: XS

## Dependencies

### Build Order
1. `ci.yml` — add `docker-image` job
2. `ci-workflow.test.ts` — structural tests (red before the job exists, green after)
3. `CLAUDE.md` docs
4. Verification (push branch, confirm the job runs on a PR is skipped, and separately confirm gate logic is correct — full main-push behavior can only be observed after merge)

### External Dependencies
- `aquasecurity/trivy-action` — already pinned in `ci.yml` for `trivy-fs` (`ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0`); reuse the same pinned SHA for the image scan step, no new dependency introduced.

## Risks & Assumptions

### Risks
- **Risk**: building the full production image on every push to `main` adds runtime to CI (multi-stage build: `pnpm install` + `typecheck` + `build` inside the builder stage, again). **Mitigation**: job is gated to `main`-push only (not every PR), matching the issue's explicit scope — cost is paid once per merge, not per PR iteration.
- **Risk**: a HIGH/CRITICAL CVE in the `node:26-alpine` base image blocks the job on an unrelated push to `main` (no code changed, just a newly-published CVE). **Mitigation**: same fail-closed behavior already accepted for `trivy-fs` (documented precedent); `.trivyignore` is the existing escape hatch for accepted risk, shared across both scan steps.
- **Risk**: since this only builds+scans (no registry push, per issue's explicit out-of-scope note), the image is discarded at the end of the job — no artifact is retained for inspection if the scan fails. **Mitigation**: out of scope per the issue; Trivy's failure output in the job log is sufficient to diagnose (matches `trivy-fs`'s existing UX).

### Assumptions
- ~~No HIGH/CRITICAL findings currently exist in the production image~~ — **invalidated**: local baseline (`docker build` + `trivy image --severity HIGH,CRITICAL`) found 27 findings, all bundled inside `pnpm@9.0.0` (installed in the `production` stage solely to run `pnpm add -g serve`) and its transitive deps — none execute at runtime. Filed as follow-up issue [#56](https://github.com/cuauhtemocbe/dockyard2sail-ts/issues/56), fixed in a separate PR (user's explicit call: keep #50 scoped to CI only). The `docker-image` job merges as designed and is expected to fail on `main` until #56 lands — acceptable per that decision.
- `needs: [lint, test]` is the correct interpretation of "whichever validation job(s) exist at implementation time" — the issue's own technical context cites this exact pair ("after lint/test pass (`needs: [...]`) — mirrors the already-existing gating pattern used for `trivy-fs`"), and it's the same pair `build` already depends on.

## Milestones

- [ ] Milestone 1: `docker-image` job added to `ci.yml` (build + Trivy image scan, `needs: [lint, test]`, gated to `push` on `main`)
- [ ] Milestone 2: `ci-workflow.test.ts` extended, all 3 Gherkin scenarios have a passing structural test
- [ ] Milestone 3: local baseline confirms zero HIGH/CRITICAL in the built image; `CLAUDE.md` updated; PR opened referencing issue #50

## Tasks

### Foundation
- [ ] **Task 1**: Add `docker-image` job to `ci.yml`
  - **Acceptance**: job named `docker-image`, `needs: [lint, test]`, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, builds `docker build -f Dockerfile .`, then runs SHA-pinned `aquasecurity/trivy-action` with `scan-type: image`, `image-ref` pointing at the just-built tag, `severity: HIGH,CRITICAL`, `exit-code: 1`
  - **Files**: `.github/workflows/ci.yml`
  - **Tests**: none (workflow file itself); verified structurally in Task 2
  - **Effort**: S

- [ ] **Task 2**: Extend `ci-workflow.test.ts` with structural coverage
  - **Acceptance**: 3 new/extended tests — (1) `workflow.jobs` has a `docker-image` key, (2) its `needs` array contains `lint` and `test`, (3) its `if` string matches the `push`+`refs/heads/main` gate — all passing against the `ci.yml` from Task 1
  - **Files**: `src/test/ci-workflow.test.ts`
  - **Tests**: this task *is* the tests (TDD: write against current `ci.yml` first to confirm they fail, then Task 1's job makes them pass — or implement Task 1 first and write tests immediately after, whichever order is more natural once in IMPLEMENT)
  - **Effort**: XS

### Integration
- [ ] **Task 3**: Local baseline validation
  - **Acceptance**: `docker build -f Dockerfile -t dockyard2sail-ts:baseline .` followed by a local `trivy image dockyard2sail-ts:baseline --severity HIGH,CRITICAL` (or equivalent) comes back clean, confirming the new CI job is expected to pass on first run
  - **Files**: none
  - **Tests**: manual, local only
  - **Effort**: XS

- [ ] **Task 4**: Push branch, confirm PR-triggered run skips `docker-image`
  - **Acceptance**: `gh run list` / `gh run view` on the open PR shows the `docker-image` job absent or skipped (PR events never satisfy the `push`+`main` gate) — the one part of the Gherkin behavior that can be observed pre-merge
  - **Files**: none
  - **Tests**: manual verification via `gh run list`/`gh run view`
  - **Effort**: XS

### Polish
- [ ] **Task 5**: Update `CLAUDE.md`'s CI/CD section
  - **Acceptance**: new sentence(s) documenting `docker-image` alongside the existing job list — that it's `main`-push-only, builds the production image, and runs the same Trivy image-scan gate as `trivy-fs` (fail-closed on HIGH/CRITICAL, `.trivyignore` shared escape hatch)
  - **Files**: `CLAUDE.md`
  - **Tests**: none (docs)
  - **Effort**: XS

- [ ] **Task 6**: Open PR closing #50
  - **Acceptance**: PR references `Closes #50`, DoD checklist from the issue satisfied (all Gherkin scenarios have passing automated tests, `needs` verified structurally, HIGH/CRITICAL gate reuses the `trivy-fs` mechanism, lint+typecheck green)
  - **Files**: none
  - **Tests**: none
  - **Effort**: XS

## Effort Estimate

**Total Estimated**: ~1 hour (S + XS + XS + XS + XS + XS)

| Phase | Effort |
|-------|--------|
| Foundation (Tasks 1-2) | S |
| Integration (Tasks 3-4) | XS |
| Polish (Tasks 5-6) | XS |
