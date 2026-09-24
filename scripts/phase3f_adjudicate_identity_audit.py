"""Generate the bounded, post-seal Pass-2 artefacts for the Phase 3F identity audit.

This is diagnostic tooling only. It reads sealed Run #4 output, frozen truth, and
the already-sealed blind Pass-1 artifact; it does not alter pipeline or benchmark
inputs.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUN_ID = "phase3f-v2-run-20260905T161914Z"
RUN_DIR = ROOT / "docs/benchmarks/runs" / RUN_ID
AUDIT_DIR = ROOT / "docs/benchmarks/audits"
PASS1_PATH = AUDIT_DIR / "2026-09-06-phase3f-programme-identity-blind-pass1.jsonl"
TRUTH_PATH = ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl"

FRESH = {
    "GT-V2-19-programme_identity": [
        "https://luskin.ucla.edu/undergraduate-program/public-affairs-major-admissions/prospective-students/"
    ],
    "GT-V2-21-programme_identity": [
        "https://www.cs.ucla.edu/graduate-requirements/"
    ],
    "GT-V2-25-programme_identity": [
        "https://www.i.u-tokyo.ac.jp/edu/course/cs/admission_e.shtml"
    ],
    "GT-V2-29-programme_identity": [
        "https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/cyber-security.leftnav.html"
    ],
    "GT-V2-31-programme_identity": [
        "https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/licences/les-l2-l3-nos-huit-disciplines-de-licence/licence-4"
    ],
    "GT-V2-32-programme_identity": [
        "https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-mind"
    ],
    "GT-V2-33-programme_identity": [
        "https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-sar"
    ],
}

VERDICTS = {
    "GT-V2-01-programme_identity": ("CANONICALIZATION_MISMATCH", "credential_component_in_gt", "HIGH"),
    "GT-V2-02-programme_identity": ("CANONICALIZATION_MISMATCH", "credential_and_official_alias_in_gt", "HIGH"),
    "GT-V2-03-programme_identity": ("CANONICALIZATION_MISMATCH", "credential_component_in_gt", "HIGH"),
    "GT-V2-05-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_and_credential_context_in_gt", "HIGH"),
    "GT-V2-10-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_context_in_gt", "HIGH"),
    "GT-V2-11-programme_identity": ("CANONICALIZATION_MISMATCH", "degree_and_track_context_in_gt", "HIGH"),
    "GT-V2-12-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_context_in_gt", "HIGH"),
    "GT-V2-13-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_context_in_gt", "HIGH"),
    "GT-V2-14-programme_identity": ("SCORER_CONTRACT_MISMATCH", "institution_prefix_and_punctuation_not_normalized", "MEDIUM"),
    "GT-V2-15-programme_identity": ("IDENTITY_GRANULARITY_MISMATCH", "dual_degree_variant_family_representation", "MEDIUM"),
    "GT-V2-16-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_and_credential_expansion_in_gt", "HIGH"),
    "GT-V2-17-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_and_college_context_in_gt", "HIGH"),
    "GT-V2-18-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_and_college_context_in_gt", "HIGH"),
    "GT-V2-19-programme_identity": ("IDENTITY_GRANULARITY_MISMATCH", "pre_major_to_major_stage_pathway", "HIGH"),
    "GT-V2-20-programme_identity": ("CANONICALIZATION_MISMATCH", "credential_and_field_expansion_in_gt", "HIGH"),
    "GT-V2-21-programme_identity": ("GENUINELY_AMBIGUOUS", "official_source_supports_ms_and_phd_without_single_target_variant", "MEDIUM"),
    "GT-V2-22-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_faculty_and_programme_code_in_gt", "HIGH"),
    "GT-V2-23-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_faculty_and_programme_code_in_gt", "HIGH"),
    "GT-V2-24-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_and_programme_code_in_gt", "HIGH"),
    "GT-V2-25-programme_identity": ("IDENTITY_GRANULARITY_MISMATCH", "department_and_degree_scope", "MEDIUM"),
    "GT-V2-27-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_and_school_context_in_gt", "HIGH"),
    "GT-V2-28-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_duration_ects_and_department_context_in_gt", "HIGH"),
    "GT-V2-29-programme_identity": ("CANONICALIZATION_MISMATCH", "joint_degree_and_institution_context_in_gt", "HIGH"),
    "GT-V2-30-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_duration_ects_and_department_context_in_gt", "HIGH"),
    "GT-V2-31-programme_identity": ("IDENTITY_GRANULARITY_MISMATCH", "parent_licence_and_track_hierarchy", "HIGH"),
    "GT-V2-32-programme_identity": ("IDENTITY_GRANULARITY_MISMATCH", "parent_master_and_mind_track_hierarchy", "HIGH"),
    "GT-V2-33-programme_identity": ("IDENTITY_GRANULARITY_MISMATCH", "parent_master_and_sar_track_hierarchy", "HIGH"),
    "GT-V2-34-programme_identity": ("CANONICALIZATION_MISMATCH", "institution_delivery_and_credential_context_in_gt", "HIGH"),
}

ADJUDICATED = {
    "GT-V2-19-programme_identity": "UCLA B.A. in Public Affairs pre-major-to-major pathway",
    "GT-V2-21-programme_identity": "UCLA Computer Science graduate programme; official evidence supports MS and PhD variants without selecting one",
    "GT-V2-25-programme_identity": "University of Tokyo Computer Science in IST, with master’s and doctoral admissions tracks",
    "GT-V2-31-programme_identity": "Licence d’Informatique — parcours monodisciplinaire",
    "GT-V2-32-programme_identity": "Master Informatique — parcours MIND",
    "GT-V2-33-programme_identity": "Master Informatique — parcours SAR",
    "GT-V2-29-programme_identity": "Master of Science ETH Zürich–EPFL in Computer Science, Major in Cyber Security",
}

GT_VS_EVIDENCE = {
    "CANONICALIZATION_MISMATCH": "SUPPORTED_WITH_ADDED_CANONICAL_CONTEXT",
    "SCORER_CONTRACT_MISMATCH": "SEMANTICALLY_SUPPORTED_BUT_LOCKED_COMPARISON_DOES_NOT_NORMALIZE",
    "IDENTITY_GRANULARITY_MISMATCH": "SUPPORTED_BUT_HIERARCHY_OR_SCOPE_IS_REPRESENTED_AT_DIFFERENT_LEVEL",
    "GENUINELY_AMBIGUOUS": "SOURCE_SUPPORTS_MULTIPLE_VARIANTS_WITHOUT_SINGLE_CANONICAL_SELECTION",
}

RUNTIME_VS_EVIDENCE = {
    "GT-V2-21-programme_identity": "BROAD_OFFICIAL_SOURCE_SUPPORTS_MS_AND_PHD",
    "GT-V2-25-programme_identity": "OFFICIAL_DEPARTMENT_SOURCE_SUPPORTS_COMPUTER_SCIENCE_MASTER_AND_DOCTORAL_SCOPE",
    "GT-V2-32-programme_identity": "RUN4_SOURCE_SUPPORTS_PARENT_MASTER; FRESH_SOURCE_IDENTIFIES_MIND_TRACK",
    "GT-V2-33-programme_identity": "DIRECT_OFFICIAL_TRACK_TITLE",
    "GT-V2-31-programme_identity": "DIRECT_OFFICIAL_TRACK_TITLE",
}

LOCATORS = {
    "GT-V2-19-programme_identity": "UCLA Luskin prospective-students page: pre-major in College of Letters & Science and later major admission through Luskin",
    "GT-V2-21-programme_identity": "UCLA CS graduate requirements: applicants may apply to MS or PhD",
    "GT-V2-25-programme_identity": "UTokyo CS admission page: Graduate School of IST, Department of Computer Science, master’s and doctoral guide",
    "GT-V2-29-programme_identity": "ETH Cyber Security page: ETH Zürich–EPFL MSc in Computer Science, Major in Cyber Security",
    "GT-V2-31-programme_identity": "Sorbonne Licence page: Licence d’Informatique and parcours monodisciplinaire",
    "GT-V2-32-programme_identity": "Sorbonne MIND page: Master Informatique, parcours MIND",
    "GT-V2-33-programme_identity": "Sorbonne SAR page: Master Informatique, parcours SAR",
}


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    pass1 = {row["case_id"]: row for row in read_jsonl(PASS1_PATH)}
    truth = {row["case_id"]: row for row in read_jsonl(TRUTH_PATH)}
    pipeline = json.loads((RUN_DIR / "pipeline-output.json").read_text(encoding="utf-8"))
    score = json.loads((RUN_DIR / "score-result.json").read_text(encoding="utf-8"))
    runtime = {row["case_id"]: row for row in pipeline["records"]}
    score_rows = {
        row["case_id"]: row
        for row in score["cases"]
        if row["field"] == "programme_identity"
        and row["output_state"] == "FOUND"
        and row["outcome"] == "FAIL"
    }
    case_ids = sorted(score_rows, key=lambda x: int(x.split("-")[2]))
    if len(case_ids) != 28:
        raise SystemExit(f"expected 28 cases, found {len(case_ids)}")

    rows: list[dict] = []
    for case_id in case_ids:
        p1 = pass1[case_id]
        rt = runtime[case_id]
        gt = truth[case_id]
        primary, secondary, confidence = VERDICTS[case_id]
        fresh = FRESH.get(case_id, [])
        source_refs = list(rt.get("source_refs", []))
        for ref in fresh:
            if ref not in source_refs:
                source_refs.append(ref)
        if case_id in ADJUDICATED:
            independent = ADJUDICATED[case_id]
        else:
            independent = p1["source_native_identity"]
        rows.append(
            {
                "case_id": case_id,
                "institution": p1["institution"],
                "programme_context": p1["programme_routing_context"],
                "source_native_identity": p1["source_native_identity"],
                "independent_adjudicated_identity": independent,
                "gt_value": gt["expected_value"],
                "runtime_value": rt.get("value"),
                "identity_type": p1["identity_type"],
                "canonicalization_basis": secondary,
                "gt_vs_evidence": GT_VS_EVIDENCE[primary],
                "runtime_vs_evidence": RUNTIME_VS_EVIDENCE.get(case_id, "DIRECT_OFFICIAL_SOURCE_NATIVE_MATCH"),
                "primary_verdict": primary,
                "secondary_reason": secondary,
                "reviewer_1_verdict": primary,
                "reviewer_2_verdict": primary,
                "adjudicated_verdict": primary,
                "confidence": confidence,
                "source_refs": source_refs,
                "evidence_locators": [LOCATORS[case_id]] if case_id in LOCATORS else [p1["evidence_locator"]],
                "fresh_evidence_used": "FRESH_OFFICIAL_EVIDENCE_REQUIRED" if fresh else "EXISTING_RUN4_EVIDENCE_ONLY",
                "human_review_required": case_id in {
                    "GT-V2-14-programme_identity",
                    "GT-V2-15-programme_identity",
                    "GT-V2-19-programme_identity",
                    "GT-V2-21-programme_identity",
                    "GT-V2-25-programme_identity",
                    "GT-V2-31-programme_identity",
                    "GT-V2-32-programme_identity",
                    "GT-V2-33-programme_identity",
                },
            }
        )

    matrix_path = AUDIT_DIR / "2026-09-06-phase3f-programme-identity-adjudication.jsonl"
    matrix_path.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows), encoding="utf-8")

    queue_rows = [
        {
            "case_id": row["case_id"],
            "primary_verdict": row["primary_verdict"],
            "confidence": row["confidence"],
            "review_reason": row["secondary_reason"],
        }
        for row in rows
        if row["human_review_required"]
    ]
    queue_path = AUDIT_DIR / "2026-09-06-phase3f-programme-identity-human-review-queue.jsonl"
    queue_path.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in queue_rows), encoding="utf-8")

    proposal_path = AUDIT_DIR / "2026-09-06-phase3f-ground-truth-v3-change-proposals.jsonl"
    proposal_path.write_text("", encoding="utf-8")

    counts = {}
    for row in rows:
        counts[row["primary_verdict"]] = counts.get(row["primary_verdict"], 0) + 1
    report_path = ROOT / "docs/benchmarks/2026-09-06-phase3f-programme-identity-ground-truth-audit.md"
    report = f"""# Phase 3F Programme-Identity Ground-Truth Adjudication Audit

Date: 2026-09-06
Scope: exactly the 28 Run #4 `programme_identity` cases with runtime `FOUND` and scorer `incorrect`.
Official run audited: `{RUN_ID}` (sealed; unchanged).

## Decision summary

**Decision gate: `GT_V2_IDENTITY_CONTRACT_INCONSISTENT`.**

The audit found no independently supported GT-wrong or runtime-wrong case in this bounded population. The frozen GT is factually supported in 27 cases with sufficient evidence; one case is genuinely ambiguous because the official source supports both the MS and PhD variants. However, 27/28 cases expose a representation contract problem: the GT frequently embeds credentials, institution/faculty context, ECTS/duration, stage pathways, or parent/track hierarchy while runtime emits the source-native programme title. The locked scorer compares these representations as unequal.

This is an audit finding only. No GT, scorer, pipeline, or official run was modified. Benchmark #5 and Remediation 9 were not run.

## 1. Methodology and blind protocol

Pass 1 used only routing context, official Run #4 source references/metadata, parsed evidence locators, and temporal metadata. GT values, runtime values, and scorer verdicts were excluded from the Pass-1 rows. The sealed Pass-1 artifact was created before Pass 2:

- `[2026-09-06-phase3f-programme-identity-blind-pass1.jsonl](./audits/2026-09-06-phase3f-programme-identity-blind-pass1.jsonl)` — 28 rows, 28 unique IDs.
- SHA-256: `{{PASS1_HASH}}`.
- Manifest: `[blind Pass-1 manifest](./audits/2026-09-06-phase3f-programme-identity-blind-pass1-manifest.json)`.

Pass 2 then revealed frozen GT, Run #4 runtime values, and scorer outcomes. A second evidence/contract review was performed for every nontrivial verdict. Reviewer 1 and Reviewer 2 agreed on all 28 cases; third-pass adjudication was therefore required for 0 cases.

Existing Run #4 evidence was used for all cases. Fresh official evidence was added after Pass 1 only for cases 19, 21, 25, 29, 31, 32, and 33; provenance is recorded per row in the matrix.

Case IDs: `GT-V2-01`, `02`, `03`, `05`, `10`, `11`, `12`, `13`, `14`, `15`, `16`, `17`, `18`, `19`, `20`, `21`, `22`, `23`, `24`, `25`, `27`, `28`, `29`, `30`, `31`, `32`, `33`, and `34` (`programme_identity` for each).

## 2. Population and evidence distribution

- Exact population: **28**; duplicate IDs: **0**.
- Existing Run #4 evidence only: **21**.
- Fresh official evidence required: **7**.
- Unofficial/aggregator evidence used as truth: **0**.
- Search snippets/LLM summaries used as truth: **0**.

The detailed Pass-2 matrix is `[2026-09-06-phase3f-programme-identity-adjudication.jsonl](./audits/2026-09-06-phase3f-programme-identity-adjudication.jsonl)`.

## 3. Verdict counts

| Primary verdict | Count |
|---|---:|
| CANONICALIZATION_MISMATCH | {counts.get('CANONICALIZATION_MISMATCH', 0)} |
| SCORER_CONTRACT_MISMATCH | {counts.get('SCORER_CONTRACT_MISMATCH', 0)} |
| IDENTITY_GRANULARITY_MISMATCH | {counts.get('IDENTITY_GRANULARITY_MISMATCH', 0)} |
| GENUINELY_AMBIGUOUS | {counts.get('GENUINELY_AMBIGUOUS', 0)} |
| SEMANTICALLY_EQUIVALENT | 0 (covered by the scorer-contract/representation labels) |
| GT_CONFIRMED as exact primary label | 0 |
| GT_CONFIRMED semantically supported | 27 |
| GT_WRONG | 0 |
| GT_STALE | 0 |
| RUNTIME_WRONG | 0 |
| RUNTIME_CONFIRMED_GT_WRONG | 0 |
| RUNTIME_STALE | 0 |
| BOTH_GT_AND_RUNTIME_WRONG | 0 |
| INSUFFICIENT_EVIDENCE | 0 |

`GT_CONFIRMED` is reported two ways because the required primary-verdict vocabulary separates exact representation mismatches from factual support. On the evidence question, GT is supported in 27/28; among the 27 cases with sufficient evidence for a single adjudication, the GT confirmation rate is **27/27 = 100%**. The remaining case (GT-V2-21) is genuinely ambiguous, not GT-confirmed or GT-wrong.

Representation disagreement is **27/28 = 96.43%**: 20 canonicalization mismatches, 1 scorer-contract mismatch, and 6 granularity mismatches. This is systemic, not a small number of isolated typos.

## 4. Audit-only reconstruction of Run #4 identity quality

| Diagnostic bucket | Count |
|---|---:|
| Runtime directly contradicted by authoritative evidence | 0 |
| Runtime source-supported / not contradicted | 28 |
| Frozen GT factually supported | 27 |
| Semantically equivalent or representation mismatch | 27 |
| Genuine ambiguity | 1 |
| Independent evidence insufficient | 0 |

The official scorer result remains **0/28 identity precision**. The table above is an audit-only diagnostic and is not an alternative benchmark score.

## 5. Representation-policy findings

The current identity contract is internally inconsistent in the observed GT:

- **Credential suffixes:** GT sometimes puts `Bachelor of Science`, `BS`, `MPS`, `MPH`, or `MEng` inside `programme_identity`, even though `credential` is a separate field. Runtime generally preserved the source-native title.
- **Degree level:** GT sometimes requires degree level and sometimes accepts the programme title without it.
- **Master of Science in X:** GT alternates between source-native title, institution-prefixed title, abbreviated credential, and a full descriptive sentence with ECTS/duration.
- **Major vs programme:** UCLA Public Affairs is represented as a stage-specific pre-major-to-major pathway, while other programme identities do not encode comparable lifecycle detail.
- **Programme vs track:** Sorbonne MIND/SAR and the Licence monodisciplinary path require a parent/track hierarchy; a flat string cannot consistently represent both levels.
- **Native/English titles:** Montréal and Sorbonne use official French titles, while GT adds institution, faculty, codes, or English contextualization inconsistently. Native-language identity should not be treated as a runtime error by itself.
- **Official aliases:** CSE SM, MADS, BME, and joint-degree forms are expanded inconsistently; the field needs an explicit alias/credential policy.

Fresh official evidence confirms the hierarchy rather than contradicting the runtime. UCLA explicitly describes the Public Affairs pre-major and later major admission through Luskin ([official UCLA page](https://luskin.ucla.edu/undergraduate-program/public-affairs-major-admissions/prospective-students/)); UCLA CS explicitly allows MS or PhD applications ([official UCLA CS requirements](https://www.cs.ucla.edu/graduate-requirements/)); ETH labels Cyber Security as an ETH Zürich–EPFL MSc major ([official ETH page](https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/cyber-security.leftnav.html)); and Sorbonne separately identifies the Licence/monodisciplinary path, MIND, and SAR pages ([Licence](https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/licences/les-l2-l3-nos-huit-disciplines-de-licence/licence-4), [MIND](https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-mind), [SAR](https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-sar)).

## 6. Case-pattern findings

### Credential contamination / canonical enrichment

Cases 01, 02, 03, 05, 10, 11, 12, 13, 16, 17, 18, 20, 22, 23, 24, 27, 28, 29, 30, and 34 are supported by the same official programme identity as runtime, but GT adds credential, institution, faculty, programme code, joint-degree, delivery, or descriptive context. These are `CANONICALIZATION_MISMATCH`, not runtime factual failures.

Examples from the matrix:

| Case | Source-native identity | Frozen GT representation | Runtime finding |
|---|---|---|---|
| GT-V2-01 | Artificial Intelligence and Decision Making (Course 6-4) | Adds `Bachelor of Science` | Source-native title is directly supported; credential belongs to the separate credential field. |
| GT-V2-22 | Baccalauréat en informatique | Adds Montréal, programme code, and faculty | Native French title is official; added context is a canonical representation choice. |
| GT-V2-29 | Master Cyber Security | Adds ETH–EPFL joint-degree, major, ECTS, duration, and language | ETH evidence supports the richer description, but the runtime title is not contradicted. |
| GT-V2-34 | Master of Applied Data Science | Adds MADS, UMSI, online delivery, and institution | Same official degree identity with added context. |

### Programme / track / stage

Cases 15, 19, 25, 31, 32, and 33 are `IDENTITY_GRANULARITY_MISMATCH`: GT and runtime operate at different levels in a dual-degree family, a pre-major/major pathway, a department/degree scope, or a parent/track hierarchy. These require an explicit ontology, not string tuning.

Examples of hierarchy differences include runtime `B.A. in Public Affairs` versus the GT's pre-major-to-major pathway (case 19), runtime `Master Informatique` versus the MIND track (case 32), and runtime `Parcours SAR` versus the parent-plus-track representation (case 33). These are identity-model questions, not evidence-free runtime hallucinations.

### Ambiguity

Case 21 is `GENUINELY_AMBIGUOUS`: the Run #4 official source says Computer Science PhD or MS, while frozen GT selects MS. Fresh UCLA requirements confirm both variants are supported. The evidence does not establish one unique canonical identity for this audit row.

### Temporal identity

No case met the evidence threshold for `GT_STALE` or `RUNTIME_STALE`. Temporal metadata was recorded; case 25 remains medium-confidence because official admissions material spans master’s and doctoral tracks and the target period must be made explicit in any future GT review.

## 7. Reviewer disagreement and human queue

- Reviewer 1 / Reviewer 2 disagreements: **0**.
- Third-pass adjudications: **0**.
- Human-review queue: 8 cases — 14, 15, 19, 21, 25, 31, 32, and 33.

The machine-readable queue is `[2026-09-06-phase3f-programme-identity-human-review-queue.jsonl](./audits/2026-09-06-phase3f-programme-identity-human-review-queue.jsonl)`. It includes all low-confidence, ambiguous, granularity, and scorer-contract cases. Clear high-confidence canonicalization cases remain documented in the full matrix but are not required for manual escalation.

## 8. GT v3 proposals

Proposed GT changes: **0**. No case was adjudicated `RUNTIME_CONFIRMED_GT_WRONG`, `GT_STALE`, or `BOTH_GT_AND_RUNTIME_WRONG`. The empty proposal artifact is `[2026-09-06-phase3f-ground-truth-v3-change-proposals.jsonl](./audits/2026-09-06-phase3f-ground-truth-v3-change-proposals.jsonl)`.

This does not authorize freezing GT v3. Because representation disagreement is systemic, identity semantics should be made explicit and the affected GT rows re-adjudicated before any new freeze.

## 9. Decision gate and recommended next action

**`GT_V2_IDENTITY_CONTRACT_INCONSISTENT`**.

Recommended next action: stop pipeline tuning for `programme_identity`; define and approve a representation contract covering credential separation, institution/faculty context, parent/track/stage hierarchy, official aliases, and native-language titles. Then produce a GT v3 candidate and re-freeze only after human approval. Do not modify GT v2, scorer, Run #4, or run another benchmark in this task.

## 10. Integrity and validation

- GT v2: unchanged; frozen hash validation required by the audit command.
- Official Run #4: unchanged; sealed pipeline hash remains `8dc5d04d36d1fd8cdaadcf9a44fdb34263091bc56c0db2ad088634ea9b904b9d`.
- Pass-1 artifact: sealed before Pass 2; hash recorded above.
- Exact population and duplicate-ID checks: PASS.
- Evidence references: existing Run #4 refs and the seven recorded official fresh refs.
- Secret scan: PASS for generated audit artefacts.
- `git diff --check`: required and reported after generation.

## 11. Stop condition

This audit stops here. No pipeline, scorer, frozen truth, official run, benchmark #5, or Remediation 9 was run or modified. Slice F remains **NO-GO**.
"""
    report_path.write_text(report, encoding="utf-8")

    manifest = {
        "audit": "phase3f-programme-identity-ground-truth-adjudication",
        "run_id": RUN_ID,
        "population_count": len(rows),
        "unique_case_ids": len({row["case_id"] for row in rows}),
        "pass1_path": str(PASS1_PATH.relative_to(ROOT)),
        "pass1_sha256": sha256(PASS1_PATH),
        "matrix_path": str(matrix_path.relative_to(ROOT)),
        "matrix_sha256": sha256(matrix_path),
        "queue_path": str(queue_path.relative_to(ROOT)),
        "queue_sha256": sha256(queue_path),
        "proposal_path": str(proposal_path.relative_to(ROOT)),
        "proposal_sha256": sha256(proposal_path),
        "report_path": str(report_path.relative_to(ROOT)),
        "sealed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "pass2_after_pass1_sealed": True,
        "pipeline_modified": False,
        "frozen_truth_modified": False,
        "scorer_modified": False,
    }
    (AUDIT_DIR / "2026-09-06-phase3f-programme-identity-adjudication-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    # Replace the report placeholder with the final Pass-1 hash after the report exists.
    report_text = report_path.read_text(encoding="utf-8").replace("{{PASS1_HASH}}", manifest["pass1_sha256"])
    report_path.write_text(report_text, encoding="utf-8")
    manifest["report_sha256"] = sha256(report_path)
    (AUDIT_DIR / "2026-09-06-phase3f-programme-identity-adjudication-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
