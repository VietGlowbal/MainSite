from __future__ import annotations

import dataclasses
import enum
import json
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


IDENTITY_NAMESPACE = uuid.UUID("8bd4a66f-8f40-4a26-b0fd-0642d998fae7")
PLACEHOLDER_VALUE_RE = re.compile(
    r"^(?:"
    r"[-\u2013\u2014]+|"
    r"n/?a|n\.a\.|none|null|unknown|"
    r"tbd|tba|"
    r"not\s+(?:available|applicable|provided|published|specified)|"
    r"to\s+be\s+(?:announced|confirmed|determined|published|updated)|"
    r"coming\s+soon|"
    r"see\s+(?:the\s+)?(?:website|page|link)"
    r")[.!]?$",
    re.IGNORECASE,
)


class NullReason(str, enum.Enum):
    NOT_PUBLISHED = "NOT_PUBLISHED"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    OUTDATED_ONLY = "OUTDATED_ONLY"
    BLOCKED_BY_POLICY = "BLOCKED_BY_POLICY"
    FETCH_FAILED = "FETCH_FAILED"
    PARSE_FAILED = "PARSE_FAILED"
    AMBIGUOUS = "AMBIGUOUS"
    CONFLICTED = "CONFLICTED"


class VerificationStatus(str, enum.Enum):
    DISCOVERED = "DISCOVERED"
    FETCHED = "FETCHED"
    AI_EXTRACTED = "AI_EXTRACTED"
    RULE_VALIDATED = "RULE_VALIDATED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    HUMAN_VERIFIED = "HUMAN_VERIFIED"
    REJECTED = "REJECTED"


class PolicyStatus(str, enum.Enum):
    ALLOWED = "ALLOWED"
    ALLOWED_TERMS_UNREVIEWED = "ALLOWED_TERMS_UNREVIEWED"
    BLOCKED_BY_ROBOTS = "BLOCKED_BY_ROBOTS"
    PROHIBITED = "PROHIBITED"
    UNREACHABLE = "UNREACHABLE"


class PageType(str, enum.Enum):
    PROGRAMME_OVERVIEW = "programme_overview"
    PROGRAMME_ADMISSION = "programme_admission"
    DEADLINE = "deadline"
    CATALOGUE = "catalogue"
    INTERNATIONAL_ADMISSION = "international_admission"
    ENGLISH_REQUIREMENT = "english_requirement"
    TUITION = "tuition"
    SCHOLARSHIP = "scholarship"
    CAREER_OUTCOME = "career_outcome"
    FACULTY = "faculty"
    DEPARTMENT = "department"
    PDF = "pdf"
    UNKNOWN = "unknown"


class OrganisationUnitType(str, enum.Enum):
    SCHOOL = "school"
    COLLEGE = "college"
    FACULTY = "faculty"
    DIVISION = "division"
    INSTITUTE = "institute"
    DEPARTMENT = "department"
    OTHER = "other"


def has_semantic_value(value: Any) -> bool:
    """Return whether a value contains usable information, not only schema."""
    if value is None:
        return False
    if isinstance(value, str):
        text = value.strip()
        return bool(text) and not PLACEHOLDER_VALUE_RE.fullmatch(text)
    if isinstance(value, dict):
        return any(has_semantic_value(item) for item in value.values())
    if isinstance(value, (list, tuple, set, frozenset)):
        return any(has_semantic_value(item) for item in value)
    return True


def normalize_placeholder_values(value: Any) -> Any:
    """Replace schema/LLM placeholder leaves with JSON null."""
    if isinstance(value, str):
        text = value.strip()
        return None if PLACEHOLDER_VALUE_RE.fullmatch(text) else value
    if isinstance(value, dict):
        return {
            key: normalize_placeholder_values(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [normalize_placeholder_values(item) for item in value]
    if isinstance(value, tuple):
        return tuple(normalize_placeholder_values(item) for item in value)
    return value


DEEP_FIELDS: tuple[str, ...] = (
    "programme_status",
    "programme_focus",
    "curriculum_overview",
    "specialisations",
    "learning_outcomes",
    "academic_cycle",
    "intakes",
    "priority_deadline",
    "funding_deadline",
    "international_deadline",
    "final_deadline",
    "rolling_admission",
    "minimum_degree",
    "minimum_gpa",
    "gpa_scale",
    "subject_prerequisites",
    "admission_difficulty",
    "ielts_overall",
    "ielts_subscores",
    "toefl",
    "duolingo",
    "standardized_tests",
    "work_experience",
    "portfolio",
    "required_documents",
    "recommendation_letters",
    "sop_essay_requirements",
    "graduation_certificate",
    "academic_transcript",
    "application_fee",
    "application_url",
    "tuition",
    "additional_fees",
    "scholarships",
    "career_outcomes",
    "employment_outcomes",
)

SCHOOL_PROFILE_FIELDS: tuple[str, ...] = (
    "vision",
    "mission",
    "core_values",
    "student_development_goals",
)


EXTRACTION_FIELD_GROUPS: dict[str, tuple[str, ...]] = {
    "identity_offering": (
        "programme_status",
        "academic_cycle",
        "intakes",
        "priority_deadline",
        "funding_deadline",
        "international_deadline",
        "final_deadline",
        "rolling_admission",
        "application_url",
    ),
    "academics_admissions": (
        "programme_focus",
        "curriculum_overview",
        "specialisations",
        "learning_outcomes",
        "minimum_degree",
        "minimum_gpa",
        "gpa_scale",
        "subject_prerequisites",
        "admission_difficulty",
        "standardized_tests",
        "work_experience",
        "portfolio",
        "required_documents",
        "recommendation_letters",
        "sop_essay_requirements",
        "graduation_certificate",
        "academic_transcript",
    ),
    "language": (
        "ielts_overall",
        "ielts_subscores",
        "toefl",
        "duolingo",
    ),
    "finance": (
        "application_fee",
        "tuition",
        "additional_fees",
    ),
    "funding": (
        "scholarships",
    ),
    "career_outcomes": (
        "career_outcomes",
        "employment_outcomes",
    ),
}


_GROUPED_DEEP_FIELDS = tuple(
    field_name
    for field_names in EXTRACTION_FIELD_GROUPS.values()
    for field_name in field_names
)
if (
    set(_GROUPED_DEEP_FIELDS) != set(DEEP_FIELDS)
    or len(_GROUPED_DEEP_FIELDS) != len(set(_GROUPED_DEEP_FIELDS))
):
    raise RuntimeError("Every deep field must belong to exactly one extraction group.")


HIGH_RISK_FIELDS: frozenset[str] = frozenset(
    {
        "programme_status",
        "priority_deadline",
        "funding_deadline",
        "international_deadline",
        "final_deadline",
        "minimum_degree",
        "minimum_gpa",
        "subject_prerequisites",
        "admission_difficulty",
        "ielts_overall",
        "ielts_subscores",
        "toefl",
        "duolingo",
        "standardized_tests",
        "required_documents",
        "recommendation_letters",
        "sop_essay_requirements",
        "graduation_certificate",
        "academic_transcript",
        "tuition",
        "additional_fees",
        "scholarships",
        "employment_outcomes",
    }
)

# Product eligibility is intentionally narrower than the display schema.
# Informational fields (fees, deadlines, admission difficulty, outcomes, and
# marketing copy) may be shown with citations but must not drive an automated
# eligibility result.
ELIGIBILITY_FIELDS: frozenset[str] = frozenset(
    {
        "programme_status",
        "minimum_degree",
        "minimum_gpa",
        "gpa_scale",
        "subject_prerequisites",
        "ielts_overall",
        "ielts_subscores",
        "toefl",
        "duolingo",
        "standardized_tests",
        "work_experience",
        "portfolio",
        "required_documents",
        "recommendation_letters",
        "sop_essay_requirements",
        "graduation_certificate",
        "academic_transcript",
    }
)


ADMISSION_PACKAGE_FIELDS: tuple[str, ...] = (
    "recommendation_letters",
    "sop_essay_requirements",
    "graduation_certificate",
    "academic_transcript",
)

ADMISSION_DOCUMENT_TYPES: frozenset[str] = frozenset(
    {
        "recommendation_letter",
        "statement_of_purpose",
        "personal_statement",
        "motivation_letter",
        "application_essay",
        "short_response",
        "application_essay_set",
        "graduation_certificate",
        "academic_transcript",
        "other",
    }
)

RECOMMENDATION_COMPONENT_TYPES: frozenset[str] = frozenset(
    {
        "teacher_recommendation",
        "counselor_recommendation",
        "counselor_materials",
        "academic_recommendation",
        "professional_recommendation",
        "supplemental_recommendation",
        "referee",
        "other",
    }
)

FUNDING_TYPES: frozenset[str] = frozenset(
    {
        "institutional_need_based_grant",
        "merit_scholarship",
        "external_scholarship",
        "fellowship",
        "assistantship",
        "grant",
        "loan",
        "financial_aid_policy",
        "unknown",
    }
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def stable_id(kind: str, *parts: str) -> str:
    key = "|".join((kind, *(part.strip().lower() for part in parts)))
    return str(uuid.uuid5(IDENTITY_NAMESPACE, key))


def _json_ready(value: Any) -> Any:
    if isinstance(value, enum.Enum):
        return value.value
    if dataclasses.is_dataclass(value):
        return {
            key: _json_ready(item)
            for key, item in dataclasses.asdict(value).items()
        }
    if isinstance(value, dict):
        return {str(key): _json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_json_ready(item) for item in value]
    return value


class JsonRecord:
    def to_dict(self) -> dict[str, Any]:
        return _json_ready(self)

    def to_json(self) -> str:
        return json.dumps(
            self.to_dict(), ensure_ascii=False, separators=(",", ":")
        )


@dataclass
class PolicyCheck(JsonRecord):
    institution_id: str
    domain: str
    robots_url: str
    robots_reachable: bool
    robots_allowed: bool
    terms_status: str
    terms_url: str | None
    policy_status: PolicyStatus
    checked_at: str = field(default_factory=utc_now_iso)
    notes: list[str] = field(default_factory=list)
    sitemaps: list[str] = field(default_factory=list)


@dataclass
class SourceDocument(JsonRecord):
    source_id: str
    institution_id: str
    url: str
    canonical_url: str
    page_type: PageType
    content_type: str | None
    http_status: int
    retrieved_at: str
    content_hash: str
    raw_object_path: str | None
    title: str | None = None
    language: str | None = None
    text_length: int = 0
    fetch_method: str = "http"
    rendered: bool = False


@dataclass
class ProgrammeRecord(JsonRecord):
    programme_id: str
    institution_id: str
    programme_name: str
    official_url: str
    degree_level: str | None
    credential: str | None
    normalized_field: str | None
    organisation_unit_id: str | None
    language: str | None
    campus: str | None
    delivery_mode: str | None
    duration: str | None
    programme_status: str | None
    catalogue_source: str
    retrieved_at: str
    verification_status: VerificationStatus = VerificationStatus.DISCOVERED
    is_deep_selected: bool = False
    selection_basis: str | None = None
    selection_rank: int | None = None
    priority_source: str | None = None
    priority_rank: int | None = None
    priority_label: str | None = None
    priority_taxonomy_code: str | None = None
    priority_completions_total: int | None = None
    priority_degree_completions: int | None = None
    priority_match_score: float | None = None


@dataclass
class OrganisationUnit(JsonRecord):
    organisation_unit_id: str
    institution_id: str
    parent_organisation_unit_id: str | None
    unit_name: str
    unit_type: OrganisationUnitType
    official_url: str | None
    source_url: str
    evidence: str
    confidence: float
    verification_status: VerificationStatus
    retrieved_at: str


@dataclass
class ProgrammeOrganisationUnit(JsonRecord):
    programme_id: str
    organisation_unit_id: str
    relationship_type: str
    is_primary: bool
    source_url: str
    evidence: str
    confidence: float
    verification_status: VerificationStatus


@dataclass
class ProgrammeOffering(JsonRecord):
    programme_offering_id: str
    programme_id: str
    academic_cycle: str | None
    intake: str | None
    campus: str | None
    delivery_mode: str | None
    audience: str | None
    application_status: str | None


@dataclass
class FieldAssertion(JsonRecord):
    assertion_id: str
    entity_type: str
    entity_id: str
    field_name: str
    value_json: Any
    null_reason: NullReason | None
    source_url: str | None
    source_type: str | None
    evidence: str | None
    evidence_locator: str | None
    scope: str | None
    audience: str | None
    academic_cycle: str | None
    retrieved_at: str
    confidence: float
    verification_status: VerificationStatus
    extractor_version: str
    model_name: str | None
    validation_errors: list[str] = field(default_factory=list)
    extraction_group: str | None = None
    applicability_source_url: str | None = None
    applicability_evidence: str | None = None
    source_content_hash: str | None = None
    review_fingerprint: str | None = None
    inherited_from_assertion_id: str | None = None
    inherited_from_entity_id: str | None = None
    inheritance_key: str | None = None


@dataclass
class CrawlError(JsonRecord):
    error_id: str
    institution_id: str | None
    url: str | None
    stage: str
    error_code: str
    message: str
    retryable: bool
    created_at: str = field(default_factory=utc_now_iso)


@dataclass
class FetchResult:
    requested_url: str
    final_url: str
    status: int
    headers: dict[str, str]
    content_type: str | None
    body: bytes
    content_hash: str
    retrieved_at: str
    redirect_chain: list[str] = field(default_factory=list)


@dataclass
class ParsedPage:
    url: str
    title: str | None
    text: str
    links: list[tuple[str, str]]
    language: str | None = None
