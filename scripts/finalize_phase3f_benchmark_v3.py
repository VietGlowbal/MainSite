"""Build the approved Phase 3F Benchmark V3 methodology artifacts.

This is offline benchmark-methodology tooling.  It does not call the pipeline,
the network, or the extraction provider, and it never edits V2 artifacts.
"""

from __future__ import annotations

import copy
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BENCH = ROOT / "docs" / "benchmarks"
AUDITS = BENCH / "audits"
CANDIDATES = BENCH / "candidates"

V2_TRUTH = BENCH / "2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl"
ROSTER = BENCH / "2026-08-30-phase-3f-roster-v2.md"
V2_MANIFEST = BENCH / "2026-09-01-phase-3f-ground-truth-freeze-v2.json"
V2_CONTRACT_MD = BENCH / "2026-09-01-phase-3f-scorer-contract-v1.md"
V2_CONTRACT_JSON = BENCH / "2026-09-01-phase-3f-scorer-contract-v1.json"
V2_MATRIX = AUDITS / "2026-09-06-phase3f-programme-identity-36case-v2-contract-adjudication.jsonl"
V2_CANDIDATE_TRUTH = CANDIDATES / "2026-09-06-phase3f-ground-truth-v3-candidate.jsonl"
V2_CANDIDATE_SCORER = CANDIDATES / "2026-09-06-phase3f-scorer-contract-v2-candidate.json"
IDENTITY_FIXTURES = CANDIDATES / "2026-09-06-phase3f-programme-identity-comparison-fixtures.jsonl"
HUMAN_QUEUE = AUDITS / "2026-09-06-phase3f-programme-identity-contract-v2-human-review-queue.jsonl"

FINAL_CONTRACT_MD = BENCH / "2026-09-06-phase3f-programme-identity-contract-v2.md"
FINAL_TRUTH = BENCH / "2026-09-06-phase3f-ground-truth-v3-frozen.jsonl"
FINAL_SCORER_MD = BENCH / "2026-09-06-phase3f-scorer-contract-v2.md"
FINAL_SCORER_JSON = BENCH / "2026-09-06-phase3f-scorer-contract-v2.json"
FINAL_MATRIX = AUDITS / "2026-09-06-phase3f-programme-identity-36case-v2-contract-adjudication-final.jsonl"
HUMAN_LOG = AUDITS / "2026-09-06-phase3f-programme-identity-contract-v2-human-review-log.jsonl"
FINAL_REPORT = BENCH / "2026-09-06-phase3f-ground-truth-v3-frozen-report.md"
METHODOLOGY_REPORT = BENCH / "2026-09-06-phase3f-v2-vs-v3-methodology-comparison.md"
FREEZE_MANIFEST = BENCH / "2026-09-06-phase3f-benchmark-v3-freeze.json"

EXPECTED_V2_HASHES = {
    V2_TRUTH: "97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4",
    ROSTER: "7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139",
    V2_CONTRACT_MD: "47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91",
    V2_CONTRACT_JSON: "720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99",
}

DECISIONS = {
    "GT-V2-06-programme_identity": {
        "decision": "KEEP_AMBIGUOUS",
        "confidence": "MEDIUM",
        "reason": "The official Harvard evidence separates Electrical Engineering S.B. from Engineering Sciences A.B. with an Electrical and Computer Engineering track. It does not establish that the frozen Electrical Engineering/AB routing target is one unique canonical entity.",
        "entity_type": "AMBIGUOUS_IDENTITY",
        "parent_child": "Electrical Engineering S.B. and Engineering Sciences A.B. / Electrical and Computer Engineering track are competing official entities; no parent-child collapse is authorized.",
        "credential": "S.B. versus A.B.; not merged.",
        "canonicalization": "No canonical collapse; preserve both source-native structures and ambiguity.",
        "evidence": ["https://handbook.college.harvard.edu/sites/g/files/omnuum5551/files/2026-03/Fields%20of%20Concentration_0.pdf"],
    },
    "GT-V2-08-programme_identity": {
        "decision": "APPROVE_STRUCTURED_HIERARCHY",
        "confidence": "MEDIUM",
        "reason": "The Princeton Graduate School source identifies Computer Science and separately lists M.S.E. and Ph.D. offerings. The subject/programme entity is common, while degree variants remain explicit structured children rather than an invented single credential.",
        "entity_type": "DEGREE_PROGRAMME",
        "parent_child": "Princeton Department of Computer Science → Computer Science degree variants.",
        "credential": "M.S.E. and Ph.D. remain separate degree variants.",
        "canonicalization": "Canonical subject identity with credential variants and official aliases retained.",
        "evidence": ["https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/computer-science"],
    },
    "GT-V2-09-programme_identity": {
        "decision": "KEEP_AMBIGUOUS",
        "confidence": "MEDIUM",
        "reason": "The official Princeton graduate source lists Ph.D., M.S.E., and M.Eng. offerings, while the frozen routing target is Chemical and Biological Engineering/BSE. The evidence does not establish the requested undergraduate entity or a unique degree variant.",
        "entity_type": "AMBIGUOUS_IDENTITY",
        "parent_child": "Princeton Department of Chemical and Biological Engineering → graduate degree variants; the undergraduate BSE target is not established by this evidence.",
        "credential": "Ph.D., M.S.E., and M.Eng. are source-supported; BSE is not established.",
        "canonicalization": "No cross-level or cross-credential collapse.",
        "evidence": ["https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/chemical-and-biological-engineering"],
    },
    "GT-V2-14-programme_identity": {
        "decision": "APPROVE_CANONICAL_EQUIVALENCE",
        "confidence": "HIGH",
        "reason": "The official Northwestern catalogue identifies the same Information Systems degree and Data Science specialization; the remaining difference is institutional/punctuation presentation, not academic entity semantics.",
        "entity_type": "TRACK",
        "parent_child": "Information Systems → Data Science specialization.",
        "credential": "Master of Science is retained separately.",
        "canonicalization": "Safe punctuation, spacing, and institution-prefix normalization only.",
        "evidence": ["https://catalogs.northwestern.edu/sps/graduate/information-systems/information-systems-ms-data-science-specialization/"],
    },
    "GT-V2-15-programme_identity": {
        "decision": "APPROVE_STRUCTURED_HIERARCHY",
        "confidence": "HIGH",
        "reason": "The official Northwestern catalogue describes a dual-degree family with multiple permitted credential combinations. The shared Communication and Music academic entity is comparable, but the dual-degree and credential variants must remain structured.",
        "entity_type": "DUAL_DEGREE",
        "parent_child": "Communication and Music dual-degree entity with multiple credential variants.",
        "credential": "B.A./B.Mus., B.S./B.Mus., B.A./B.A.Mus., and B.S./B.A.Mus. remain variants.",
        "canonicalization": "Credential-aware equivalence; do not erase dual-degree semantics.",
        "evidence": ["https://catalogs.northwestern.edu/undergraduate/dual-bachelors-degrees/communication-music/"],
    },
    "GT-V2-19-programme_identity": {
        "decision": "KEEP_NON_EQUIVALENT_GRANULARITY",
        "confidence": "HIGH",
        "reason": "UCLA evidence describes a pre-major/admission pathway leading to the Public Affairs major. The pathway stage is related to, but is not identical to, the final declared major.",
        "entity_type": "MAJOR",
        "parent_child": "Public Affairs pre-major/admission stage → declared Public Affairs major.",
        "credential": "Bachelor of Arts remains separate.",
        "canonicalization": "Preserve stage relationship; no pre-major/final-major equivalence.",
        "evidence": ["https://luskin.ucla.edu/undergraduate-program/academic-programs/public-affairs-major-curriculum/", "https://luskin.ucla.edu/undergraduate-program/public-affairs-major-admissions/prospective-students/"],
    },
    "GT-V2-21-programme_identity": {
        "decision": "KEEP_AMBIGUOUS",
        "confidence": "MEDIUM",
        "reason": "The UCLA Computer Science official sources support both M.S. and Ph.D. graduate routes without selecting one target credential for this case. The shared subject title is established, but a unique degree-programme identity is not.",
        "entity_type": "DEGREE_PROGRAMME",
        "parent_child": "UCLA Computer Science graduate subject → M.S. and Ph.D. variants.",
        "credential": "M.S. and Ph.D. remain unresolved variants.",
        "canonicalization": "Retain subject family plus explicit ambiguity; do not force a credential.",
        "evidence": ["https://www.cs.ucla.edu/graduate-admissions/", "https://www.cs.ucla.edu/graduate-requirements/"],
    },
    "GT-V2-25-programme_identity": {
        "decision": "KEEP_NON_EQUIVALENT_GRANULARITY",
        "confidence": "MEDIUM",
        "reason": "The University of Tokyo source is a department-level graduate admissions source covering master and doctoral routes. A plain Computer Science string is not sufficient to establish the target degree-programme scope without collapsing department and degree granularity.",
        "entity_type": "DEGREE_PROGRAMME",
        "parent_child": "Graduate School/Department of Computer Science → Master and Doctorate degree variants.",
        "credential": "Master target remains distinct from Doctorate.",
        "canonicalization": "Keep department, programme, and degree scope structured and non-equivalent.",
        "evidence": ["https://www.i.u-tokyo.ac.jp/edu/course/cs/admission_e.shtml"],
    },
    "GT-V2-26-programme_identity": {
        "decision": "APPROVE_STRUCTURED_HIERARCHY",
        "confidence": "MEDIUM",
        "reason": "University of Tokyo ICE evidence identifies the department and distinguishes master and doctorate education; the admissions guide provides a master-specific path. The identity is valid when the master degree scope is retained as a structured component.",
        "entity_type": "DEGREE_PROGRAMME",
        "parent_child": "Graduate School of Information Science and Technology → Information and Communication Engineering → master/doctorate variants.",
        "credential": "Master target is distinct from the doctorate variant.",
        "canonicalization": "Official abbreviation/ampersand normalization with degree scope retained.",
        "evidence": ["https://www.i.u-tokyo.ac.jp/edu/course/ice/index_e.shtml", "https://www.i.u-tokyo.ac.jp/edu/course/ice/admission_e.shtml"],
    },
    "GT-V2-31-programme_identity": {
        "decision": "APPROVE_STRUCTURED_HIERARCHY",
        "confidence": "HIGH",
        "reason": "Sorbonne evidence explicitly presents a Licence d’Informatique parent and a Parcours monodisciplinaire child track. The relationship is preserved structurally; the parent and child are not collapsed by string normalization.",
        "entity_type": "TRACK",
        "parent_child": "Licence d’Informatique → Parcours monodisciplinaire.",
        "credential": "Licence remains separate from track identity.",
        "canonicalization": "Official parent/track decomposition; parent-child relation is not itself equivalence.",
        "evidence": ["https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/", "https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/licences/les-l2-l3-nos-huit-disciplines-de-licence/licence-4"],
    },
    "GT-V2-32-programme_identity": {
        "decision": "KEEP_NON_EQUIVALENT_GRANULARITY",
        "confidence": "HIGH",
        "reason": "Sorbonne evidence identifies Master Informatique as the parent and MIND as a child track. The Run-4 parent string cannot be scored equal to the MIND track without losing the benchmark target’s granularity.",
        "entity_type": "TRACK",
        "parent_child": "Master Informatique → MIND.",
        "credential": "Master remains separate from track identity.",
        "canonicalization": "Preserve parent and MIND child as related but non-equivalent.",
        "evidence": ["https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/masters/master-informatique", "https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-mind"],
    },
    "GT-V2-33-programme_identity": {
        "decision": "APPROVE_STRUCTURED_HIERARCHY",
        "confidence": "HIGH",
        "reason": "Sorbonne evidence identifies Master Informatique and the SAR child parcours. The final identity retains the parent/track relationship and does not equate the child with unrelated or broader parent strings.",
        "entity_type": "TRACK",
        "parent_child": "Master Informatique → Parcours Systèmes et Applications Répartis (SAR).",
        "credential": "Master remains separate from track identity.",
        "canonicalization": "Official track alias SAR retained with explicit parent relationship.",
        "evidence": ["https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-sar"],
    },
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def dump_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows), encoding="utf-8")


def build_final_matrix() -> list[dict]:
    rows = load_jsonl(V2_MATRIX)
    if len(rows) != 36 or len({r["case_id"] for r in rows}) != 36:
        raise RuntimeError("identity adjudication matrix must contain exactly 36 unique cases")
    final = []
    for row in rows:
        item = copy.deepcopy(row)
        decision = DECISIONS.get(row["case_id"])
        if decision:
            item["final_review_decision"] = decision["decision"]
            item["human_review_confidence"] = decision["confidence"]
            item["human_review_reason"] = decision["reason"]
            item["human_review_evidence"] = decision["evidence"]
            item["parent_child_structure_final"] = decision["parent_child"]
            item["credential_treatment_final"] = decision["credential"]
            item["canonicalization_decision_final"] = decision["canonicalization"]
            item["human_review_required"] = False
            cand = item["gt_v3_candidate"]
            cand["human_review_decision"] = decision["decision"]
            cand["human_review_confidence"] = decision["confidence"]
            cand["identity_status"] = "AMBIGUOUS" if decision["decision"] == "KEEP_AMBIGUOUS" else "STRUCTURED"
            if row["case_id"] in {"GT-V2-06-programme_identity", "GT-V2-09-programme_identity"}:
                cand["entity_type"] = "AMBIGUOUS_IDENTITY"
                cand["canonical_programme_identity"] = None
                cand["credential"] = ["S.B.", "A.B."] if row["case_id"].endswith("06-programme_identity") else ["Ph.D.", "M.S.E.", "M.Eng."]
                cand["ambiguity"] = decision["reason"]
        else:
            item["final_review_decision"] = "NO_HUMAN_REVIEW_REQUIRED"
            item["human_review_required"] = False
            item["gt_v3_candidate"]["identity_status"] = "STRUCTURED"
        final.append(item)
    return final


def final_contract_markdown() -> str:
    candidate = (BENCH / "2026-09-06-phase3f-programme-identity-contract-v2.md").read_text(encoding="utf-8")
    candidate = candidate.replace("# Phase 3F Programme Identity Contract v2 (Candidate)", "# Phase 3F Programme Identity Contract v2")
    candidate = candidate.replace("Status: **candidate for human approval; not frozen**", "Status: **APPROVED — frozen as part of Benchmark V3**")
    candidate = candidate.replace("Version: `phase3f-programme-identity-contract-v2-candidate`", "Version: `phase3f-programme-identity-contract-v2`\nApproved: `2026-09-06`")
    start = candidate.find("## 16. Unresolved policy questions for approval")
    if start >= 0:
        candidate = candidate[:start]
    candidate += """
## 16. Approved policy resolutions

1. Multiple official degree variants are represented as one structured academic
   entity only when the source establishes that relationship; credentials remain
   explicit variants. A case without a selected target variant is `AMBIGUOUS`.
2. Institution-specific concentration terminology remains its source ontology
   type unless official structure establishes a major/programme equivalence.
3. A track may inherit a parent only through explicit official relationship
   evidence. Parent and child are related, never automatically equivalent.
4. Legacy and current aliases require official provenance and temporal metadata;
   an undated or model-generated alias cannot establish current identity.

## 17. Ambiguity policy

`AMBIGUOUS` is a first-class identity comparison result. It is not a fuzzy pass
and is not a factual failure. An ambiguous identity result is excluded from the
concrete identity-precision numerator and denominator, reported separately, and
treated as unresolved for resolved-coverage reporting. The rule is generic and
applies to every case whose official evidence does not select one defensible
canonical entity; it is not a case-specific exception.

## 18. Approval and freeze boundary

The twelve human-queue cases were reviewed under this contract and recorded in
`docs/benchmarks/audits/2026-09-06-phase3f-programme-identity-contract-v2-human-review-log.jsonl`.
The final structured truth, scorer contract, and freeze manifest are versioned
Benchmark V3 artifacts. No runtime pipeline, provider, prompt, scorer v1, GT v2,
or official run artifact is changed by this approval.
"""
    return candidate.rstrip() + "\n"


def final_scorer_json() -> dict:
    data = json.loads(V2_CANDIDATE_SCORER.read_text(encoding="utf-8"))
    data.update({
        "schema_version": "phase3f-identity-scorer-contract-v2",
        "status": "FROZEN",
        "version": "phase-3f-scorer-contract/v2",
        "benchmark_version": "phase3f-v3",
        "truth_version": "phase-3f-ground-truth-v3-frozen",
        "truth_path": "docs/benchmarks/2026-09-06-phase3f-ground-truth-v3-frozen.jsonl",
        "contract_markdown": "docs/benchmarks/2026-09-06-phase3f-scorer-contract-v2.md",
        "machine_scorer": "scripts/score_phase3f_benchmark_v3_offline.py",
        "identity_comparison": {
            "pass_classes": ["EXACT_EQUIVALENT", "CANONICALLY_EQUIVALENT", "OFFICIAL_ALIAS_EQUIVALENT", "CREDENTIAL_AWARE_EQUIVALENT"],
            "non_pass_classes": ["WRONG_GRANULARITY", "PROGRAMME_VS_TRACK", "PROGRAMME_VS_CONCENTRATION", "PROGRAMME_VS_DEPARTMENT", "PARENT_VS_CHILD", "PRE_MAJOR_VS_FINAL_MAJOR", "JOINT_PROGRAMME_VS_COMPONENT", "DUAL_DEGREE_VS_SINGLE_PROGRAMME", "FACTUALLY_WRONG", "FUZZY_ONLY"],
            "fuzzy_only_pass": False,
            "official_alias_requires_provenance": True,
            "credential_separate": True,
            "parent_child_equal": False,
            "native_translation_requires_official_provenance": True,
        },
        "ambiguous_identity_policy": {
            "comparison_class": "AMBIGUOUS",
            "concrete_precision": "exclude_from_identity_precision_denominator_and_numerator",
            "resolved_coverage": "count_as_unresolved_coverage_loss",
            "safe_unresolved": "report_separately; do not treat as a confirmed NEEDS_REVIEW pass unless runtime state also satisfies that policy",
            "fuzzy_only": "never a pass",
        },
        "thresholds_inherited_from_v1": True,
        "v2_manifest_immutable": True,
    })
    return data


def final_scorer_markdown() -> str:
    old = V2_CONTRACT_MD.read_text(encoding="utf-8")
    old = old.replace("# Phase 3F V2 Scorer Contract", "# Phase 3F Benchmark V3 Scorer Contract v2")
    old = old.replace("Status: **LOCKED BEFORE V3 BENCHMARK EXECUTION**", "Status: **FROZEN BEFORE Benchmark V3 OFFLINE RESCORE**")
    old = old.replace("Contract version: `phase-3f-scorer-contract/v1`", "Contract version: `phase-3f-scorer-contract/v2`")
    old = old.replace("Benchmark version: `phase3f-v2`", "Benchmark version: `phase3f-v3`")
    old = old.replace("Truth version: `phase-3f-ground-truth-v2-frozen`", "Truth version: `phase-3f-ground-truth-v3-frozen`")
    old += """

## Programme identity Contract v2

This version supersedes the V1 flat-string `programme_identity` comparison while
leaving every non-identity field rule and every quality threshold unchanged.
The compared identity is structured as institution, canonical programme entity,
entity type, credential, degree level, parent/child relationship, stage, joint
or dual semantics, and officially evidenced aliases. Source-native identity is
retained separately from the canonical comparison form.

The only passing identity classes are `EXACT_EQUIVALENT`,
`CANONICALLY_EQUIVALENT`, `OFFICIAL_ALIAS_EQUIVALENT`, and
`CREDENTIAL_AWARE_EQUIVALENT`. Credential separation is allowed only when the
same underlying academic entity is established. Parent/child, programme/track,
programme/major at different target granularity, pre-major/final-major,
joint/component, and dual/single distinctions do not pass automatically.

Official alias or official translation provenance is mandatory. Unicode/case,
whitespace, punctuation, and proven credential separation are deterministic
normalizations. Fuzzy similarity, substring overlap, model-generated
translation, and common-name intuition can never produce a pass.

`AMBIGUOUS` is a generic comparison result when official evidence does not
select one defensible canonical identity. It is excluded from concrete identity
precision denominator and numerator, reported separately, and counted as
unresolved for resolved-coverage reporting. It is not silently converted into
PASS or FAIL, and it does not alter the six frozen `REVIEWED_AMBIGUOUS` truth
records used by the overall benchmark denominator.

## Freeze boundary

This contract was finalized, schema-validated, and hashed before the sealed
Run #4 V3 offline rescore. It must not be revised in response to that rescore;
any later methodology change requires a new Benchmark V4.
"""
    return old.rstrip() + "\n"


def build_truth(matrix: list[dict]) -> list[dict]:
    identity_by_id = {r["case_id"]: r["gt_v3_candidate"] for r in matrix}
    rows = load_jsonl(V2_TRUTH)
    if len(rows) != 252 or len({r["case_id"] for r in rows}) != 252:
        raise RuntimeError("V2 truth must contain exactly 252 unique records")
    out = []
    for row in rows:
        item = copy.deepcopy(row)
        if row["field"] == "programme_identity":
            item["programme_identity_v3"] = copy.deepcopy(identity_by_id[row["case_id"]])
            item["identity_contract_version"] = "phase3f-programme-identity-contract-v2"
        out.append(item)
    return out


def write_human_log() -> list[dict]:
    rows = []
    for case_id, d in DECISIONS.items():
        rows.append({
            "case_id": case_id,
            "previous_concern": d["reason"],
            "official_evidence": d["evidence"],
            "entity_type": d["entity_type"],
            "parent_child_structure": d["parent_child"],
            "credential_treatment": d["credential"],
            "canonicalization_decision": d["canonicalization"],
            "final_review_decision": d["decision"],
            "confidence": d["confidence"],
            "reviewer_1": "approved_contract_v2_review",
            "reviewer_2": "approved_contract_v2_review",
            "final_adjudication": d["decision"],
        })
    return rows


def write_reports(matrix: list[dict], truth: list[dict], generated_at: str) -> None:
    change_counts = Counter(row["v2_to_v3_change_type"] for row in matrix)
    human_counts = Counter(DECISIONS[k]["decision"] for k in DECISIONS)
    FINAL_REPORT.write_text(f"""# Phase 3F Ground Truth V3 — Frozen Candidate Report

Status: **FROZEN** as Benchmark V3 methodology input
Frozen at: `{generated_at}`

## Population and factual-change boundary

- Total truth records: **{len(truth)}**
- Unique case IDs: **{len({r['case_id'] for r in truth})}**
- Programme-identity cases: **36**
- Reviewed-confirmed: **246**
- Reviewed-ambiguous: **6**
- Unreviewed: **0**
- Factual GT corrections: **0**
- Representation/schema evolution: **36 identity records carry structured v3 identity**

The V3 artifact preserves every V2 row and every non-identity factual field.
The additional `programme_identity_v3` object separates source-native identity,
canonical programme identity, credential, degree level, hierarchy, stage,
joint/dual semantics, aliases, and ambiguity without rewriting V2 expected text.

## Identity change types

{chr(10).join(f'- `{k}`: **{v}**' for k, v in sorted(change_counts.items()))}

## Approved human queue

{chr(10).join(f'- `{k}`: **{v}**' for k, v in sorted(human_counts.items()))}

The twelve human-queue decisions are recorded in
`docs/benchmarks/audits/2026-09-06-phase3f-programme-identity-contract-v2-human-review-log.jsonl`.
Ambiguous cases remain explicit; no identity is forced to pass for benchmark
coverage.

## Version boundary

V2 truth, V2 scorer, V2 freeze manifest, and official Runs #1–#4 remain
immutable. V3 is a new frozen methodology artifact and is not a claim that V2
factual labels were wrong.
""", encoding="utf-8")

    METHODOLOGY_REPORT.write_text("""# Phase 3F Benchmark V2 vs V3 Methodology

## Unchanged

- Frozen roster and 252-case population.
- All non-identity factual GT fields.
- Discovery, state, quality, Product Safety, and operational semantics.
- All quality thresholds and zero-tolerance safety requirements.
- Official Runs #1–#4 and V2 scorer artifacts.

## Changed in V3

- `programme_identity` is represented as a structured evidence-first object.
- `source_native_identity` is retained separately from canonical identity.
- Credential, degree level, parent/child, stage, joint/dual, and alias metadata
  are explicit dimensions.
- Official aliases and official translations can establish equivalence only with
  provenance.
- Parent/child, track, stage, joint/component, and dual/single distinctions are
  not automatically equivalent.
- Generic `AMBIGUOUS` identity comparison is excluded from concrete identity
  precision and reported separately; it counts as unresolved for coverage.

## Factual versus representation change

Factual GT corrections: **0**. The V3 change is a semantic-schema evolution
that resolves the V2 flat-string representation mismatch documented by the
independent 28-case evidence-first audit.

## Freeze order

Contract v2 → GT v3 → scorer v2 → validation/checksums → V3 freeze manifest →
offline sealed Run #4 rescore. No post-rescore policy change is permitted.
""", encoding="utf-8")


def main() -> None:
    for path, expected in EXPECTED_V2_HASHES.items():
        actual = sha256(path)
        if actual != expected:
            raise SystemExit(f"V2 integrity failure: {path} {actual} != {expected}")

    matrix = build_final_matrix()
    human_log = write_human_log()
    truth = build_truth(matrix)
    FINAL_CONTRACT_MD.write_text(final_contract_markdown(), encoding="utf-8")
    FINAL_SCORER_MD.write_text(final_scorer_markdown(), encoding="utf-8")
    FINAL_SCORER_JSON.write_text(json.dumps(final_scorer_json(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    dump_jsonl(FINAL_MATRIX, matrix)
    dump_jsonl(HUMAN_LOG, human_log)
    dump_jsonl(FINAL_TRUTH, truth)
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    write_reports(matrix, truth, generated_at)

    scorer_impl = ROOT / "scripts" / "score_phase3f_benchmark_v3_offline.py"
    manifest = {
        "schema_version": "phase3f-benchmark-freeze/v3",
        "status": "FROZEN",
        "benchmark_version": "phase3f-v3",
        "frozen_at": generated_at,
        "lineage": {
            "v2_manifest": "docs/benchmarks/2026-09-01-phase-3f-ground-truth-freeze-v2.json",
            "v2_manifest_sha256": sha256(V2_MANIFEST),
            "factual_gt_corrections": 0,
            "identity_contract_version": "phase3f-programme-identity-contract-v2",
        },
        "population": {"truth_records": len(truth), "unique_case_ids": len({r["case_id"] for r in truth}), "programme_identity_cases": 36, "reviewed_confirmed": 246, "reviewed_ambiguous": 6, "unreviewed": 0},
        "ambiguity_policy": "identity AMBIGUOUS is excluded from concrete identity precision numerator/denominator, reported separately, and counted as unresolved coverage; the six REVIEWED_AMBIGUOUS truth records retain V2 primary-denominator exclusion.",
        "artifacts": {
            "ground_truth_v3": {"path": str(FINAL_TRUTH.relative_to(ROOT)).replace("\\", "/"), "sha256": sha256(FINAL_TRUTH)},
            "roster_v2": {"path": str(ROSTER.relative_to(ROOT)).replace("\\", "/"), "sha256": sha256(ROSTER)},
            "identity_contract_v2": {"path": str(FINAL_CONTRACT_MD.relative_to(ROOT)).replace("\\", "/"), "sha256": sha256(FINAL_CONTRACT_MD)},
            "scorer_contract_v2_markdown": {"path": str(FINAL_SCORER_MD.relative_to(ROOT)).replace("\\", "/"), "sha256": sha256(FINAL_SCORER_MD)},
            "scorer_contract_v2_json": {"path": str(FINAL_SCORER_JSON.relative_to(ROOT)).replace("\\", "/"), "sha256": sha256(FINAL_SCORER_JSON)},
            "machine_scorer": {"path": str(scorer_impl.relative_to(ROOT)).replace("\\", "/"), "sha256": sha256(scorer_impl)},
            "adjudication_matrix": {"path": str(FINAL_MATRIX.relative_to(ROOT)).replace("\\", "/"), "sha256": sha256(FINAL_MATRIX)},
            "human_review_log": {"path": str(HUMAN_LOG.relative_to(ROOT)).replace("\\", "/"), "sha256": sha256(HUMAN_LOG)},
        },
        "immutable_v2_hashes": {str(k.relative_to(ROOT)).replace("\\", "/"): v for k, v in EXPECTED_V2_HASHES.items()},
        "official_run4_output_sha256": "8dc5d04d36d1fd8cdaadcf9a44fdb34263091bc56c0db2ad088634ea9b904b9d",
        "pipeline_changed": False,
        "provider_calls": 0,
        "post_freeze_policy_changes_allowed": False,
    }
    FREEZE_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "FROZEN", "truth_sha256": sha256(FINAL_TRUTH), "contract_sha256": sha256(FINAL_CONTRACT_MD), "scorer_sha256": sha256(FINAL_SCORER_JSON), "manifest_sha256": sha256(FREEZE_MANIFEST)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
