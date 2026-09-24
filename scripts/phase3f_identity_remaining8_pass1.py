"""Seal an evidence-first Pass-1 artifact for the eight non-Run-4-FOUND cases."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = ROOT / "docs/benchmarks/runs/phase3f-v2-run-20260905T161914Z"
AUDIT_DIR = ROOT / "docs/benchmarks/audits"
CASE_IDS = [
    "GT-V2-04-programme_identity",
    "GT-V2-06-programme_identity",
    "GT-V2-07-programme_identity",
    "GT-V2-08-programme_identity",
    "GT-V2-09-programme_identity",
    "GT-V2-26-programme_identity",
    "GT-V2-35-programme_identity",
    "GT-V2-36-programme_identity",
]

EVIDENCE = {
    "GT-V2-04-programme_identity": {
        "institution": "Harvard",
        "routing_context": "Computer Science",
        "source_native_identity": "Computer Science",
        "identity_type": "CONCENTRATION",
        "evidence_ref": "https://handbook.college.harvard.edu/sites/g/files/omnuum5551/files/2026-03/Fields%20of%20Concentration_0.pdf",
        "locator": "Harvard College Fields of Concentration: Computer Science concentration entry",
        "confidence": "HIGH",
    },
    "GT-V2-06-programme_identity": {
        "institution": "Harvard",
        "routing_context": "Electrical Engineering",
        "source_native_identity": "Electrical Engineering; separate Engineering Sciences A.B. Electrical and Computer Engineering track also appears",
        "identity_type": "CONCENTRATION",
        "evidence_ref": "https://handbook.college.harvard.edu/sites/g/files/omnuum5551/files/2026-03/Fields%20of%20Concentration_0.pdf",
        "locator": "Harvard Fields of Concentration: Electrical Engineering S.B. entry and separate Engineering Sciences A.B. / Electrical and Computer Engineering track",
        "confidence": "MEDIUM",
    },
    "GT-V2-07-programme_identity": {
        "institution": "Princeton",
        "routing_context": "Astrophysical Sciences",
        "source_native_identity": "Astrophysical Sciences",
        "identity_type": "MAJOR",
        "evidence_ref": "https://ua.princeton.edu/fields-study/departmental-majors-degree-bachelor-arts/astrophysical-sciences",
        "locator": "Princeton Undergraduate Announcement 2026-2027: Astrophysical Sciences heading and A.B. program offering",
        "confidence": "HIGH",
    },
    "GT-V2-08-programme_identity": {
        "institution": "Princeton",
        "routing_context": "Computer Science",
        "source_native_identity": "Computer Science",
        "identity_type": "DEGREE_PROGRAMME",
        "evidence_ref": "https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/computer-science",
        "locator": "Princeton Graduate School 2026-2027: Computer Science offers Ph.D. and M.S.E.; overview describes both graduate degree programmes",
        "confidence": "MEDIUM",
    },
    "GT-V2-09-programme_identity": {
        "institution": "Princeton",
        "routing_context": "Chemical and Biological Engineering",
        "source_native_identity": "Chemical and Biological Engineering",
        "identity_type": "DEGREE_PROGRAMME",
        "evidence_ref": "https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/chemical-and-biological-engineering",
        "locator": "Princeton Graduate School 2026-2027: Chemical and Biological Engineering offers Ph.D., M.S.E., and M.Eng.",
        "confidence": "MEDIUM",
    },
    "GT-V2-26-programme_identity": {
        "institution": "University of Tokyo",
        "routing_context": "Information and Communication Engineering",
        "source_native_identity": "Information & Communication Engineering",
        "identity_type": "DEGREE_PROGRAMME",
        "evidence_ref": "https://www.i.u-tokyo.ac.jp/edu/course/ice/index_e.shtml",
        "locator": "UTokyo IST ICE department page: graduate-course master and doctorate education; admissions page has School Year 2027 guide",
        "confidence": "MEDIUM",
    },
    "GT-V2-35-programme_identity": {
        "institution": "University of Michigan",
        "routing_context": "Aerospace Engineering",
        "source_native_identity": "Aerospace Engineering",
        "identity_type": "MAJOR",
        "evidence_ref": "https://aero.engin.umich.edu/undergraduate/admissions/",
        "locator": "Michigan Aerospace Engineering admissions: students apply to U-M and the College of Engineering, then declare Aerospace Engineering",
        "confidence": "HIGH",
    },
    "GT-V2-36-programme_identity": {
        "institution": "University of Michigan",
        "routing_context": "Applied Economics",
        "source_native_identity": "Master of Arts in Applied Economics (MAE)",
        "identity_type": "DEGREE_PROGRAMME",
        "evidence_ref": "https://lsa.umich.edu/econ/mae.html",
        "locator": "Michigan LSA Economics MAE page: Master of Arts degree in Applied Economics; distinct from Economics MA and Ph.D.",
        "confidence": "HIGH",
    },
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    rows = []
    for case_id in CASE_IDS:
        evidence = EVIDENCE[case_id]
        row = {
            "case_id": case_id,
            "institution": evidence["institution"],
            "programme_routing_context": evidence["routing_context"],
            "source_native_identity": evidence["source_native_identity"],
            "independent_adjudicated_identity": evidence["source_native_identity"],
            "identity_type": evidence["identity_type"],
            "canonicalization_basis": "NO_NORMALIZATION",
            "evidence_ref": evidence["evidence_ref"],
            "evidence_locator": evidence["locator"],
            "source_authority": "OFFICIAL",
            "temporal_applicability": "CURRENT_OFFICIAL_SOURCE_OR_2026_2027_CONTEXT",
            "confidence": evidence["confidence"],
            "fresh_evidence_used": True,
        }
        # Explicitly omit GT, runtime value, and scorer outcome from Pass 1.
        rows.append(row)
    if len(rows) != 8 or len({row["case_id"] for row in rows}) != 8:
        raise SystemExit("remaining-8 population validation failed")
    path = AUDIT_DIR / "2026-09-06-phase3f-programme-identity-remaining8-blind-pass1.jsonl"
    path.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows), encoding="utf-8")
    manifest = {
        "audit": "phase3f-programme-identity-contract-v2",
        "pass": 1,
        "protocol": "blind evidence-first",
        "population": 8,
        "artifact": str(path.relative_to(ROOT)),
        "artifact_sha256": sha256(path),
        "sealed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "runtime_values_included": False,
        "ground_truth_values_included": False,
        "scorer_verdicts_included": False,
        "evidence_basis": "fresh official evidence and sealed Run #4 source metadata only",
    }
    (AUDIT_DIR / "2026-09-06-phase3f-programme-identity-remaining8-blind-pass1-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
