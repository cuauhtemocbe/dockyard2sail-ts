---
title: Fix Stale Docs References (vitest.config.ts, scripts/validate.sh)
status: approved
created: 2026-08-04
updated: 2026-08-04
issue: #31
---

# Fix Stale Docs References

## Objective

Update `README.md`, `docs/README_EN.md`, and `docs/TEMPLATE_INFO.md` so their file-structure sections match the actual repo — `vitest.config.ts` no longer exists (merged into `vite.config.ts`) and `scripts/validate.sh` no longer exists (replaced by `make validate`).

## Context

- `vitest.config.ts` was merged into `vite.config.ts`'s `test: {}` block (still current).
- `scripts/validate.sh` was removed and replaced by `make validate` (commit `b1940f9`, documented in `CLAUDE.md`'s Makefile section); `scripts/` now contains only `check-docs.sh`.
- Actual stale references found (verified by grep against the current repo, narrower than issue #31's text implied — its "Quick Start narrative still points at the removed script" claim didn't hold for the current state of the two READMEs, only for `TEMPLATE_INFO.md`'s file tree):
  - `README.md:49` — tree lists `vitest.config.ts`
  - `README.md:162` — "Testing (vitest.config.ts)" config section
  - `docs/README_EN.md:40` — tree lists `vitest.config.ts`
  - `docs/README_EN.md:204` — "Testing (vitest.config.ts)" config section
  - `docs/TEMPLATE_INFO.md:14` — tree lists `scripts/validate.sh`
  - `docs/TEMPLATE_INFO.md:33` — tree lists `vitest.config.ts`
- This is boilerplate documentation meant to be copied into forks — stale references propagate into every new project created from this template.

## Requirements

### Functional Requirements

- [ ] `README.md`'s "Estructura del Proyecto" tree: remove `vitest.config.ts` line, add `Makefile` entry
- [ ] `README.md`'s "Archivos de Configuración" section: replace the standalone "Testing (vitest.config.ts)" bullet with a note that testing config lives inside `vite.config.ts`
- [ ] `docs/README_EN.md`: same two corrections, English copy
- [ ] `docs/TEMPLATE_INFO.md`'s file tree: replace `scripts/validate.sh` entry with `Makefile`, remove `vitest.config.ts` entry

### Non-Functional Requirements

- [ ] No functional code touched — docs-only change, `pnpm lint`/`pnpm build` unaffected

## Architecture

### Components

- `README.md` (Spanish, primary)
- `docs/README_EN.md` (English translation)
- `docs/TEMPLATE_INFO.md` (boilerplate file-structure reference)

No data model or external dependencies — pure documentation edit.

## User Stories

See issue #31 body (User Story + Gherkin AC + DoD used verbatim as spec source, not duplicated here).

## Testing Strategy

Docs-only change; no automated test applies. Verification:
- `grep -rn "vitest.config.ts\|scripts/validate.sh" README.md docs/` returns no matches after the change
- Visual review that the three files stay internally consistent with each other and with the actual repo tree (`ls`)

## Boundaries & Constraints

### In Scope
- The specific stale references to `vitest.config.ts` and `scripts/validate.sh` listed in Context

### Out of Scope
- A full audit/rewrite of `docs/TEMPLATE_INFO.md` against every tool added since it was written (Biome, lint-staged, CHANGELOG.md, Dependabot, Trivy CI gate, Socket Firewall gate, etc.) — real gaps, but not what issue #31 asks for; scope-creep beyond its acceptance criteria
- Any other doc file not named in issue #31

### Technical Constraints
- Keep Spanish/English content parity between `README.md` and `docs/README_EN.md`

## Success Criteria

- [ ] Zero remaining references to `vitest.config.ts` or `scripts/validate.sh` under `docs/` or `README.md`
- [ ] All three files internally consistent and accurate against the current repo tree
- [ ] Issue #31's DoD checklist fully satisfied

## Implementation Plan

See `specs/docs-stale-references-plan.md`.
