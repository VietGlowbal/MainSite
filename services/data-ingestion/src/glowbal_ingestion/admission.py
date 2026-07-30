from __future__ import annotations

import re
from typing import Any, Iterable

from .models import (
    ADMISSION_DOCUMENT_TYPES,
    ADMISSION_PACKAGE_FIELDS,
    FieldAssertion,
    ProgrammeRecord,
    RECOMMENDATION_COMPONENT_TYPES,
    VerificationStatus,
    has_semantic_value,
    utc_now_iso,
)


FIELD_TO_DOCUMENT_TYPE: dict[str, str] = {
    "recommendation_letters": "recommendation_letter",
    "sop_essay_requirements": "statement_of_purpose",
    "graduation_certificate": "graduation_certificate",
    "academic_transcript": "academic_transcript",
}

NUMBER_WORDS: dict[str, int] = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
}

OPTIONAL_RE = re.compile(
    r"\b(?:optional|not required|need not|no (?:letter|reference|statement|"
    r"certificate|transcript)s? required)\b",
    re.IGNORECASE,
)
CONDITIONAL_RE = re.compile(
    r"\b(?:if applicable|where applicable|if requested|when requested|"
    r"may be required|conditional(?:ly)?|after (?:an? )?offer|upon "
    r"(?:admission|enrolment|enrollment)|before enrolment|before enrollment)\b",
    re.IGNORECASE,
)
REQUIRED_RE = re.compile(
    r"\b(?:required|must|need(?:ed)?|submit|provide|upload|include|"
    r"supporting documents?|application documents?|references?|"
    r"recommendation letters?|statement of purpose|personal statement|"
    r"motivation letter|degree certificate|graduation certificate|"
    r"academic transcript|official transcript)\b",
    re.IGNORECASE,
)
INITIAL_STAGE_RE = re.compile(
    r"\b(?:with (?:the |your )?application|at (?:the )?time of application|"
    r"during (?:the )?application|application checklist|application "
    r"documents?|supporting documents?|to apply|when applying|upload)\b",
    re.IGNORECASE,
)
AFTER_OFFER_RE = re.compile(
    r"\b(?:after (?:an? )?offer|after admission|upon admission|"
    r"conditional offer|once admitted)\b",
    re.IGNORECASE,
)
ENROLLMENT_RE = re.compile(
    r"\b(?:before|at|upon|during)\s+(?:enrolment|enrollment|registration)\b",
    re.IGNORECASE,
)
def _value_text(value: Any) -> str:
    if isinstance(value, dict):
        return " ".join(
            str(item)
            for key, item in value.items()
            if key
            in {
                "requirement_status",
                "status",
                "details",
                "requirement",
                "application_stage",
                "stage",
                "accepted_alternatives",
                "document_type",
                "component_type",
                "components",
                "required_count",
                "count",
            }
            and item is not None
        )
    if isinstance(value, (list, tuple)):
        return " ".join(_value_text(item) for item in value)
    return str(value or "")


def _status_from_value(value: Any, evidence: str | None) -> str:
    if isinstance(value, dict):
        explicit = str(
            value.get("requirement_status") or value.get("status") or ""
        ).casefold()
        if explicit in {"required", "optional", "conditional", "not_required"}:
            return explicit
    text = f"{_value_text(value)} {evidence or ''}"
    if OPTIONAL_RE.search(text):
        return "optional"
    if CONDITIONAL_RE.search(text):
        return "conditional"
    if REQUIRED_RE.search(text):
        return "required"
    return "unknown"


def _document_type_from_value(
    field_name: str,
    value: Any,
    evidence: str | None,
) -> str:
    if isinstance(value, dict):
        explicit = str(value.get("document_type") or "").casefold()
        if explicit in ADMISSION_DOCUMENT_TYPES:
            return explicit
    if field_name != "sop_essay_requirements":
        return FIELD_TO_DOCUMENT_TYPE[field_name]
    text = f"{_value_text(value)} {evidence or ''}".casefold()
    if re.search(r"\bstatements?\s+of\s+(?:purpose|objectives?)\b", text):
        return "statement_of_purpose"
    if "personal statement" in text:
        return "personal_statement"
    if "motivation letter" in text:
        return "motivation_letter"
    if re.search(
        r"\b(?:several|multiple|set\s+of)\b.{0,30}"
        r"\b(?:essays?|responses?|questions?)\b|"
        r"\bshort\s+(?:answer\s+)?responses?\b|"
        r"\bquestions?\s+and\s+essays?\b",
        text,
    ):
        return "application_essay_set"
    if "short response" in text:
        return "short_response"
    if "essay" in text:
        return "application_essay"
    return FIELD_TO_DOCUMENT_TYPE[field_name]


def _components_from_value(
    value: Any,
    *,
    parent_status: str,
    parent_stage: str,
) -> list[dict[str, Any]]:
    if not isinstance(value, dict) or not isinstance(
        value.get("components"), list
    ):
        return []
    allowed_types = RECOMMENDATION_COMPONENT_TYPES | ADMISSION_DOCUMENT_TYPES
    components: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in value["components"]:
        if not isinstance(raw, dict):
            continue
        component_type = str(raw.get("component_type") or "other").casefold()
        if component_type not in allowed_types:
            component_type = "other"
        status = _status_from_value(raw, str(raw.get("details") or ""))
        if status == "unknown":
            status = parent_status
        stage = _stage_from_value(raw, str(raw.get("details") or ""))
        if stage == "unknown":
            stage = parent_stage
        count = _count_from_value(
            "recommendation_letters",
            raw,
            str(raw.get("details") or ""),
        )
        component = {
            "component_type": component_type,
            "requirement_status": status,
            "required_count": count,
            "application_stage": stage,
            "details": str(raw.get("details") or "").strip() or None,
        }
        fingerprint = repr(sorted(component.items()))
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        components.append(component)
    return components


def _count_from_value(field_name: str, value: Any, evidence: str | None) -> int | None:
    if isinstance(value, dict):
        has_explicit_count = (
            "required_count" in value or "count" in value
        )
        explicit = value.get("required_count", value.get("count"))
        if isinstance(explicit, int) and not isinstance(explicit, bool):
            return explicit if explicit >= 0 else None
        if isinstance(explicit, str) and explicit.isdigit():
            return int(explicit)
        if has_explicit_count and field_name != "recommendation_letters":
            return None
    text = f"{_value_text(value)} {evidence or ''}"
    if field_name == "recommendation_letters":
        match = re.search(
            r"\b(1|2|3|4|5|one|two|three|four|five)\b"
            r"(?=.{0,35}\b(?:letters?|references?|referees?|recommendations?)\b)",
            text,
            re.IGNORECASE,
        )
        if match:
            token = match.group(1).casefold()
            return int(token) if token.isdigit() else NUMBER_WORDS[token]
        return None
    return None


def _stage_from_value(value: Any, evidence: str | None) -> str:
    if isinstance(value, dict):
        explicit = str(
            value.get("application_stage") or value.get("stage") or ""
        ).casefold()
        aliases = {
            "application": "initial_application",
            "initial": "initial_application",
            "initial_application": "initial_application",
            "after_offer": "after_offer",
            "post_offer": "after_offer",
            "enrolment": "enrollment",
            "enrollment": "enrollment",
        }
        if explicit in aliases:
            return aliases[explicit]
    text = f"{_value_text(value)} {evidence or ''}"
    if AFTER_OFFER_RE.search(text):
        return "after_offer"
    if ENROLLMENT_RE.search(text):
        return "enrollment"
    if INITIAL_STAGE_RE.search(text):
        return "initial_application"
    return "unknown"


def _alternatives_from_value(value: Any) -> list[str]:
    """Only preserve alternatives explicitly emitted in the structured fact.

    Merely mentioning another document in the same admission paragraph does
    not make it an accepted alternative. For example, a counselor package can
    mention a transcript alongside recommendation letters.
    """
    if not isinstance(value, dict):
        return []
    raw_alternatives = value.get("accepted_alternatives")
    if not isinstance(raw_alternatives, list):
        return []
    alternatives: list[str] = []
    for raw in raw_alternatives:
        alternative = str(raw or "").strip().casefold().replace(" ", "_")
        if alternative and alternative not in alternatives:
            alternatives.append(alternative)
    return alternatives


def _accepted_assertions(
    field_name: str,
    assertions: Iterable[FieldAssertion],
) -> list[FieldAssertion]:
    return [
        assertion
        for assertion in assertions
        if assertion.field_name == field_name
        and has_semantic_value(assertion.value_json)
        and assertion.verification_status != VerificationStatus.REJECTED
    ]


def normalize_document_requirement(
    field_name: str,
    assertions: Iterable[FieldAssertion],
) -> dict[str, Any]:
    candidates = _accepted_assertions(field_name, assertions)
    observations = [
        {
            "status": _status_from_value(
                assertion.value_json, assertion.evidence
            ),
            "count": _count_from_value(
                field_name, assertion.value_json, assertion.evidence
            ),
            "stage": _stage_from_value(
                assertion.value_json, assertion.evidence
            ),
            "document_type": _document_type_from_value(
                field_name,
                assertion.value_json,
                assertion.evidence,
            ),
            "alternatives": _alternatives_from_value(
                assertion.value_json
            ),
            "assertion": assertion,
        }
        for assertion in candidates
    ]
    statuses = {
        item["status"] for item in observations if item["status"] != "unknown"
    }
    counts = {
        item["count"] for item in observations if item["count"] is not None
    }
    stages = {
        item["stage"] for item in observations if item["stage"] != "unknown"
    }
    document_types = {
        item["document_type"]
        for item in observations
        if item["document_type"]
    }
    conflict_reasons: list[str] = []
    if len(statuses) > 1:
        conflict_reasons.append("CONFLICTING_REQUIREMENT_STATUS")
    if len(counts) > 1:
        conflict_reasons.append("CONFLICTING_REQUIRED_COUNT")
    if len(stages) > 1:
        conflict_reasons.append("CONFLICTING_APPLICATION_STAGE")
    if len(document_types) > 1:
        conflict_reasons.append("CONFLICTING_DOCUMENT_TYPE")

    requirement_status = (
        next(iter(statuses))
        if len(statuses) == 1 and not conflict_reasons
        else "unknown"
    )
    required_count = next(iter(counts)) if len(counts) == 1 else None
    if requirement_status in {"optional", "not_required"}:
        required_count = 0
    application_stage = (
        next(iter(stages))
        if len(stages) == 1 and "CONFLICTING_APPLICATION_STAGE" not in conflict_reasons
        else "unknown"
    )
    document_type = (
        next(iter(document_types))
        if len(document_types) == 1
        else FIELD_TO_DOCUMENT_TYPE[field_name]
    )
    components: list[dict[str, Any]] = []
    component_fingerprints: set[str] = set()
    for item in observations:
        for component in _components_from_value(
            item["assertion"].value_json,
            parent_status=item["status"],
            parent_stage=item["stage"],
        ):
            fingerprint = repr(sorted(component.items()))
            if fingerprint in component_fingerprints:
                continue
            component_fingerprints.add(fingerprint)
            components.append(component)
    count_scope = "document_total"
    if components and field_name == "recommendation_letters":
        count_scope = "primary_component"
    elif components:
        count_scope = "component_breakdown"
    alternatives = sorted(
        {
            alternative
            for item in observations
            for alternative in item["alternatives"]
        }
    )
    evidence = [
        {
            "source_url": item["assertion"].source_url,
            "source_type": item["assertion"].source_type,
            "evidence": item["assertion"].evidence,
            "academic_cycle": item["assertion"].academic_cycle,
            "confidence": item["assertion"].confidence,
            "verification_status": item[
                "assertion"
            ].verification_status.value,
        }
        for item in observations
    ]
    return {
        "document_type": document_type,
        "source_field": field_name,
        "requirement_status": requirement_status,
        "required_count": required_count,
        "count_scope": count_scope,
        "application_stage": application_stage,
        "accepted_alternatives": alternatives,
        "components": components,
        "conflict": bool(conflict_reasons),
        "conflict_reasons": conflict_reasons,
        "evidence": evidence,
    }


def evaluate_package(
    requirements: Iterable[dict[str, Any]],
    inventory: dict[str, int] | None = None,
) -> dict[str, Any]:
    requirements_list = list(requirements)
    unknown_requirements = sorted(
        {
            str(requirement["document_type"])
            for requirement in requirements_list
            if requirement.get("conflict")
            or requirement.get("requirement_status") == "unknown"
        }
    )
    if inventory is None:
        return {
            "decision": "APPLICANT_DATA_REQUIRED",
            "ready_for_initial_application": None,
            "missing_documents": [],
            "unknown_documents": unknown_requirements,
            "unknown_requirements": unknown_requirements,
            "unknown_applicant_documents": [],
            "later_stage_documents": sorted(
                {
                    str(requirement["document_type"])
                    for requirement in requirements_list
                    if requirement.get("requirement_status") == "conditional"
                    or requirement.get("application_stage")
                    in {"after_offer", "enrollment"}
                }
            ),
            "applicant_inventory": None,
        }

    known_document_types = set(ADMISSION_DOCUMENT_TYPES)
    available = {
        key: max(0, int(value))
        for key, value in inventory.items()
        if key in known_document_types
    }

    missing: list[dict[str, Any]] = []
    unknown_applicant_documents: list[str] = []
    later_stage: list[str] = []
    for requirement in requirements_list:
        document_type = str(requirement["document_type"])
        status = str(requirement["requirement_status"])
        stage = str(requirement["application_stage"])
        count = requirement.get("required_count")
        if requirement.get("conflict") or status == "unknown":
            continue
        if status == "conditional":
            later_stage.append(document_type)
            continue
        if status != "required":
            continue
        if stage != "initial_application":
            if stage in {"after_offer", "enrollment"}:
                later_stage.append(document_type)
            else:
                unknown_requirements.append(document_type)
            continue
        if count is None:
            unknown_requirements.append(document_type)
            continue
        if document_type not in available:
            unknown_applicant_documents.append(document_type)
            continue
        available_count = available[document_type]
        if available_count < int(count):
            missing.append(
                {
                    "document_type": document_type,
                    "required_count": int(count),
                    "available_count": available_count,
                    "missing_count": int(count) - available_count,
                }
            )

    if missing:
        decision = "MISSING_DOCUMENTS"
    elif unknown_requirements or unknown_applicant_documents:
        decision = "REVIEW_REQUIRED"
    elif later_stage:
        decision = "CONDITIONALLY_READY"
    else:
        decision = "READY"
    return {
        "decision": decision,
        "ready_for_initial_application": (
            not missing
            and not unknown_requirements
            and not unknown_applicant_documents
        ),
        "missing_documents": missing,
        "unknown_documents": sorted(
            set(unknown_requirements) | set(unknown_applicant_documents)
        ),
        "unknown_requirements": sorted(set(unknown_requirements)),
        "unknown_applicant_documents": sorted(
            set(unknown_applicant_documents)
        ),
        "later_stage_documents": sorted(set(later_stage)),
        "applicant_inventory": available,
    }


def build_admission_package(
    programme: ProgrammeRecord,
    assertions: Iterable[FieldAssertion],
    inventory: dict[str, int] | None = None,
) -> dict[str, Any]:
    assertions_list = list(assertions)
    requirements = [
        normalize_document_requirement(field_name, assertions_list)
        for field_name in ADMISSION_PACKAGE_FIELDS
    ]
    return {
        "programme_id": programme.programme_id,
        "institution_id": programme.institution_id,
        "programme_name": programme.programme_name,
        "official_url": programme.official_url,
        "retrieved_at": utc_now_iso(),
        "requirements": requirements,
        "precheck": evaluate_package(requirements, inventory),
    }
