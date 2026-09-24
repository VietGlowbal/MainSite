# Phase 3F GT v3 Candidate Report

Status: candidate only; no new truth freeze.

## Population

All 36 `programme_identity` cases were adjudicated. The 28 existing evidence-
first adjudications were reused without modification. The remaining eight were
reviewed in a separate blind Pass-1 artifact before GT/runtime/scorer reveal:

`2026-09-06-phase3f-programme-identity-remaining8-blind-pass1.jsonl`

## Candidate changes

- Factual GT corrections: **0 expected**.
- Representation restructures: **28**.
- Credential separations: represented throughout the structured candidate, with
  explicit credential components where evidence supports them.
- Hierarchy additions: parent/track/stage fields added for UCLA, UTokyo,
  Sorbonne, ETH, Michigan, and dual/joint programme cases.
- Alias metadata: official abbreviations and programme codes retained as aliases,
  never as fuzzy substitutions.
- Ambiguity represented explicitly: Harvard Electrical Engineering, Princeton
  Computer Science, Princeton Chemical and Biological Engineering, UTokyo ICE,
  UTokyo Computer Science, and related multi-variant cases.

V2 was not factually re-written. The candidate is a structured-schema evolution.

## Human review queue

The queue contains cases marked ambiguous, medium-confidence, or requiring a
policy choice about degree variants/identity granularity. Clear source-backed
cases do not require manual review before contract approval.

Machine-readable queue: `docs/benchmarks/audits/2026-09-06-phase3f-programme-identity-contract-v2-human-review-queue.jsonl`.

## Evidence-first sources for the eight additional cases

Official sources establish Harvard concentration structure, Princeton A.B. and
graduate degree offerings, UTokyo ICE master/doctorate scope, and Michigan
Aerospace/MAE identity. See the 36-case matrix for row-level locators.

## Gate

**Decision: `CONTRACT_V2_READY_FOR_HUMAN_APPROVAL`.**

The candidate is internally coherent and ready for human approval, subject to
the unresolved policy questions in the Contract v2 document. It is not frozen.
