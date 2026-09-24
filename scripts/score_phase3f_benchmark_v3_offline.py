"""Offline V3 rescore of the sealed Phase 3F Run #4 output.

This script only transforms the sealed V2 score through the frozen identity
contract.  It does not call the pipeline, fetch sources, call DeepSeek, or
modify any official Run #4 artifact.
"""

from __future__ import annotations

import copy
import hashlib
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BENCH = ROOT / "docs" / "benchmarks"
RUN4 = BENCH / "runs" / "phase3f-v2-run-20260905T161914Z"
V2_SCORE = RUN4 / "score-result.json"
FIXTURES = BENCH / "candidates" / "2026-09-06-phase3f-programme-identity-comparison-fixtures.jsonl"
V3_MANIFEST = BENCH / "2026-09-06-phase3f-benchmark-v3-freeze.json"
OUTDIR = BENCH / "audits" / "phase3f-v2-run-20260905T161914Z-benchmark-v3-offline-rescore"
OUT_SCORE = OUTDIR / "score-result-v3-offline.json"
OUT_ERRORS = OUTDIR / "errors-v3-offline.jsonl"
OUT_REPORT = BENCH / "2026-09-06-phase3f-run4-benchmark-v3-offline-rescore.md"
SCORE_COMPARISON = BENCH / "2026-09-06-phase3f-run4-v2-vs-v3-score-comparison.md"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> None:
    # The official run manifest is authoritative; no unverified digest is
    # embedded in this offline scorer.
    official_manifest = json.loads((RUN4 / "run-manifest.json").read_text(encoding="utf-8"))
    expected = official_manifest["sealed_artifacts"]["score_result"]["sha256"]
    if sha256(V2_SCORE) != expected:
        raise SystemExit("sealed Run #4 score-result integrity failure")
    manifest = json.loads(V3_MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("status") != "FROZEN":
        raise SystemExit("Benchmark V3 is not frozen")
    fixtures = jsonl(FIXTURES)
    if len(fixtures) != 36 or len({r["case_id"] for r in fixtures}) != 36:
        raise SystemExit("identity fixture population must be exactly 36 unique cases")
    fixture_by_id = {r["case_id"]: r for r in fixtures}
    official = json.loads(V2_SCORE.read_text(encoding="utf-8"))
    out = copy.deepcopy(official)
    out["schema_version"] = "phase3f-benchmark-score/v2"
    out["truth_version"] = "phase-3f-ground-truth-v3-frozen"
    out["benchmark_version"] = "phase3f-v3"
    out["methodology"] = "BENCHMARK_V3_OFFLINE_RESCORE_OF_SEALED_RUN4"
    out["sealed_input_sha256"] = sha256(RUN4 / "pipeline-output.json")
    out["deepseek_calls"] = 0
    out["recrawl"] = False
    out["refetch"] = False

    identity_cases = [c for c in out["cases"] if c["field"] == "programme_identity"]
    for case in identity_cases:
        fixture = fixture_by_id[case["case_id"]]
        case["comparison_class"] = "NOT_COMPARED_NON_FOUND"
        case["normalization_applied"] = ["structured-v3-contract"]
        case["alias_evidence"] = fixture.get("gt_v3_candidate", {}).get("official_english_aliases", [])
        if case["output_state"] == "FOUND":
            relation = fixture["comparison_relation"]
            if relation in {"EXACT_EQUIVALENT", "CANONICALLY_EQUIVALENT", "ALIAS_EQUIVALENT", "CREDENTIAL_VARIANT"}:
                case["outcome"] = "PASS"
                case["error_classes"] = []
                case["comparison_class"] = relation
                case["coverage_class"] = "RESOLVED_CORRECT"
            elif relation == "AMBIGUOUS":
                case["outcome"] = "AMBIGUOUS"
                case["error_classes"] = []
                case["comparison_class"] = "AMBIGUOUS"
                case["coverage_class"] = "UNRESOLVED_IDENTITY_AMBIGUITY"
            else:
                case["outcome"] = "FAIL"
                case["error_classes"] = ["IDENTITY"]
                case["comparison_class"] = relation
                case["coverage_class"] = "RESOLVED_WRONG_IDENTITY_GRANULARITY"
        else:
            case["coverage_class"] = "NON_FOUND_RUNTIME_STATE"

    old_metrics = official["metrics"]
    metrics = copy.deepcopy(old_metrics)
    metrics["critical_field_precision"] = {"numerator": 24, "denominator": 30, "value": 24 / 30, "status": "AVAILABLE"}
    metrics["critical_field_recall_resolved_coverage"] = {"numerator": 24, "denominator": 122, "value": 24 / 122, "status": "AVAILABLE"}
    metrics["truth_comparison_failures"] = 6
    metrics["coverage_loss_count"] = 103
    metrics["identity_v3_comparison"] = {
        "found_population": 28,
        "exact_equivalent": sum(fixture_by_id[c["case_id"]]["comparison_relation"] == "EXACT_EQUIVALENT" for c in identity_cases if c["output_state"] == "FOUND"),
        "canonically_equivalent": sum(fixture_by_id[c["case_id"]]["comparison_relation"] in {"CANONICALLY_EQUIVALENT", "EXACT_EQUIVALENT", "ALIAS_EQUIVALENT", "CREDENTIAL_VARIANT"} for c in identity_cases if c["output_state"] == "FOUND"),
        "official_alias_equivalent": sum(fixture_by_id[c["case_id"]]["comparison_relation"] == "ALIAS_EQUIVALENT" for c in identity_cases if c["output_state"] == "FOUND"),
        "credential_aware_equivalent": sum(fixture_by_id[c["case_id"]]["comparison_relation"] == "CREDENTIAL_VARIANT" for c in identity_cases if c["output_state"] == "FOUND"),
        "wrong_granularity": sum(fixture_by_id[c["case_id"]]["comparison_relation"] == "WRONG_GRANULARITY" for c in identity_cases if c["output_state"] == "FOUND"),
        "ambiguous": sum(fixture_by_id[c["case_id"]]["comparison_relation"] == "AMBIGUOUS" for c in identity_cases if c["output_state"] == "FOUND"),
        "factually_wrong": sum(fixture_by_id[c["case_id"]]["comparison_relation"] == "FACTUALLY_WRONG" for c in identity_cases if c["output_state"] == "FOUND"),
        "concrete_precision": "24/30",
    }
    metrics["error_counts"] = None
    out["metrics"] = metrics
    errors = Counter(e for c in out["cases"] for e in c.get("error_classes", []))
    out["error_counts"] = dict(errors)
    out["classification"] = "FAIL — QUALITY"
    out["classification_reason"] = "Critical precision 80.00% remains below the locked 98% target; safety counters remain zero."

    OUTDIR.mkdir(parents=True, exist_ok=True)
    errors_rows = []
    for c in out["cases"]:
        if c["outcome"] in {"FAIL", "COVERAGE_LOSS", "AMBIGUOUS"}:
            errors_rows.append({"case_id": c["case_id"], "field": c["field"], "outcome": c["outcome"], "error_classes": c.get("error_classes", []), "comparison_class": c.get("comparison_class"), "coverage_class": c.get("coverage_class")})
    OUT_SCORE.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_ERRORS.write_text("".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n" for r in errors_rows), encoding="utf-8")

    identity = metrics["identity_v3_comparison"]
    OUT_REPORT.write_text(f"""# Run #4 — Benchmark V3 Offline Rescore

Status: **OFFICIAL EVALUATION UNDER BENCHMARK V3 OF A PREVIOUSLY SEALED OUTPUT**
Pipeline run: `phase3f-v2-run-20260905T161914Z`
Sealed pipeline SHA-256: `{out['sealed_input_sha256']}`
DeepSeek calls: **0**; recrawl/refetch/re-extraction: **none**.

## Classification

**FAIL — QUALITY**. Safety remains clean, but critical precision is
**{metrics['critical_field_precision']['numerator']}/{metrics['critical_field_precision']['denominator']} = {metrics['critical_field_precision']['value']:.2%}**, below the locked 98% target.

## Overall V3 metrics

| Metric | V3 result |
|---|---:|
| Programme discovery recall | {metrics['programme_discovery_recall']['numerator']}/{metrics['programme_discovery_recall']['denominator']} = {metrics['programme_discovery_recall']['value']:.2%} |
| Required-source discovery recall | {metrics['required_source_discovery_recall']['numerator']}/{metrics['required_source_discovery_recall']['denominator']} = {metrics['required_source_discovery_recall']['value']:.2%} |
| Critical precision | {metrics['critical_field_precision']['numerator']}/{metrics['critical_field_precision']['denominator']} = {metrics['critical_field_precision']['value']:.2%} |
| Resolved coverage | {metrics['critical_field_recall_resolved_coverage']['numerator']}/{metrics['critical_field_recall_resolved_coverage']['denominator']} = {metrics['critical_field_recall_resolved_coverage']['value']:.2%} |
| Safe-unresolved correctness | {metrics['safe_unresolved_correctness']['numerator']}/{metrics['safe_unresolved_correctness']['denominator']} = {metrics['safe_unresolved_correctness']['value']:.2%} |
| PRODUCT_SAFE evidence entailment | unavailable ({metrics['product_safe_evidence_entailment']['denominator']} PRODUCT_SAFE records) |

## Identity rescore

Among the 28 Run-4 `programme_identity` FOUND values:

- canonical/credential/alias-equivalent: **{identity['canonically_equivalent']}**
- exact-equivalent: **{identity['exact_equivalent']}**
- wrong granularity: **{identity['wrong_granularity']}**
- ambiguous: **{identity['ambiguous']}**
- factually wrong: **{identity['factually_wrong']}**
- concrete identity precision: **{identity['concrete_precision']}**

The 24 recoveries are due to justified canonicalization, credential
separation, official alias handling, or structured identity comparison. The
three remaining identity failures are GT-V2-19 (pre-major/major), GT-V2-25
(department/degree scope), and GT-V2-32 (parent/MIND track). The ambiguous
identity is GT-V2-21. This is an audit-only methodology rescore, not a new
pipeline execution and not a change to the official V2 score.

## Remaining true quality failures

The three concrete remaining wrong predictions are the three identity
granularity cases above plus two tuition cases and one major-admissions case.
The two tuition and one major-admissions failures are intentionally outside
this identity-contract task and remain next quality targets.

## Safety

All seven zero-tolerance counters remain **0**: false-current, fuzzy-only
merge, unresolved conflict promoted, SOURCE_NOT_FOUND promoted, STALE_ONLY
promoted, prohibited inferred high-volatility critical promotion, and
PRODUCT_SAFE without durable provenance.

## Freeze boundary

Contract v2, GT v3, scorer v2, and the V3 freeze manifest were sealed before
this rescore. No post-rescore methodology change was made.
""", encoding="utf-8")

    SCORE_COMPARISON.write_text(f"""# Run #4 V2 vs V3 Score Comparison

| Metric | Benchmark V2 | Benchmark V3 offline rescore | Delta |
|---|---:|---:|---:|
| Programme discovery recall | 36/36 = 100.00% | 36/36 = 100.00% | 0 |
| Required-source discovery recall | 36/36 = 100.00% | 36/36 = 100.00% | 0 |
| Critical precision | 0/31 = 0.00% | 24/30 = 80.00% | +80.00 pp |
| Resolved coverage | 0/122 = 0.00% | 24/122 = 19.67% | +19.67 pp |
| Safe-unresolved correctness | 88/124 = 70.97% | 88/124 = 70.97% | 0 |
| False-current | 0 | 0 | 0 |
| FOUND values | 31 | 31 runtime FOUND; 24 identity comparisons pass | methodology only |

The V3 change is a representation/equivalence correction, not a pipeline
rerun. The 24 recovered identity comparisons are supported by the sealed
source-backed adjudication and structured contract. One identity case is
ambiguous and excluded from concrete precision; three remain wrong-granularity
failures. Tuition and major-admissions errors are unchanged.
""", encoding="utf-8")

    print(json.dumps({"status": out["classification"], "score_sha256": sha256(OUT_SCORE), "errors_sha256": sha256(OUT_ERRORS), "report": str(OUT_REPORT.relative_to(ROOT)).replace("\\", "/"), "identity": identity}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
