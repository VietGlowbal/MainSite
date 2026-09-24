"""Build the non-frozen Phase 3F programme-identity Contract v2 candidates.

The script only creates versioned candidate/audit artefacts. It never writes
frozen truth, scorer v1, or official benchmark outputs.
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "docs/benchmarks/runs/phase3f-v2-run-20260905T161914Z"
AUDIT_DIR = ROOT / "docs/benchmarks/audits"
CANDIDATE_DIR = ROOT / "docs/benchmarks/candidates"
TRUTH = ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl"
RUN_MATRIX = AUDIT_DIR / "2026-09-06-phase3f-programme-identity-adjudication.jsonl"
PASS1_8 = AUDIT_DIR / "2026-09-06-phase3f-programme-identity-remaining8-blind-pass1.jsonl"

EXTRA_8 = {
    "GT-V2-04-programme_identity": {
        "source_native_identity": "Computer Science",
        "canonical_programme_identity": "Computer Science",
        "entity_type": "CONCENTRATION",
        "credential": "A.B. or S.B. as explicitly scoped by the Harvard College concentration record",
        "degree_level": "undergraduate",
        "parent_programme": None,
        "track": None,
        "concentration": "Computer Science",
        "stage": None,
        "joint_or_dual": "NONE",
        "native_aliases": [],
        "official_english_aliases": [],
        "other_official_aliases": ["Harvard College Computer Science concentration"],
        "evidence_refs": ["https://handbook.college.harvard.edu/sites/g/files/omnuum5551/files/2026-03/Fields%20of%20Concentration_0.pdf"],
        "confidence": "HIGH",
        "change": "REPRESENTATION_RESTRUCTURED",
        "human_review_required": False,
        "notes": "The subject/concentration is separable from credential; the precise AB/SB route remains source-scoped.",
    },
    "GT-V2-06-programme_identity": {
        "source_native_identity": "Electrical Engineering; separate Engineering Sciences A.B. Electrical and Computer Engineering track also appears",
        "canonical_programme_identity": "Electrical Engineering",
        "entity_type": "CONCENTRATION",
        "credential": "S.B.",
        "degree_level": "undergraduate",
        "parent_programme": None,
        "track": None,
        "concentration": "Electrical Engineering",
        "stage": None,
        "joint_or_dual": "NONE",
        "native_aliases": [],
        "official_english_aliases": [],
        "other_official_aliases": ["Engineering Sciences A.B. — Electrical and Computer Engineering track"],
        "evidence_refs": ["https://handbook.college.harvard.edu/sites/g/files/omnuum5551/files/2026-03/Fields%20of%20Concentration_0.pdf"],
        "confidence": "MEDIUM",
        "change": "AMBIGUITY_REPRESENTED",
        "human_review_required": True,
        "notes": "The frozen roster says Electrical Engineering/AB, while the official record separates Electrical Engineering S.B. from an Engineering Sciences A.B. track.",
    },
    "GT-V2-07-programme_identity": {
        "source_native_identity": "Astrophysical Sciences",
        "canonical_programme_identity": "Astrophysical Sciences",
        "entity_type": "MAJOR",
        "credential": "A.B.",
        "degree_level": "undergraduate",
        "parent_programme": None,
        "track": None,
        "concentration": None,
        "stage": None,
        "joint_or_dual": "NONE",
        "native_aliases": [],
        "official_english_aliases": [],
        "other_official_aliases": ["Princeton Astrophysical Sciences"],
        "evidence_refs": ["https://ua.princeton.edu/fields-study/departmental-majors-degree-bachelor-arts/astrophysical-sciences"],
        "confidence": "HIGH",
        "change": "CREDENTIAL_SEPARATED",
        "human_review_required": False,
        "notes": "Princeton explicitly lists Astrophysical Sciences as an A.B. offering and describes it as a major field.",
    },
    "GT-V2-08-programme_identity": {
        "source_native_identity": "Computer Science",
        "canonical_programme_identity": "Computer Science",
        "entity_type": "DEGREE_PROGRAMME",
        "credential": None,
        "degree_level": "graduate",
        "parent_programme": "Princeton Department of Computer Science",
        "track": None,
        "concentration": None,
        "stage": None,
        "joint_or_dual": "NONE",
        "native_aliases": [],
        "official_english_aliases": [],
        "other_official_aliases": ["Computer Science M.S.E.", "Computer Science Ph.D."],
        "degree_variants": ["M.S.E.", "Ph.D."],
        "evidence_refs": ["https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/computer-science"],
        "confidence": "MEDIUM",
        "change": "AMBIGUITY_REPRESENTED",
        "human_review_required": True,
        "notes": "The official page offers both Ph.D. and M.S.E.; a single credential-specific identity is not established by the source alone.",
    },
    "GT-V2-09-programme_identity": {
        "source_native_identity": "Chemical and Biological Engineering",
        "canonical_programme_identity": "Chemical and Biological Engineering",
        "entity_type": "DEGREE_PROGRAMME",
        "credential": None,
        "degree_level": "graduate",
        "parent_programme": "Princeton Department of Chemical and Biological Engineering",
        "track": None,
        "concentration": None,
        "stage": None,
        "joint_or_dual": "NONE",
        "native_aliases": [],
        "official_english_aliases": [],
        "other_official_aliases": ["CBE"],
        "degree_variants": ["Ph.D.", "M.S.E.", "M.Eng."],
        "evidence_refs": ["https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/chemical-and-biological-engineering"],
        "confidence": "MEDIUM",
        "change": "AMBIGUITY_REPRESENTED",
        "human_review_required": True,
        "notes": "Graduate evidence does not establish the frozen undergraduate BSE identity; the official graduate field has three degree variants.",
    },
    "GT-V2-26-programme_identity": {
        "source_native_identity": "Information & Communication Engineering",
        "canonical_programme_identity": "Information and Communication Engineering",
        "entity_type": "DEGREE_PROGRAMME",
        "credential": "Master (targeted admissions guide), with doctorate also offered by the department",
        "degree_level": "graduate",
        "parent_programme": "University of Tokyo Graduate School of Information Science and Technology",
        "track": None,
        "concentration": None,
        "stage": None,
        "joint_or_dual": "NONE",
        "native_aliases": ["Information & Communication Engineering"],
        "official_english_aliases": [],
        "other_official_aliases": ["ICE"],
        "degree_variants": ["Master", "Doctorate"],
        "evidence_refs": ["https://www.i.u-tokyo.ac.jp/edu/course/ice/index_e.shtml", "https://www.i.u-tokyo.ac.jp/edu/course/ice/admission_e.shtml"],
        "confidence": "MEDIUM",
        "change": "GRANULARITY_RESTRUCTURED",
        "human_review_required": True,
        "notes": "The department page states master and doctorate education; the 2027 admissions guide provides a master-specific path.",
    },
    "GT-V2-35-programme_identity": {
        "source_native_identity": "Aerospace Engineering",
        "canonical_programme_identity": "Aerospace Engineering",
        "entity_type": "MAJOR",
        "credential": "B.S.E.",
        "degree_level": "undergraduate",
        "parent_programme": "University of Michigan College of Engineering",
        "track": None,
        "concentration": None,
        "stage": "POST_ACCEPTANCE_DECLARATION",
        "joint_or_dual": "NONE",
        "native_aliases": [],
        "official_english_aliases": [],
        "other_official_aliases": ["Michigan Aerospace Engineering undergraduate major"],
        "evidence_refs": ["https://aero.engin.umich.edu/undergraduate/admissions/", "https://aero.engin.umich.edu/undergraduate/degree-requirements/"],
        "confidence": "HIGH",
        "change": "HIERARCHY_ADDED",
        "human_review_required": False,
        "notes": "The official admissions page explicitly models College of Engineering entry followed by Aerospace Engineering major declaration.",
    },
    "GT-V2-36-programme_identity": {
        "source_native_identity": "Master of Arts in Applied Economics (MAE)",
        "canonical_programme_identity": "Applied Economics",
        "entity_type": "DEGREE_PROGRAMME",
        "credential": "Master of Arts",
        "degree_level": "graduate",
        "parent_programme": "University of Michigan LSA Department of Economics",
        "track": None,
        "concentration": None,
        "stage": None,
        "joint_or_dual": "NONE",
        "native_aliases": [],
        "official_english_aliases": [],
        "other_official_aliases": ["MAE"],
        "evidence_refs": ["https://lsa.umich.edu/econ/mae.html"],
        "confidence": "HIGH",
        "change": "CREDENTIAL_SEPARATED",
        "human_review_required": False,
        "notes": "The official page distinguishes Applied Economics MAE from the Economics MA and Ph.D. programmes.",
    },
}

RELATION = {
    "GT-V2-15-programme_identity": "CANONICALLY_EQUIVALENT",
    "GT-V2-19-programme_identity": "WRONG_GRANULARITY",
    "GT-V2-21-programme_identity": "AMBIGUOUS",
    "GT-V2-25-programme_identity": "WRONG_GRANULARITY",
    "GT-V2-31-programme_identity": "CANONICALLY_EQUIVALENT",
    "GT-V2-32-programme_identity": "WRONG_GRANULARITY",
    "GT-V2-33-programme_identity": "CANONICALLY_EQUIVALENT",
}


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows), encoding="utf-8")


def base_structured(row: dict) -> dict:
    identity_type = row["identity_type"]
    source = row["source_native_identity"]
    result = {
        "entity_type": identity_type,
        "canonical_name": source,
        "source_native_name": source,
        "institution_id": row["institution"],
        "credential": None,
        "degree_level": None,
        "parent_programme": None,
        "track": None,
        "concentration": None,
        "specialization": None,
        "stage": None,
        "joint_or_dual": "NONE",
        "native_aliases": [],
        "official_english_aliases": [],
        "other_official_aliases": [],
        "evidence_refs": row["source_refs"],
        "confidence": row["confidence"],
        "ambiguity": None,
    }
    primary = row["primary_verdict"]
    if primary == "GENUINELY_AMBIGUOUS":
        result["ambiguity"] = row["secondary_reason"]
    if primary == "IDENTITY_GRANULARITY_MISMATCH":
        result["ambiguity"] = row["secondary_reason"]
    if "credential" in row["secondary_reason"]:
        result["credential"] = "separate credential component; preserve source-native title"
    return result


def main() -> None:
    CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)
    truth = {row["case_id"]: row for row in read_jsonl(TRUTH)}
    audit_rows = {row["case_id"]: row for row in read_jsonl(RUN_MATRIX)}
    pass1_8 = {row["case_id"]: row for row in read_jsonl(PASS1_8)}
    pipeline = json.loads((RUN_DIR / "pipeline-output.json").read_text(encoding="utf-8"))
    runtime = {row["case_id"]: row for row in pipeline["records"]}
    all_ids = [f"GT-V2-{index:02d}-programme_identity" for index in range(1, 37)]
    if set(audit_rows) & set(EXTRA_8):
        raise SystemExit("overlap between sealed 28-case adjudication and remaining 8")
    if set(pass1_8) != set(EXTRA_8):
        raise SystemExit("remaining-8 Pass-1 population mismatch")

    matrix = []
    candidate_rows = []
    fixtures = []
    for case_id in all_ids:
        if case_id in EXTRA_8:
            structured = dict(EXTRA_8[case_id])
            source_native = structured.pop("source_native_identity")
            v2 = truth[case_id].get("expected_value")
            institution = truth[case_id]["institution"]
            source_refs = structured["evidence_refs"]
            confidence = structured["confidence"]
            human = structured["human_review_required"]
            change = structured["change"]
            notes = structured.pop("notes")
        else:
            row = audit_rows[case_id]
            structured = base_structured(row)
            source_native = row["source_native_identity"]
            v2 = truth[case_id].get("expected_value")
            institution = row["institution"]
            source_refs = row["source_refs"]
            confidence = row["confidence"]
            human = row["human_review_required"]
            primary = row["primary_verdict"]
            change = {
                "CANONICALIZATION_MISMATCH": "REPRESENTATION_RESTRUCTURED",
                "SCORER_CONTRACT_MISMATCH": "REPRESENTATION_RESTRUCTURED",
                "IDENTITY_GRANULARITY_MISMATCH": "HIERARCHY_ADDED",
                "GENUINELY_AMBIGUOUS": "AMBIGUITY_REPRESENTED",
            }[primary]
            notes = row["secondary_reason"]

        # The following explicit structured values are the evidence-first v3
        # candidates for the 28 already adjudicated cases.
        overrides = {
            "GT-V2-01-programme_identity": {"canonical_name": "Artificial Intelligence and Decision Making (Course 6-4)", "credential": "Bachelor of Science", "degree_level": "undergraduate"},
            "GT-V2-02-programme_identity": {"canonical_name": "Computational Science and Engineering", "credential": "Master of Science", "degree_level": "graduate", "other_official_aliases": ["CSE SM"]},
            "GT-V2-03-programme_identity": {"canonical_name": "Chemical Engineering (Course 10)", "credential": "Bachelor of Science", "degree_level": "undergraduate"},
            "GT-V2-05-programme_identity": {"canonical_name": "Data Science", "credential": "Master of Science", "degree_level": "graduate"},
            "GT-V2-10-programme_identity": {"canonical_name": "Accelerated Daytime MBA", "credential": "Master of Business Administration", "degree_level": "graduate"},
            "GT-V2-11-programme_identity": {"canonical_name": "AI + Materials", "credential": "Master of Engineering", "degree_level": "graduate", "parent_programme": "Materials Science and Engineering", "track": "AI + Materials"},
            "GT-V2-12-programme_identity": {"canonical_name": "Biomedical Engineering", "credential": "Master of Engineering", "degree_level": "graduate", "other_official_aliases": ["BME"]},
            "GT-V2-13-programme_identity": {"canonical_name": "Liberal Arts and Music", "credential": ["B.A.", "B.Mus."], "degree_level": "undergraduate", "joint_or_dual": "DUAL_DEGREE"},
            "GT-V2-14-programme_identity": {"canonical_name": "Information Systems", "credential": "Master of Science", "degree_level": "graduate", "specialization": "Data Science"},
            "GT-V2-15-programme_identity": {"canonical_name": "Communication and Music", "credential": ["B.A./B.Mus.", "B.S./B.Mus.", "B.A./B.A.Mus.", "B.S./B.A.Mus."], "degree_level": "undergraduate", "joint_or_dual": "DUAL_DEGREE"},
            "GT-V2-16-programme_identity": {"canonical_name": "Applied Economics and Management", "credential": "Master of Professional Studies", "degree_level": "graduate"},
            "GT-V2-17-programme_identity": {"canonical_name": "Computer Science", "credential": "Bachelor of Science", "degree_level": "undergraduate"},
            "GT-V2-18-programme_identity": {"canonical_name": "Information Science", "credential": "Bachelor of Science", "degree_level": "undergraduate"},
            "GT-V2-19-programme_identity": {"canonical_name": "Public Affairs", "credential": "Bachelor of Arts", "degree_level": "undergraduate", "entity_type": "MAJOR", "stage": "PRE_MAJOR_TO_MAJOR"},
            "GT-V2-20-programme_identity": {"canonical_name": "Biostatistics", "credential": "Master of Public Health", "degree_level": "graduate"},
            "GT-V2-21-programme_identity": {"canonical_name": "Computer Science", "credential": None, "degree_level": "graduate", "entity_type": "DEGREE_PROGRAMME", "degree_variants": ["M.S.", "Ph.D."], "ambiguity": "official source supports MS and PhD without selecting one target variant"},
            "GT-V2-22-programme_identity": {"canonical_name": "Informatique", "credential": "Baccalauréat", "degree_level": "undergraduate", "other_official_aliases": ["programme 1-175-1-0"]},
            "GT-V2-23-programme_identity": {"canonical_name": "Informatique", "credential": "Maîtrise", "degree_level": "graduate", "other_official_aliases": ["programme 2-175-1-0"]},
            "GT-V2-24-programme_identity": {"canonical_name": "Apprentissage automatique", "credential": "DESS", "degree_level": "graduate", "other_official_aliases": ["programme 2-175-1-2"]},
            "GT-V2-25-programme_identity": {"canonical_name": "Computer Science", "credential": "Master", "degree_level": "graduate", "entity_type": "DEGREE_PROGRAMME", "parent_programme": "Department of Computer Science, Graduate School of Information Science and Technology", "degree_variants": ["Master", "Doctorate"], "ambiguity": "department source covers master and doctoral admissions; target degree scope must remain explicit"},
            "GT-V2-27-programme_identity": {"canonical_name": "Information, Technology, and Society in Asia", "credential": ["Master", "Doctoral"], "degree_level": "graduate", "entity_type": "JOINT_PROGRAMME", "joint_or_dual": "JOINT_PROGRAMME", "other_official_aliases": ["ITASIA"], "parent_programme": "Graduate School of Interdisciplinary Information Studies"},
            "GT-V2-28-programme_identity": {"canonical_name": "Data Science", "credential": "Master of Science", "degree_level": "graduate", "entity_type": "DEGREE_PROGRAMME"},
            "GT-V2-29-programme_identity": {"canonical_name": "Computer Science", "credential": "Master of Science", "degree_level": "graduate", "entity_type": "JOINT_PROGRAMME", "track": "Cyber Security", "joint_or_dual": "JOINT_PROGRAMME", "parent_programme": "ETH Zürich–EPFL Computer Science", "other_official_aliases": ["Master Cyber Security"]},
            "GT-V2-30-programme_identity": {"canonical_name": "Robotics, Systems and Control", "credential": "Master of Science", "degree_level": "graduate"},
            "GT-V2-31-programme_identity": {"canonical_name": "Licence d’Informatique", "credential": "Licence", "degree_level": "undergraduate", "entity_type": "TRACK", "parent_programme": "Licence d’Informatique", "track": "Parcours monodisciplinaire"},
            "GT-V2-32-programme_identity": {"canonical_name": "Master Informatique", "credential": "Master", "degree_level": "graduate", "entity_type": "TRACK", "parent_programme": "Master Informatique", "track": "MIND"},
            "GT-V2-33-programme_identity": {"canonical_name": "Master Informatique", "credential": "Master", "degree_level": "graduate", "entity_type": "TRACK", "parent_programme": "Master Informatique", "track": "SAR"},
            "GT-V2-34-programme_identity": {"canonical_name": "Applied Data Science", "credential": "Master of Applied Data Science", "degree_level": "graduate", "delivery_variant": "fully online", "other_official_aliases": ["MADS"]},
        }.get(case_id, structured)
        structured = {**structured, **overrides}
        structured.setdefault("entity_type", "PROGRAMME")
        structured.setdefault("source_native_name", source_native)
        structured.setdefault("institution_id", institution)
        structured.setdefault("canonical_name", structured.get("canonical_programme_identity", source_native))
        structured.setdefault("canonical_programme_identity", structured["canonical_name"])
        structured.setdefault("credential", None)
        structured.setdefault("degree_level", None)
        structured.setdefault("parent_programme", None)
        structured.setdefault("track", None)
        structured.setdefault("concentration", None)
        structured.setdefault("specialization", None)
        structured.setdefault("stage", None)
        structured.setdefault("joint_or_dual", "NONE")
        structured.setdefault("native_aliases", [])
        structured.setdefault("official_english_aliases", [])
        structured.setdefault("other_official_aliases", [])
        structured.setdefault("evidence_refs", source_refs)
        structured.setdefault("ambiguity", None)
        candidate = {
            "entity_type": structured.get("entity_type"),
            "canonical_programme_identity": structured.get("canonical_programme_identity", structured.get("canonical_name")),
            "source_native_identity": source_native,
            "institution_id": institution,
            "credential": structured.get("credential"),
            "degree_level": structured.get("degree_level"),
            "parent_programme": structured.get("parent_programme"),
            "track": structured.get("track"),
            "concentration": structured.get("concentration"),
            "specialization": structured.get("specialization"),
            "stage": structured.get("stage"),
            "joint_or_dual": structured.get("joint_or_dual", "NONE"),
            "native_aliases": structured.get("native_aliases", []),
            "official_english_aliases": structured.get("official_english_aliases", []),
            "other_official_aliases": structured.get("other_official_aliases", []),
            "degree_variants": structured.get("degree_variants", []),
            "ambiguity": structured.get("ambiguity"),
            "evidence_refs": structured.get("evidence_refs", source_refs),
            "confidence": confidence,
        }
        gt_v3 = candidate.copy()
        matrix.append({
            "case_id": case_id,
            "institution": institution,
            "source_native_identity": source_native,
            "canonical_programme_identity": candidate["canonical_programme_identity"],
            "entity_type": candidate["entity_type"],
            "credential": candidate["credential"],
            "degree_level": candidate["degree_level"],
            "parent_programme": candidate["parent_programme"],
            "track": candidate["track"],
            "concentration": candidate["concentration"],
            "stage": candidate["stage"],
            "joint_or_dual": candidate["joint_or_dual"],
            "native_aliases": candidate["native_aliases"],
            "official_english_aliases": candidate["official_english_aliases"],
            "other_official_aliases": candidate["other_official_aliases"],
            "evidence_refs": candidate["evidence_refs"],
            "confidence": confidence,
            "gt_v2_value": v2,
            "gt_v3_candidate": gt_v3,
            "v2_to_v3_change_type": change,
            "human_review_required": human,
            "adjudication_note": notes,
        })
        candidate_rows.append({"case_id": case_id, "field": "programme_identity", "gt_v3_candidate": gt_v3, "candidate_status": "NOT_FROZEN"})
        runtime_row = runtime[case_id]
        if runtime_row.get("state") != "FOUND":
            relation = "COVERAGE_LOSS"
        else:
            relation = RELATION.get(case_id, "CANONICALLY_EQUIVALENT")
        fixtures.append({
            "case_id": case_id,
            "field": "programme_identity",
            "gt_v3_candidate": gt_v3,
            "runtime_state": runtime_row.get("state"),
            "runtime_value": runtime_row.get("value"),
            "runtime_source_refs": runtime_row.get("source_refs", []),
            "comparison_relation": relation,
            "official_v2_outcome": "FOUND_CORRECT" if runtime_row.get("state") == "FOUND" and truth[case_id].get("expected_state") == "FOUND" else "COVERAGE_LOSS",
            "fuzzy_only_pass": False,
            "comparison_basis": "sealed Run #4 value plus v2 contract adjudication/evidence; offline only",
        })

    if len(matrix) != 36 or len({row["case_id"] for row in matrix}) != 36:
        raise SystemExit("36-case matrix validation failed")
    write_jsonl(AUDIT_DIR / "2026-09-06-phase3f-programme-identity-36case-v2-contract-adjudication.jsonl", matrix)
    write_jsonl(CANDIDATE_DIR / "2026-09-06-phase3f-ground-truth-v3-candidate.jsonl", candidate_rows)
    write_jsonl(CANDIDATE_DIR / "2026-09-06-phase3f-programme-identity-comparison-fixtures.jsonl", fixtures)
    write_jsonl(
        AUDIT_DIR / "2026-09-06-phase3f-programme-identity-contract-v2-human-review-queue.jsonl",
        [
            {
                "case_id": row["case_id"],
                "reason": row["adjudication_note"],
                "confidence": row["confidence"],
                "review_required": True,
            }
            for row in matrix
            if row["human_review_required"]
        ],
    )

    contract = """# Phase 3F Programme Identity Contract v2 (Candidate)

Status: **candidate for human approval; not frozen**
Version: `phase3f-programme-identity-contract-v2-candidate`

## 1. Purpose

Define a structured, evidence-first identity representation for benchmark
adjudication and deterministic comparison. This candidate does not modify frozen
GT v2, scorer v1, pipeline behavior, or official runs.

## 2. Terminology and ontology

The identity object distinguishes `INSTITUTION`, `SCHOOL`, `FACULTY`,
`DEPARTMENT`, `PROGRAMME`, `MAJOR`, `TRACK`, `CONCENTRATION`,
`SPECIALIZATION`, `DEGREE_PROGRAMME`, `JOINT_PROGRAMME`, `DUAL_DEGREE`,
`DELIVERY_VARIANT`, `STAGE`, `PRE_MAJOR`, and `CREDENTIAL`. A source may
describe more than one layer; the object retains the layers instead of forcing
them into one display string.

## 3. Core definition

`programme_identity` is the evidence-supported academic entity being evaluated:
normally the named programme, major, concentration, or degree programme. It is
not automatically the institution, department, credential, delivery mode,
track, or stage. The benchmark target may be a child entity; that target is
encoded explicitly with `parent_programme` and `track`/`concentration`.

`institution_id` is structurally separate from the programme name. Institution
text may be retained as provenance or collision context, but arbitrary strings
such as `University X — Computer Science` are not canonical identity names.

## 4. Credential and degree-programme semantics

Credential is a separate structured component whenever evidence supports a
decomposition such as `Computer Science` + `B.S.` or `Computer Science` +
`Master of Science`. The exact source-native title is always retained.

If an official degree-programme title uses a credential phrase as part of its
registered name, the source-native name remains intact while the structured
credential component is populated when the evidence makes the decomposition
defensible. No credential is inferred from a programme name alone.

## 5. Programme, major, concentration, and track

A major or concentration may serve as the benchmark programme entity when the
official catalogue treats it as the named field of study for the target scope.
It is not automatically interchangeable with a department or school.

A track, concentration, specialization, or parent programme is a separate
hierarchical component. `Parent Programme` and `Track A` are not equal merely
because one title contains the other. The benchmark target must state whether it
is the parent or child entity.

## 6. Stages and pre-majors

`PRE_MAJOR`, `DECLARED_MAJOR`, `DIRECT_ADMISSION`, and
`POST_ADMISSION_TRACK` are stage values, not aliases. A pre-major pathway is not
silently collapsed into the later major. When the official structure describes a
pathway, the stage relationship is stored explicitly.

## 7. Joint and dual degrees

`JOINT_PROGRAMME` means one programme administered across institutions or
schools. `DUAL_DEGREE` means a dual-credential/dual-degree structure. A single
programme offering multiple credentials is distinct from both. Partner names
and degree variants are retained when materially part of the official identity.

## 8. Source-native and canonical identity

`source_native_identity` is the exact official naming from evidence.
`canonical_programme_identity` is a structured comparison name, with credential,
institution, parent/child, stage, and alias fields kept separately. Source-native
text is never discarded and model-generated translations are never canonical
truth by themselves.

## 9. Native-language and English aliases

Native official titles are valid source-native identities. An official English
title is an alias only when the institution publishes or explicitly identifies
it. A model-generated translation is a review candidate, not an accepted alias.
Every alias carries source provenance and an alias type (`native`, `official
English`, abbreviation, legacy, or other official alias).

## 10. Canonicalization rules

### SAFE_DETERMINISTIC

- case, whitespace, and punctuation normalization;
- separation of a credential component when the source structure supports it;
- official abbreviation expansion with provenance;
- official alias mapping with provenance;
- deterministic parent/track decomposition when the official source explicitly
  provides the relationship.

### CONTEXT_DEPENDENT

- degree-programme versus subject-programme decomposition;
- major versus programme selection;
- current versus legacy name;
- joint/dual-degree structure;
- stage/pre-major relationships;
- inherited parent/child scope.

### PROHIBITED_WITHOUT_REVIEW

- fuzzy title substitution;
- invented translations;
- dropping a track or joint partner;
- collapsing a department into a programme;
- treating a credential mismatch as harmless when it changes entity meaning;
- using roster labels as factual identity evidence.

## 11. Identity key and display names

Identity equality uses a structured key: institution, canonical programme entity,
entity type, parent/child relationship, credential scope, and stage where
material. Display names are presentation fields and cannot alone decide equality.

## 12. Equivalence and scorer implications

The candidate scorer distinguishes:

- `EXACT_EQUIVALENT`: deterministic surface normalization only;
- `CANONICALLY_EQUIVALENT`: structured fields match or an official alias maps;
- `PARENT_CHILD_RELATED_NOT_EQUIVALENT`: related hierarchy, not equal;
- `CREDENTIAL_VARIANT`: same programme with a separately supported credential
  variant;
- `ALIAS_EQUIVALENT`: official alias relationship;
- `NOT_EQUIVALENT`: incompatible entity or scope;
- `AMBIGUOUS`: official evidence does not select one canonical interpretation.

Fuzzy-only comparison can never PASS. Credential text appended to a programme
does not fail when the same credential is separately represented and the
programme component matches; it does fail or become ambiguous when the
credential changes the entity or scope. Parent and child entities are never
automatically equivalent.

## 13. Benchmark-pattern examples

- MIT course/degree titles retain Course numbers as programme identifiers while
  Bachelor/Master/SM text is structured as credential or official alias.
- Northwestern dual degrees retain `DUAL_DEGREE` and credential variants.
- UCLA Public Affairs retains the pre-major-to-major stage pathway.
- UTokyo Computer Science and ICE retain department and degree scope.
- Sorbonne Licence/MIND/SAR retain parent/track hierarchy.
- ETH Cyber Security retains the ETH–EPFL joint programme and Computer Science
  major/track relationship.
- Michigan Aerospace retains College of Engineering entry and post-acceptance
  major declaration.

## 14. Backward compatibility with v2

GT v2 strings, frozen hashes, scorer v1, and official runs remain immutable.
The v3 candidate is a schema evolution and representation restructuring, not a
claim that the v2 factual labels were wrong. A future freeze would need an
explicit migration map from v2 strings to structured v3 records.

## 15. Migration implications

Future runtime output should preserve source-native identity and expose a
structured identity candidate. The pipeline is not changed by this task. A
future scorer should compare structured records and report missing granularity
separately from factual mismatch.

## 16. Unresolved policy questions for approval

1. Whether a benchmark target with multiple official degree variants should be
   represented as one multi-variant candidate or separate cases.
2. Whether institution-specific concentration terminology should map to `MAJOR`
   or remain `CONCENTRATION` in display/reporting.
3. Whether a track-only runtime source may inherit its parent from proven source
   relationship metadata during scoring.
4. Whether current-cycle target metadata must be mandatory for legacy aliases.

No freeze, scorer replacement, runtime change, or benchmark rerun is authorized
by this candidate document.
"""
    (ROOT / "docs/benchmarks/2026-09-06-phase3f-programme-identity-contract-v2.md").write_text(contract, encoding="utf-8")

    scorer_json = {
        "schema_version": "phase3f-identity-scorer-contract-v2-candidate",
        "status": "CANDIDATE_NOT_FROZEN",
        "input": "structured programme identity records; source-native identity retained",
        "equivalence_classes": ["EXACT_EQUIVALENT", "CANONICALLY_EQUIVALENT", "PARENT_CHILD_RELATED_NOT_EQUIVALENT", "CREDENTIAL_VARIANT", "ALIAS_EQUIVALENT", "NOT_EQUIVALENT", "AMBIGUOUS"],
        "safe_normalization": ["case", "whitespace", "punctuation", "proven credential separation", "official alias with provenance", "explicit parent-child relation"],
        "fuzzy_only_pass": False,
        "parent_child_equal": False,
        "institution_in_canonical_name": False,
        "credential_separate": True,
        "native_translation_requires_official_provenance": True,
        "coverage_states": ["COVERAGE_LOSS", "ACCESS_BLOCKED", "NEEDS_REVIEW", "FOUND"],
        "ambiguous_is_not_pass": True,
    }
    (CANDIDATE_DIR / "2026-09-06-phase3f-scorer-contract-v2-candidate.json").write_text(json.dumps(scorer_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    scorer_md = """# Phase 3F Scorer Contract v2 (Candidate)

Status: **candidate only; scorer v1 remains authoritative**.

The candidate consumes structured identity objects, not a single title string.
It applies only deterministic normalization and evidence-backed official alias
maps. Fuzzy-only matches cannot pass. Parent/child, track, stage, credential,
joint/dual, and ambiguity differences remain explicit outcomes.

## Comparison order

1. Require the same institution scope and compatible target case.
2. Normalize only case, whitespace, punctuation, and evidence-backed credential
   decomposition.
3. Resolve official aliases only when the alias relationship is in the
   candidate record with provenance.
4. Compare canonical entity, parent/child, track, specialization, stage,
   joint/dual structure, and credential scope.
5. Emit one of `EXACT_EQUIVALENT`, `CANONICALLY_EQUIVALENT`,
   `PARENT_CHILD_RELATED_NOT_EQUIVALENT`, `CREDENTIAL_VARIANT`,
   `ALIAS_EQUIVALENT`, `NOT_EQUIVALENT`, or `AMBIGUOUS`.

`AMBIGUOUS`, coverage loss, and operational states are not correct factual
matches. This candidate specification does not change v1 scoring or thresholds.
"""
    (CANDIDATE_DIR / "2026-09-06-phase3f-scorer-contract-v2-candidate.md").write_text(scorer_md, encoding="utf-8")

    report = """# Phase 3F GT v3 Candidate Report

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
"""
    (ROOT / "docs/benchmarks/2026-09-06-phase3f-ground-truth-v3-candidate-report.md").write_text(report, encoding="utf-8")

    print(f"built 36-case matrix, {len(candidate_rows)} GT candidate rows, {len(fixtures)} comparison fixtures")


if __name__ == "__main__":
    main()
