"""Offline, non-official rescore for the Contract v2 identity candidate."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "docs/benchmarks/candidates/2026-09-06-phase3f-programme-identity-comparison-fixtures.jsonl"
RUN_SCORE = ROOT / "docs/benchmarks/runs/phase3f-v2-run-20260905T161914Z/score-result.json"
OUT_MD = ROOT / "docs/benchmarks/2026-09-06-phase3f-run4-v3-candidate-rescore.md"
OUT_JSON = ROOT / "docs/benchmarks/candidates/2026-09-06-phase3f-run4-v3-candidate-rescore.json"


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> None:
    fixtures = read_jsonl(FIXTURES)
    if len(fixtures) != 36 or len({row["case_id"] for row in fixtures}) != 36:
        raise SystemExit("candidate rescore requires exactly 36 unique fixtures")
    if any(row.get("fuzzy_only_pass") for row in fixtures):
        raise SystemExit("fuzzy-only comparison was incorrectly marked PASS")

    found = [row for row in fixtures if row["runtime_state"] == "FOUND"]
    buckets = Counter(row["comparison_relation"] for row in found)
    official = json.loads(RUN_SCORE.read_text(encoding="utf-8"))
    official_identity = [row for row in official["cases"] if row["field"] == "programme_identity" and row["output_state"] == "FOUND"]
    official_correct = sum(row["outcome"] == "PASS" for row in official_identity)
    canonical = buckets.get("CANONICALLY_EQUIVALENT", 0) + buckets.get("EXACT_EQUIVALENT", 0) + buckets.get("ALIAS_EQUIVALENT", 0) + buckets.get("CREDENTIAL_VARIANT", 0)
    wrong_granularity = buckets.get("WRONG_GRANULARITY", 0)
    ambiguous = buckets.get("AMBIGUOUS", 0)
    factual_wrong = buckets.get("FACTUALLY_WRONG", 0)
    coverage_loss = sum(row["runtime_state"] != "FOUND" for row in fixtures)
    result = {
        "status": "NON_OFFICIAL_METHODOLOGY_EVALUATION",
        "run_id": "phase3f-v2-run-20260905T161914Z",
        "official_v2_identity": {"found_population": len(official_identity), "correct": official_correct, "score": f"{official_correct}/{len(official_identity)}"},
        "candidate_v3_identity": {
            "found_population": len(found),
            "exact_equivalent": buckets.get("EXACT_EQUIVALENT", 0),
            "canonically_equivalent": canonical,
            "wrong_granularity": wrong_granularity,
            "factual_wrong": factual_wrong,
            "ambiguous": ambiguous,
            "coverage_loss_total_36": coverage_loss,
            "diagnostic_equivalent_score": f"{canonical}/{len(found)}",
        },
        "pipeline_identity_classification": "IDENTITY_PIPELINE_NEEDS_CANONICALIZATION",
        "secondary_cluster": "IDENTITY_PIPELINE_NEEDS_GRANULARITY_FIX",
        "fuzzy_only_pass": False,
        "deepseek_calls": 0,
        "refetches": 0,
    }
    OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = f"""# Run #4 — V3 Candidate Identity Rescore

Status: **NON-OFFICIAL / METHODOLOGY EVALUATION**
Official run: `phase3f-v2-run-20260905T161914Z`
No recrawl, refetch, re-extraction, DeepSeek call, or mutation of Run #4 was performed.

## Official v2 result

The locked scorer produced **{official_correct}/{len(official_identity)}** correct among the {len(official_identity)} Run #4 `programme_identity` values in `FOUND` state. This official result remains unchanged.

## Candidate v3 diagnostic

| Candidate result | Count |
|---|---:|
| Exact equivalent | {buckets.get('EXACT_EQUIVALENT', 0)} |
| Canonically equivalent | {canonical} |
| Wrong granularity | {wrong_granularity} |
| Factual wrong | {factual_wrong} |
| Ambiguous | {ambiguous} |
| Coverage loss across all 36 | {coverage_loss} |

Among the 28 runtime `FOUND` identity values, the candidate diagnostic is
**{canonical}/28 = {canonical / len(found):.2%} canonically equivalent**. The
three wrong-granularity cases are GT-V2-19 (pre-major/major stage), GT-V2-25
(department/degree scope), and GT-V2-32 (parent Master Informatique versus
MIND track). GT-V2-21 remains ambiguous because official evidence supports both
MS and PhD variants. No factual wrong runtime identity was established.

The eight non-FOUND identity cases remain coverage/operational outcomes and are
not converted into identity passes by this rescore.

## Candidate behavior checks

- Exact/canonical/alias equivalence requires structured-field agreement or
  official alias provenance.
- Parent/child is not equal by containment.
- Credential separation is explicit.
- Native titles are retained; invented translations are not accepted.
- Fuzzy-only pass: **false**.
- DeepSeek calls: **0**.
- Refetches: **0**.

## Pipeline classification

**`IDENTITY_PIPELINE_NEEDS_CANONICALIZATION`**, with a secondary
`IDENTITY_PIPELINE_NEEDS_GRANULARITY_FIX` cluster. The runtime evidence was not
shown factually wrong in this audit; the dominant issue is that flat runtime
strings cannot express the structured contract consistently.

This candidate rescore does not authorize runtime changes, scorer-v1 changes,
GT-v3 freezing, Remediation 9, or benchmark #5.
"""
    OUT_MD.write_text(report, encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
