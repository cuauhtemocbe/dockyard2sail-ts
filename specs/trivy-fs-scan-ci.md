---
title: Automated Trivy Filesystem Scan in CI
status: approved
created: 2026-08-04
updated: 2026-08-04
issue: #30
---

# Automated Trivy Filesystem Scan in CI

## Objective

Add a Trivy filesystem scan (dependency CVEs + secrets + IaC misconfigurations) to `ci.yml` so every push/PR is checked automatically, closing the gap where `/trivy-scan` only runs when a human remembers to invoke it locally.

## Context

- `/trivy-scan` is documented in `CLAUDE.md` as part of the pre-commit/pre-merge workflow but is manual-only — nothing in CI invokes it.
- `ci.yml` is this repo's one required status check (part of the meta-projects auto-merge layer's `is_automerge_allowed` requirement); a PR — including an automated Dependabot PR — can satisfy it via `make validate` alone, which only runs `pnpm audit` (npm dependency CVEs), never secrets or Dockerfile/compose IaC misconfigurations.
- Local `gitleaks` in `.husky/pre-commit` covers secrets, but only on the host running the hook — never in CI.
- Baseline check (`trivy fs . --scanners vuln,secret,misconfig --severity CRITICAL,HIGH,MEDIUM`, run locally before writing this spec): **zero HIGH/CRITICAL findings** currently — one MEDIUM (`postcss` CVE-2026-69153, fixed upstream in 8.5.23, will clear via Dependabot). Since the gate only fails on HIGH/CRITICAL, the first CI run is expected green without needing to pre-populate `.trivyignore` with real exceptions.
- The local `/trivy-scan` skill's remediation workflow uses `.trivyignore.yaml` (structured, with `expired_at` review dates) for accepted risks — issue #30's own acceptance criteria instead names plain `.trivyignore` explicitly (`Given a finding listed in .trivyignore`). This spec follows the issue's literal wording for the CI gate; the two files serve different call sites (ad-hoc local scans vs. this CI gate) and Trivy supports both formats simultaneously, so this is not a conflict requiring resolution now.

## Requirements

### Functional Requirements

- [ ] New step in `ci.yml`'s `validate` job (or a new job) runs `aquasecurity/trivy-action` in filesystem mode against the repo root
- [ ] Scanners enabled: `vuln`, `secret`, `config` (misconfig) — matching the reference standard's `trivy-fs` scope
- [ ] HIGH/CRITICAL findings fail the workflow; the finding is visible in the job logs
- [ ] Findings listed in `.trivyignore` are suppressed and don't fail the job
- [ ] Runs on every `push` and `pull_request`, same triggers as the existing `validate` job

### Non-Functional Requirements

- [ ] Security: the `aquasecurity/trivy-action` step is pinned to a commit SHA with a version comment, per the same convention issue #29 establishes for `ci.yml`'s existing actions (applied here independently of whether #29 has merged first — this is a new action reference, so it starts pinned)
- [ ] Consistency: `permissions: contents: read` preserved at workflow level (this scan needs no elevated permissions, unlike the Dependabot Socket Firewall gate)

## Architecture

### Components

- `.github/workflows/ci.yml` — new step (or new job) added; existing `validate` job/steps unchanged
- `.trivyignore` — new, minimal (header comment only; no current exceptions needed per the zero-HIGH/CRITICAL baseline), documents the format for future accepted risks

## User Stories

See issue #30 body (User Story + Gherkin AC + DoD used verbatim as spec source, not duplicated here).

## Testing Strategy

No unit tests apply (workflow YAML + security scanner). Verification is functional:
- Local baseline scan (already run, see Context) confirms the first CI run won't be red for unrelated pre-existing findings
- A real CI run on the branch confirms the new step executes and passes
- Manually confirm the fail-closed behavior by temporarily forcing a HIGH-severity condition is impractical/unsafe to test against this real repo — accepted as unverified for the "does it actually fail on HIGH/CRITICAL" path, consistent with how issue #32's Socket Firewall spec accepted the blocked-package path as unverified for the same reason (no safe way to manufacture a real positive in this repo)

## Boundaries & Constraints

### In Scope
- One new Trivy fs scan step/job in `ci.yml`, plus a minimal `.trivyignore`

### Out of Scope
- Image scanning (`trivy image`) of the production Docker build — not part of issue #30's acceptance criteria, would need a build step first
- Migrating the local `/trivy-scan` skill's remediation workflow to use plain `.trivyignore` instead of `.trivyignore.yaml` — separate concern, not touched here

### Technical Constraints
- Must not weaken `ci.yml`'s workflow-level `permissions: contents: read`

## Success Criteria

- [ ] Trivy fs scan step added to `ci.yml`, running on every push/PR, covering vuln+secret+config
- [ ] `.trivyignore` created
- [ ] CI run on the branch passes
- [ ] `CLAUDE.md`'s CI/CD section documents the new step
- [ ] Issue #30's DoD checklist fully satisfied

## Implementation Plan

See `specs/trivy-fs-scan-ci-plan.md`.
