"""Conservative stable identity and reconciliation primitives for Slice D.

The crawl URL is deliberately treated as an observation locator.  A stable
programme entity is created or matched only from institution-bound identifiers,
curation, or corroborated official evidence.  The module is pure apart from
the small in-memory registry used by tests and shadow-mode callers; durable
uniqueness is enforced by the additive SQL migration.
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Iterable, Mapping, Sequence

from .models import stable_id, utc_now_iso


def _clean(value: object | None) -> str:
    return " ".join(str(value or "").casefold().split())


def _tokenize(value: object | None) -> tuple[str, ...]:
    return tuple(
        token
        for token in re.findall(r"[a-z0-9]+", _clean(value))
        if len(token) > 1
    )


class IdentityDecision(str, Enum):
    RESOLVED = "RESOLVED"
    CREATED = "CREATED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    UNMATCHED = "UNMATCHED"


class IdentityMethod(str, Enum):
    OFFICIAL_PROGRAMME_CODE = "OFFICIAL_PROGRAMME_CODE"
    INSTITUTION_PROVIDER_ID = "INSTITUTION_PROVIDER_ID"
    NATIONAL_IDENTIFIER = "NATIONAL_IDENTIFIER"
    ACCREDITOR_IDENTIFIER = "ACCREDITOR_IDENTIFIER"
    CURATOR_MAPPING = "CURATOR_MAPPING"
    CORROBORATED_OFFICIAL = "CORROBORATED_OFFICIAL"
    VERIFIED_DOMAIN = "VERIFIED_DOMAIN"
    LEGAL_NAME_COUNTRY_IDENTIFIER = "LEGAL_NAME_COUNTRY_IDENTIFIER"
    NONE = "NONE"


class ProgrammeRelationEvent(str, Enum):
    RENAMED_TO = "RENAMED_TO"
    MERGED_INTO = "MERGED_INTO"
    SPLIT_FROM = "SPLIT_FROM"
    SUCCESSOR_OF = "SUCCESSOR_OF"
    EQUIVALENT_TO = "EQUIVALENT_TO"


class InstitutionRole(str, Enum):
    AWARDING = "awarding"
    TEACHING = "teaching"
    PARTNER = "partner"
    LEAD = "lead"


@dataclass(frozen=True)
class IdentityIdentifier:
    scheme: str
    value: str
    issuer: str | None = None
    authority: str | None = None
    valid_from: str | None = None
    valid_to: str | None = None
    source_assertion_id: str | None = None

    def __post_init__(self) -> None:
        if not _clean(self.scheme) or not _clean(self.value):
            raise ValueError("identity identifiers require scheme and value")

    @property
    def key(self) -> tuple[str, str]:
        return (_clean(self.scheme), _clean(self.value))

    def to_dict(self) -> dict[str, object | None]:
        return {
            "scheme": self.scheme,
            "value": self.value,
            "issuer": self.issuer,
            "authority": self.authority,
            "valid_from": self.valid_from,
            "valid_to": self.valid_to,
            "source_assertion_id": self.source_assertion_id,
        }


@dataclass(frozen=True)
class UniversityDomainClaim:
    domain: str
    university_id: str
    verification_method: str
    verified: bool
    first_seen: str
    last_verified: str
    source_assertion_id: str | None = None
    valid_from: str | None = None
    valid_to: str | None = None

    def __post_init__(self) -> None:
        if not _clean(self.domain) or not self.university_id:
            raise ValueError("domain claims require domain and university")

    def to_dict(self) -> dict[str, object | None]:
        return {
            "domain": self.domain.casefold(),
            "university_id": self.university_id,
            "verification_method": self.verification_method,
            "verified": self.verified,
            "first_seen": self.first_seen,
            "last_verified": self.last_verified,
            "source_assertion_id": self.source_assertion_id,
            "valid_from": self.valid_from,
            "valid_to": self.valid_to,
        }


@dataclass(frozen=True)
class UniversityObservation:
    observation_id: str
    name: str
    country: str | None = None
    identifiers: tuple[IdentityIdentifier, ...] = ()
    domain: str | None = None
    domain_verified: bool = False
    curator_target_id: str | None = None
    source_assertion_ids: tuple[str, ...] = ()
    legal_name: str | None = None

    def __post_init__(self) -> None:
        if not self.observation_id or not _clean(self.name):
            raise ValueError("university observations require id and name")


@dataclass(frozen=True)
class UniversityIdentity:
    university_id: str
    canonical_name: str
    country: str | None
    identifiers: tuple[IdentityIdentifier, ...] = ()
    domain_claims: tuple[UniversityDomainClaim, ...] = ()
    version: str = "university-identity/v1"

    def identifier_keys(self) -> frozenset[tuple[str, str]]:
        return frozenset(identifier.key for identifier in self.identifiers)


@dataclass(frozen=True)
class InstitutionRoleAssignment:
    university_id: str
    role: InstitutionRole
    source_assertion_ids: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, object]:
        return {
            "university_id": self.university_id,
            "role": self.role.value,
            "source_assertion_ids": list(self.source_assertion_ids),
        }


@dataclass(frozen=True)
class ProgrammeObservation:
    observation_id: str
    university_id: str | None
    programme_name: str
    official_url: str
    degree_level: str | None = None
    credential: str | None = None
    academic_unit: str | None = None
    language: str | None = None
    academic_cycle: str | None = None
    campus: str | None = None
    delivery_mode: str | None = None
    official_programme_code: str | None = None
    provider_id: str | None = None
    national_identifier: str | None = None
    accreditor_identifier: str | None = None
    curator_target_id: str | None = None
    source_assertion_ids: tuple[str, ...] = ()
    official_source_ids: tuple[str, ...] = ()
    institution_roles: tuple[InstitutionRoleAssignment, ...] = ()
    retrieved_at: str = field(default_factory=utc_now_iso)

    def __post_init__(self) -> None:
        if not self.observation_id or not self.official_url:
            raise ValueError("programme observations require id and URL")
        if not _clean(self.programme_name):
            raise ValueError("programme observations require a name")

    @property
    def title_tokens(self) -> tuple[str, ...]:
        return _tokenize(self.programme_name)

    def identifiers(self) -> tuple[IdentityIdentifier, ...]:
        values = (
            ("official_programme_code", self.official_programme_code),
            ("institution_provider_id", self.provider_id),
            ("national_identifier", self.national_identifier),
            ("accreditor_identifier", self.accreditor_identifier),
        )
        return tuple(
            IdentityIdentifier(scheme=scheme, value=value)
            for scheme, value in values
            if _clean(value)
        )

    @property
    def has_corroborated_official_evidence(self) -> bool:
        return len(set(self.official_source_ids)) >= 2 or len(
            set(self.source_assertion_ids)
        ) >= 2


@dataclass(frozen=True)
class ProgrammeAlias:
    programme_entity_id: str
    alias_url: str
    language: str | None
    academic_cycle: str | None
    discovery_source: str | None
    first_seen: str
    last_seen: str
    identity_evidence: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, object]:
        return {
            "programme_entity_id": self.programme_entity_id,
            "alias_url": self.alias_url,
            "language": self.language,
            "academic_cycle": self.academic_cycle,
            "discovery_source": self.discovery_source,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "identity_evidence": list(self.identity_evidence),
        }


@dataclass(frozen=True)
class ProgrammeVersion:
    programme_entity_id: str
    academic_cycle: str | None
    campus: str | None
    delivery_mode: str | None
    language: str | None
    source_observation_id: str
    offering_id: str

    def to_dict(self) -> dict[str, object | None]:
        return {
            "programme_entity_id": self.programme_entity_id,
            "academic_cycle": self.academic_cycle,
            "campus": self.campus,
            "delivery_mode": self.delivery_mode,
            "language": self.language,
            "source_observation_id": self.source_observation_id,
            "offering_id": self.offering_id,
        }


@dataclass(frozen=True)
class ProgrammeRelationship:
    from_programme_entity_id: str
    to_programme_entity_id: str
    relation_event: ProgrammeRelationEvent
    supporting_assertion_ids: tuple[str, ...] = ()
    curator_approved: bool = False
    resolver_version: str = "identity-resolver/v1"
    created_at: str = field(default_factory=utc_now_iso)

    def __post_init__(self) -> None:
        if self.from_programme_entity_id == self.to_programme_entity_id:
            raise ValueError("a programme relationship cannot point to itself")

    def to_dict(self) -> dict[str, object]:
        return {
            "from_programme_entity_id": self.from_programme_entity_id,
            "to_programme_entity_id": self.to_programme_entity_id,
            "relation_event": self.relation_event.value,
            "supporting_assertion_ids": list(self.supporting_assertion_ids),
            "curator_approved": self.curator_approved,
            "resolver_version": self.resolver_version,
            "created_at": self.created_at,
        }


@dataclass(frozen=True)
class ProgrammeIdentity:
    programme_entity_id: str
    university_id: str | None
    canonical_title: str
    degree_level: str | None
    credential: str | None
    academic_unit: str | None = None
    identifiers: tuple[IdentityIdentifier, ...] = ()
    aliases: tuple[ProgrammeAlias, ...] = ()
    versions: tuple[ProgrammeVersion, ...] = ()
    institution_roles: tuple[InstitutionRoleAssignment, ...] = ()
    status: str = "DISCOVERED"
    version: str = "programme-identity/v1"

    def identifier_keys(self) -> frozenset[tuple[str, str]]:
        return frozenset(identifier.key for identifier in self.identifiers)

    def add_observation(
        self,
        observation: ProgrammeObservation,
        *,
        discovery_source: str | None = None,
    ) -> "ProgrammeIdentity":
        now = observation.retrieved_at
        aliases = list(self.aliases)
        existing = next(
            (alias for alias in aliases if alias.alias_url == observation.official_url),
            None,
        )
        if existing is None:
            aliases.append(
                ProgrammeAlias(
                    programme_entity_id=self.programme_entity_id,
                    alias_url=observation.official_url,
                    language=observation.language,
                    academic_cycle=observation.academic_cycle,
                    discovery_source=discovery_source,
                    first_seen=now,
                    last_seen=now,
                    identity_evidence=observation.source_assertion_ids,
                )
            )
        else:
            aliases[aliases.index(existing)] = ProgrammeAlias(
                **{
                    **existing.to_dict(),
                    "identity_evidence": tuple(
                        dict.fromkeys(
                            (*existing.identity_evidence, *observation.source_assertion_ids)
                        )
                    ),
                    "last_seen": max(existing.last_seen, now),
                }
            )
        versions = list(self.versions)
        version_key = (
            observation.academic_cycle,
            observation.campus,
            observation.delivery_mode,
            observation.language,
        )
        if not any(
            (item.academic_cycle, item.campus, item.delivery_mode, item.language)
            == version_key
            for item in versions
        ):
            versions.append(
                ProgrammeVersion(
                    programme_entity_id=self.programme_entity_id,
                    academic_cycle=observation.academic_cycle,
                    campus=observation.campus,
                    delivery_mode=observation.delivery_mode,
                    language=observation.language,
                    source_observation_id=observation.observation_id,
                    offering_id=stable_id(
                        "programme-offering",
                        self.programme_entity_id,
                        *(str(part or "") for part in version_key),
                    ),
                )
            )
        roles = tuple(dict.fromkeys((*self.institution_roles, *observation.institution_roles)))
        identifiers = tuple(dict.fromkeys((*self.identifiers, *observation.identifiers())))
        return ProgrammeIdentity(
            programme_entity_id=self.programme_entity_id,
            university_id=self.university_id,
            canonical_title=self.canonical_title,
            degree_level=self.degree_level,
            credential=self.credential,
            academic_unit=self.academic_unit,
            identifiers=identifiers,
            aliases=tuple(aliases),
            versions=tuple(versions),
            institution_roles=roles,
            status=self.status,
            version=self.version,
        )


@dataclass(frozen=True)
class IdentityDecisionRecord:
    entity_type: str
    observation_id: str
    candidate_entity_id: str | None
    resolved_entity_id: str | None
    decision: IdentityDecision
    method: IdentityMethod
    supporting_identifier_keys: tuple[tuple[str, str], ...] = ()
    supporting_assertion_ids: tuple[str, ...] = ()
    confidence: float = 0.0
    resolver_version: str = "identity-resolver/v1"
    decided_at: str = field(default_factory=utc_now_iso)
    reason: str | None = None

    @property
    def decision_id(self) -> str:
        return stable_id(
            "identity-decision",
            self.entity_type,
            self.observation_id,
            self.resolved_entity_id or "unresolved",
            self.decision.value,
        )

    def to_dict(self) -> dict[str, object]:
        return {
            "decision_id": self.decision_id,
            "entity_type": self.entity_type,
            "observation_id": self.observation_id,
            "candidate_entity_id": self.candidate_entity_id,
            "resolved_entity_id": self.resolved_entity_id,
            "decision": self.decision.value,
            "method": self.method.value,
            "supporting_identifier_keys": [list(item) for item in self.supporting_identifier_keys],
            "supporting_assertion_ids": list(self.supporting_assertion_ids),
            "confidence": self.confidence,
            "resolver_version": self.resolver_version,
            "decided_at": self.decided_at,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class IdentityResolution:
    identity: ProgrammeIdentity | None
    decision: IdentityDecisionRecord
    candidates: tuple[str, ...] = ()

    @property
    def resolved(self) -> bool:
        return self.identity is not None and self.decision.decision in {
            IdentityDecision.RESOLVED,
            IdentityDecision.CREATED,
        }


@dataclass(frozen=True)
class UniversityResolution:
    identity: UniversityIdentity | None
    decision: IdentityDecisionRecord
    candidates: tuple[str, ...] = ()


class ProgrammeIdentityResolver:
    """Resolve identity by explicit hierarchy, never by URL similarity."""

    VERSION = "identity-resolver/v1"

    def resolve(
        self,
        observation: ProgrammeObservation,
        existing: Iterable[ProgrammeIdentity] = (),
    ) -> IdentityResolution:
        identities = tuple(identity for identity in existing if identity is not None)
        identifiers = observation.identifiers()
        hierarchy: tuple[tuple[IdentityMethod, tuple[IdentityIdentifier, ...]], ...] = (
            (
                IdentityMethod.OFFICIAL_PROGRAMME_CODE,
                tuple(item for item in identifiers if item.scheme == "official_programme_code"),
            ),
            (
                IdentityMethod.INSTITUTION_PROVIDER_ID,
                tuple(item for item in identifiers if item.scheme == "institution_provider_id"),
            ),
            (
                IdentityMethod.NATIONAL_IDENTIFIER,
                tuple(item for item in identifiers if item.scheme == "national_identifier"),
            ),
            (
                IdentityMethod.ACCREDITOR_IDENTIFIER,
                tuple(item for item in identifiers if item.scheme == "accreditor_identifier"),
            ),
        )
        for method, keys in hierarchy:
            if not keys:
                continue
            matches = tuple(
                identity
                for identity in identities
                if identity.university_id == observation.university_id
                and any(key.key in identity.identifier_keys() for key in keys)
            )
            if len(matches) == 1:
                identity = matches[0].add_observation(observation)
                return IdentityResolution(
                    identity,
                    self._decision(
                        observation,
                        identity.programme_entity_id,
                        IdentityDecision.RESOLVED,
                        method,
                        keys,
                        1.0,
                        "institution-bound authoritative identifier",
                    ),
                )
            if len(matches) > 1:
                return self._review(
                    observation,
                    tuple(item.programme_entity_id for item in matches),
                    method,
                    keys,
                    "identifier resolves to multiple programme entities",
                )
            if observation.university_id:
                identity = self._new_identity(observation)
                return IdentityResolution(
                    identity,
                    self._decision(
                        observation,
                        identity.programme_entity_id,
                        IdentityDecision.CREATED,
                        method,
                        keys,
                        0.98,
                        "created from institution-bound programme identifier",
                    ),
                )

        if observation.curator_target_id:
            matches = tuple(
                item
                for item in identities
                if item.programme_entity_id == observation.curator_target_id
            )
            if len(matches) == 1:
                identity = matches[0].add_observation(observation)
                return IdentityResolution(
                    identity,
                    self._decision(
                        observation,
                        identity.programme_entity_id,
                        IdentityDecision.RESOLVED,
                        IdentityMethod.CURATOR_MAPPING,
                        (),
                        1.0,
                        "curator-approved mapping",
                    ),
                )

        if observation.has_corroborated_official_evidence:
            matches = tuple(
                identity
                for identity in identities
                if self._corroborated_match(observation, identity)
            )
            if len(matches) == 1:
                identity = matches[0].add_observation(observation)
                return IdentityResolution(
                    identity,
                    self._decision(
                        observation,
                        identity.programme_entity_id,
                        IdentityDecision.RESOLVED,
                        IdentityMethod.CORROBORATED_OFFICIAL,
                        (),
                        0.92,
                        "corroborated official identity set",
                    ),
                )
            if len(matches) > 1:
                return self._review(
                    observation,
                    tuple(item.programme_entity_id for item in matches),
                    IdentityMethod.CORROBORATED_OFFICIAL,
                    (),
                    "corroborated evidence remains ambiguous",
                )
            if observation.university_id:
                identity = self._new_identity(observation)
                return IdentityResolution(
                    identity,
                    self._decision(
                        observation,
                        identity.programme_entity_id,
                        IdentityDecision.CREATED,
                        IdentityMethod.CORROBORATED_OFFICIAL,
                        (),
                        0.9,
                        "created from corroborated official identity set",
                    ),
                )

        method = IdentityMethod.NONE
        return IdentityResolution(
            None,
            self._decision(
                observation,
                None,
                IdentityDecision.UNMATCHED,
                method,
                (),
                0.0,
                "no safe identifier or corroborated identity evidence; URL/title matching is insufficient",
            ),
        )

    def _corroborated_match(
        self,
        observation: ProgrammeObservation,
        identity: ProgrammeIdentity,
    ) -> bool:
        if identity.university_id != observation.university_id:
            return False
        if _clean(identity.degree_level) != _clean(observation.degree_level):
            return False
        if _clean(identity.credential) != _clean(observation.credential):
            return False
        if _clean(identity.academic_unit) != _clean(observation.academic_unit):
            return False
        return _tokenize(identity.canonical_title) == observation.title_tokens

    def _new_identity(self, observation: ProgrammeObservation) -> ProgrammeIdentity:
        identifiers = observation.identifiers()
        if identifiers:
            key = identifiers[0].key
            entity_id = stable_id("programme-entity", observation.university_id or "unknown", *key)
        else:
            entity_id = stable_id(
                "programme-entity",
                observation.university_id or "unknown",
                _clean(observation.programme_name),
                _clean(observation.degree_level),
                _clean(observation.credential),
                _clean(observation.academic_unit),
            )
        identity = ProgrammeIdentity(
            programme_entity_id=entity_id,
            university_id=observation.university_id,
            canonical_title=observation.programme_name,
            degree_level=observation.degree_level,
            credential=observation.credential,
            academic_unit=observation.academic_unit,
            identifiers=identifiers,
            institution_roles=observation.institution_roles,
        )
        return identity.add_observation(observation)

    def _decision(
        self,
        observation: ProgrammeObservation,
        entity_id: str | None,
        decision: IdentityDecision,
        method: IdentityMethod,
        identifiers: Sequence[IdentityIdentifier],
        confidence: float,
        reason: str,
    ) -> IdentityDecisionRecord:
        return IdentityDecisionRecord(
            entity_type="programme",
            observation_id=observation.observation_id,
            candidate_entity_id=entity_id,
            resolved_entity_id=entity_id if decision != IdentityDecision.UNMATCHED else None,
            decision=decision,
            method=method,
            supporting_identifier_keys=tuple(item.key for item in identifiers),
            supporting_assertion_ids=observation.source_assertion_ids,
            confidence=confidence,
            resolver_version=self.VERSION,
            reason=reason,
        )

    def _review(
        self,
        observation: ProgrammeObservation,
        candidates: tuple[str, ...],
        method: IdentityMethod,
        identifiers: Sequence[IdentityIdentifier],
        reason: str,
    ) -> IdentityResolution:
        return IdentityResolution(
            None,
            self._decision(
                observation,
                candidates[0] if len(candidates) == 1 else None,
                IdentityDecision.REVIEW_REQUIRED,
                method,
                identifiers,
                0.0,
                reason,
            ),
            candidates,
        )


class UniversityIdentityResolver:
    """Conservative university resolver; names alone never create identity."""

    VERSION = "university-resolver/v1"

    def resolve(
        self,
        observation: UniversityObservation,
        existing: Iterable[UniversityIdentity] = (),
        *,
        create_if_missing: bool = False,
    ) -> UniversityResolution:
        identities = tuple(existing)
        keys = tuple(identifier.key for identifier in observation.identifiers)
        if keys:
            matches = tuple(
                item
                for item in identities
                if any(key in item.identifier_keys() for key in keys)
            )
            if len(matches) == 1:
                return UniversityResolution(
                    self._with_claim(matches[0], observation),
                    self._university_decision(
                        observation,
                        matches[0].university_id,
                        IdentityDecision.RESOLVED,
                        IdentityMethod.LEGAL_NAME_COUNTRY_IDENTIFIER,
                        observation.identifiers,
                        1.0,
                        "authoritative university identifier",
                    ),
                )
            if len(matches) > 1:
                return self._university_review(
                    observation,
                    tuple(item.university_id for item in matches),
                    tuple(
                        IdentityIdentifier(scheme=key[0], value=key[1])
                        for key in keys
                    ),
                    "authoritative identifier collision",
                )

        domain = _clean(observation.domain)
        if observation.domain_verified and domain:
            matches = tuple(
                item
                for item in identities
                if any(_clean(claim.domain) == domain and claim.verified for claim in item.domain_claims)
            )
            if len(matches) == 1:
                return UniversityResolution(
                    self._with_claim(matches[0], observation),
                    self._university_decision(
                        observation,
                        matches[0].university_id,
                        IdentityDecision.RESOLVED,
                        IdentityMethod.VERIFIED_DOMAIN,
                        (),
                        0.95,
                        "verified institutional domain claim",
                    ),
                )
            if len(matches) > 1:
                return self._university_review(
                    observation,
                    tuple(item.university_id for item in matches),
                    (),
                    "verified domain is claimed by multiple universities",
                )

        if observation.curator_target_id:
            matches = tuple(
                item for item in identities if item.university_id == observation.curator_target_id
            )
            if len(matches) == 1:
                return UniversityResolution(
                    self._with_claim(matches[0], observation),
                    self._university_decision(
                        observation,
                        matches[0].university_id,
                        IdentityDecision.RESOLVED,
                        IdentityMethod.CURATOR_MAPPING,
                        (),
                        1.0,
                        "curator-approved university mapping",
                    ),
                )

        if create_if_missing and (keys or (observation.domain_verified and domain)):
            university_id = stable_id(
                "university-entity",
                *(f"{key[0]}:{key[1]}" for key in keys),
                domain,
                _clean(observation.country),
            )
            identity = UniversityIdentity(
                university_id=university_id,
                canonical_name=observation.legal_name or observation.name,
                country=observation.country,
                identifiers=observation.identifiers,
            )
            return UniversityResolution(
                self._with_claim(identity, observation),
                self._university_decision(
                    observation,
                    university_id,
                    IdentityDecision.CREATED,
                    IdentityMethod.LEGAL_NAME_COUNTRY_IDENTIFIER if keys else IdentityMethod.VERIFIED_DOMAIN,
                    observation.identifiers,
                    0.9,
                    "created only from strong university identity evidence",
                ),
            )

        return UniversityResolution(
            None,
            self._university_decision(
                observation,
                None,
                IdentityDecision.UNMATCHED,
                IdentityMethod.NONE,
                observation.identifiers,
                0.0,
                "name-only or unverified sparse university record is not safe to create",
            ),
        )

    def _with_claim(
        self,
        identity: UniversityIdentity,
        observation: UniversityObservation,
    ) -> UniversityIdentity:
        if not observation.domain or not observation.domain_verified:
            return identity
        now = utc_now_iso()
        claim = UniversityDomainClaim(
            domain=observation.domain,
            university_id=identity.university_id,
            verification_method="observation_verified_domain",
            verified=True,
            first_seen=now,
            last_verified=now,
            source_assertion_id=(observation.source_assertion_ids[0] if observation.source_assertion_ids else None),
        )
        if any(_clean(item.domain) == _clean(claim.domain) for item in identity.domain_claims):
            claims = identity.domain_claims
        else:
            claims = (*identity.domain_claims, claim)
        identifiers = tuple(dict.fromkeys((*identity.identifiers, *observation.identifiers)))
        return UniversityIdentity(
            university_id=identity.university_id,
            canonical_name=identity.canonical_name,
            country=identity.country,
            identifiers=identifiers,
            domain_claims=claims,
            version=identity.version,
        )

    def _university_decision(
        self,
        observation: UniversityObservation,
        entity_id: str | None,
        decision: IdentityDecision,
        method: IdentityMethod,
        identifiers: Sequence[IdentityIdentifier],
        confidence: float,
        reason: str,
    ) -> IdentityDecisionRecord:
        return IdentityDecisionRecord(
            entity_type="university",
            observation_id=observation.observation_id,
            candidate_entity_id=entity_id,
            resolved_entity_id=entity_id if decision != IdentityDecision.UNMATCHED else None,
            decision=decision,
            method=method,
            supporting_identifier_keys=tuple(item.key for item in identifiers),
            supporting_assertion_ids=observation.source_assertion_ids,
            confidence=confidence,
            resolver_version=self.VERSION,
            reason=reason,
        )

    def _university_review(
        self,
        observation: UniversityObservation,
        candidates: tuple[str, ...],
        identifiers: Sequence[tuple[str, str]],
        reason: str,
    ) -> UniversityResolution:
        return UniversityResolution(
            None,
            self._university_decision(
                observation,
                None,
                IdentityDecision.REVIEW_REQUIRED,
                IdentityMethod.LEGAL_NAME_COUNTRY_IDENTIFIER,
                tuple(IdentityIdentifier(scheme=key[0], value=key[1]) for key in identifiers),
                0.0,
                reason,
            ),
            candidates,
        )


class IdentityRegistry:
    """Thread-safe shadow registry mirroring database uniqueness constraints."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._programmes: dict[str, ProgrammeIdentity] = {}
        self._programme_identifiers: dict[tuple[str | None, tuple[str, str]], str] = {}
        self._universities: dict[str, UniversityIdentity] = {}
        self._university_identifiers: dict[tuple[str, str], str] = {}
        self.programme_resolver = ProgrammeIdentityResolver()
        self.university_resolver = UniversityIdentityResolver()

    def resolve_programme(self, observation: ProgrammeObservation) -> IdentityResolution:
        with self._lock:
            result = self.programme_resolver.resolve(observation, self._programmes.values())
            if result.identity is not None:
                self._programmes[result.identity.programme_entity_id] = result.identity
                for identifier in result.identity.identifiers:
                    self._programme_identifiers[
                        (result.identity.university_id, identifier.key)
                    ] = result.identity.programme_entity_id
            return result

    def resolve_university(
        self,
        observation: UniversityObservation,
        *,
        create_if_missing: bool = False,
    ) -> UniversityResolution:
        with self._lock:
            result = self.university_resolver.resolve(
                observation,
                self._universities.values(),
                create_if_missing=create_if_missing,
            )
            if result.identity is not None:
                self._universities[result.identity.university_id] = result.identity
                for identifier in result.identity.identifiers:
                    self._university_identifiers[identifier.key] = result.identity.university_id
            return result

    def programmes(self) -> tuple[ProgrammeIdentity, ...]:
        with self._lock:
            return tuple(self._programmes.values())

    def universities(self) -> tuple[UniversityIdentity, ...]:
        with self._lock:
            return tuple(self._universities.values())
