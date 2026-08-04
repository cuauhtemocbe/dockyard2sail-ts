# Implementation Plan: Fix Stale Docs References

**Spec**: `specs/docs-stale-references.md`
**Created**: 2026-08-04
**Status**: approved

## Components

### 1. `README.md`
- **Purpose**: fix tree + config-section references
- **Files**: `README.md`
- **Effort**: XS

### 2. `docs/README_EN.md`
- **Purpose**: same corrections, English copy
- **Files**: `docs/README_EN.md`
- **Effort**: XS

### 3. `docs/TEMPLATE_INFO.md`
- **Purpose**: fix boilerplate file tree
- **Files**: `docs/TEMPLATE_INFO.md`
- **Effort**: XS

## Dependencies

### Build Order
No ordering constraints — three independent file edits.

### External Dependencies
None.

## Risks & Assumptions

### Risks
None of note — pure documentation edit, no build/runtime impact.

### Assumptions
None beyond the grep-verified current state captured in the spec's Context section.

## Milestones

- [ ] Milestone 1: all three files edited
- [ ] Milestone 2: grep confirms zero remaining stale references
- [ ] Milestone 3: PR opened referencing issue #31

## Tasks

### Foundation
- [ ] **Task 1**: Fix `README.md`
  - **Acceptance**: tree shows `Makefile`, no `vitest.config.ts`; config section notes testing config lives in `vite.config.ts`
  - **Files**: `README.md`
  - **Tests**: `grep -n "vitest.config.ts\|scripts/validate.sh" README.md` → no matches
  - **Effort**: XS

- [ ] **Task 2**: Fix `docs/README_EN.md`
  - **Acceptance**: same as Task 1, English copy
  - **Files**: `docs/README_EN.md`
  - **Tests**: `grep -n "vitest.config.ts\|scripts/validate.sh" docs/README_EN.md` → no matches
  - **Effort**: XS

- [ ] **Task 3**: Fix `docs/TEMPLATE_INFO.md`
  - **Acceptance**: tree shows `Makefile` instead of `scripts/validate.sh`, no `vitest.config.ts`
  - **Files**: `docs/TEMPLATE_INFO.md`
  - **Tests**: `grep -n "vitest.config.ts\|scripts/validate.sh" docs/TEMPLATE_INFO.md` → no matches
  - **Effort**: XS

### Polish
- [ ] **Task 4**: Open PR closing #31
  - **Acceptance**: PR references `Closes #31`, DoD checklist satisfied
  - **Files**: none
  - **Tests**: none
  - **Effort**: XS

## Effort Estimate

**Total Estimated**: ~15 min (all XS)

| Phase | Effort |
|-------|--------|
| Foundation (Tasks 1-3) | XS |
| Polish (Task 4) | XS |
