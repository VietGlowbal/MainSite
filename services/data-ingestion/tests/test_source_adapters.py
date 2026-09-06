from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from glowbal_ingestion.acquisition import AcquisitionIntent, EntityRef, SourceCandidate
from glowbal_ingestion.config import ExternalSourceRule, InstitutionSeed
from glowbal_ingestion.discovery import ProgrammeCandidate, programme_url_score
from glowbal_ingestion.ipeds import default_dataset_specs
from glowbal_ingestion.scorecard import SCORECARD_DATA_URL
from glowbal_ingestion.supabase_import import _source_candidate_rows
from glowbal_ingestion.models import FetchResult, RawDocument, SourceAuthority, SourceRelationship, TemporalState
from glowbal_ingestion.raw_evidence import RawEvidenceDurability, RawSnapshotInput
from glowbal_ingestion.raw_evidence import source_identity_for_url
from glowbal_ingestion.source_adapters import (
    AcquisitionPlatformBackend,
    Crawl4AIRenderAdapter,
    FixtureArchiveAdapter,
    FixtureSearchProvider,
    IpedsSourceAdapter,
    JsonApiSourceAdapter,
    PdfDocumentCandidateAdapter,
    ScorecardSourceAdapter,
    SearchSourceAdapter,
    SourceAdapterContext,
    SourceRegistry,
    SourceResolver,
    multilingual_candidate_score,
    persist_admitted_fetch,
    raw_snapshot_reusable,
)


class _RemoteStore:
    durability = RawEvidenceDurability.REMOTE_DURABLE

    def __init__(self) -> None:
        self.saved: list[RawDocument] = []

    def put_snapshot(self, snapshot: RawSnapshotInput) -> RawDocument:
        item = RawDocument(
            raw_document_id=snapshot.raw_document_id, source_identity=snapshot.source_identity or "",
            canonical_url=snapshot.canonical_url, content_hash=snapshot.payload_hash,
            content_type=snapshot.content_type, retrieved_at=snapshot.retrieved_at,
            payload_location="fixture-remote", payload_reference=snapshot.payload_hash,
            academic_cycle=snapshot.academic_cycle, source_authority=snapshot.source_authority,
            source_relationship=snapshot.source_relationship,
        )
        self.saved.append(item)
        return item

    def list_snapshots(self, source_identity, *, limit=100):
        return [
            item for item in self.saved
            if item.source_identity == source_identity
        ][:limit]


class _CandidateAdapter:
    adapter_id = "fixture_adapter"
    priority = 1

    def __init__(self, candidate):
        self.candidate = candidate
        self.calls = 0

    def supports(self, intent, context):
        return True

    def discover(self, intent, context):
        self.calls += 1
        return [self.candidate]


class _LegacyDiscovery:
    def __init__(self, candidates):
        self.candidates = candidates

    def discover(self, seed, policy):
        return self.candidates, ["https://example.edu/sitemap.xml"], []


class _Fetcher:
    limits = type("Limits", (), {"user_agent": "fixture"})()

    def fetch(self, url, *, allowed_domains, **_kwargs):
        if "government.example" not in allowed_domains:
            raise AssertionError("related domain did not use explicit admission rule")
        body = b'{"fee":100}'
        return FetchResult(
            requested_url=url, final_url=url, status=200, headers={"content-type": "application/json"},
            content_type="application/json", body=body,
            content_hash=hashlib.sha256(body).hexdigest(), retrieved_at="2026-08-28T00:00:00+00:00",
        )


class _AllowAllRobots:
    def allows(self, url, user_agent, *, allowed_domains):
        return True


def _seed() -> InstitutionSeed:
    return InstitutionSeed(
        institution_id="u1", name="Example University", country_code="US",
        official_domain="example.edu", homepage_url="https://example.edu",
        external_source_rules=(ExternalSourceRule(
            domain="government.example", adapter_id="government_fixture", reason="published fee dataset",
            relationship=SourceRelationship.GOVERNMENT, authority=SourceAuthority.GOVERNMENT,
        ),),
    )


class SourceAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.entity = EntityRef("PROGRAMME", "p1")
        self.intent = AcquisitionIntent.create(
            entity=self.entity, field_groups=("tuition",), reason="test",
            preferred_source_classes=("government_dataset", "pdf", "archive", "search_index"),
        )

    def test_explicit_related_party_is_admitted_then_durably_persisted(self) -> None:
        candidate = SourceCandidate.create(
            canonical_locator="https://government.example/fees/p1.json", locator_type="json_api",
            source_class="government_dataset", adapter_id="government_fixture",
            relationship=SourceRelationship.GOVERNMENT, relationship_evidence=("dataset names institution id",),
            declared_authority=SourceAuthority.GOVERNMENT, expected_field_groups=("tuition",),
        )
        decision = SourceResolver().evaluate(candidate, seed=_seed(), intent=self.intent)
        self.assertTrue(decision.admitted)
        store = _RemoteStore()
        raw, attempt = persist_admitted_fetch(
            candidate=candidate, decision=decision, fetcher=_Fetcher(), raw_store=store,
            acquisition_run_id="run-1", robots_policy=_AllowAllRobots(),
        )
        self.assertIsNotNone(raw)
        self.assertEqual(attempt.status, "RAW_PERSISTED")
        self.assertEqual(attempt.raw_document_id, raw.raw_document_id)
        self.assertEqual(raw.source_authority, SourceAuthority.GOVERNMENT)

    def test_external_text_mention_is_not_fetch_admission(self) -> None:
        candidate = SourceCandidate.create(
            canonical_locator="https://government.example/fees", locator_type="url", source_class="government_dataset",
            adapter_id="government_fixture", relationship=SourceRelationship.GOVERNMENT,
            relationship_evidence=("mentioned in prose",), declared_authority=SourceAuthority.GOVERNMENT,
            discovery_method="text_mention",
        )
        self.assertFalse(SourceResolver().evaluate(candidate, seed=_seed(), intent=self.intent).admitted)

    def test_admitted_candidate_does_not_claim_remote_retention_with_local_store(self) -> None:
        candidate = SourceCandidate.create(
            canonical_locator="https://government.example/fees/p1.json", locator_type="json_api",
            source_class="government_dataset", adapter_id="government_fixture",
            relationship=SourceRelationship.GOVERNMENT, relationship_evidence=("dataset names institution id",),
            declared_authority=SourceAuthority.GOVERNMENT,
        )
        decision = SourceResolver().evaluate(candidate, seed=_seed(), intent=self.intent)
        local_store = type("LocalStore", (), {"durability": RawEvidenceDurability.LOCAL_ONLY})()
        raw, attempt = persist_admitted_fetch(
            candidate=candidate, decision=decision, fetcher=_Fetcher(), raw_store=local_store,
        )
        self.assertIsNone(raw)
        self.assertEqual(attempt.error_code.value, "RAW_PERSIST_FAILED")

    def test_pdf_and_multilingual_signals_are_field_directed(self) -> None:
        score = PdfDocumentCandidateAdapter.score_candidate(
            url="https://example.edu/docs/2026-fees.pdf", title="International tuition handbook", field_groups=("tuition",)
        )
        self.assertGreater(score, 2)
        self.assertGreater(multilingual_candidate_score(title="大学院 学费 与 奖学金", language="zh"), 3)
        self.assertEqual(multilingual_candidate_score(title="大学院", language="en"), 0)
        self.assertGreater(
            programme_url_score("https://example.edu/catalogue/entry", "大学院 学位 课程"),
            programme_url_score("https://example.edu/catalogue/entry", ""),
        )

    def test_json_and_structured_adapters_preserve_dataset_metadata(self) -> None:
        context = SourceAdapterContext(
            entity=self.entity,
            configuration={"json_api_resources": ({"url": "https://example.edu/api/programmes", "dataset_id": "catalog-2026"},)},
        )
        json_candidate = JsonApiSourceAdapter().discover(self.intent, context)[0]
        self.assertEqual(json_candidate.locator_type, "json_api")
        spec = default_dataset_specs(2025)[0]
        ipeds = IpedsSourceAdapter().from_dataset_spec(
            spec, field_groups=("academics",), retrieved_at="2026-01-01T00:00:00+00:00",
        )
        scorecard = ScorecardSourceAdapter().from_dataset_resource(
            resource_url=SCORECARD_DATA_URL, data_year="2025-26", field_groups=("finance",),
        )
        self.assertEqual(ipeds.provider_id, "IPEDS")
        self.assertEqual(scorecard.declared_authority, SourceAuthority.GOVERNMENT)

    def test_search_is_candidate_only_and_archive_is_historical(self) -> None:
        search = SearchSourceAdapter(FixtureSearchProvider(({"url": "https://outside.example/result", "snippet": "tuition"},)))
        candidate = search.discover(self.intent, SourceAdapterContext(entity=self.entity))[0]
        self.assertEqual(candidate.discovery_method, "search_snippet")
        self.assertIsNone(candidate.raw_document_id)
        archive = FixtureArchiveAdapter(({
            "url": "https://archive.example/capture", "original_url": "https://example.edu/fees", "captured_at": "2024-01-01T00:00:00Z",
        },)).discover(self.intent, SourceAdapterContext(entity=self.entity))[0]
        self.assertEqual(archive.temporal_state, TemporalState.HISTORICAL)
        self.assertEqual(archive.declared_authority, SourceAuthority.ARCHIVE)

    def test_render_strategy_and_raw_reuse_are_explicit(self) -> None:
        candidate = SourceCandidate.create(
            canonical_locator="https://example.edu/program", locator_type="url", source_class="official_web", adapter_id="fixture"
        )
        self.assertEqual(Crawl4AIRenderAdapter.render_candidate(candidate).fetch_strategy, "render")
        snapshot = RawDocument(
            raw_document_id="r1", source_identity="s1", canonical_url="https://example.edu/program", content_hash="a",
            content_type="text/html", retrieved_at="2026-08-27T00:00:00+00:00", payload_location="mongo_inline",
            payload_reference="a", academic_cycle="2026-27",
        )
        reusable = raw_snapshot_reusable([snapshot], target_cycle="2026-27")
        self.assertEqual(reusable.raw_document_id, "r1")

    def test_shadow_keeps_original_legacy_programme_candidates(self) -> None:
        originals = [ProgrammeCandidate(
            url="https://example.edu/programme?utm_source=fixture",
            name_hint="Program",
            catalogue_source="native",
            score=4,
        )]
        backend = AcquisitionPlatformBackend(
            _LegacyDiscovery(originals),
            mode="platform_shadow",
        )
        programmes, sitemaps, errors = backend.discover(_seed(), object())
        self.assertIs(programmes, originals)
        self.assertEqual(programmes[0].url, originals[0].url)
        self.assertEqual(sitemaps, ["https://example.edu/sitemap.xml"])
        self.assertEqual(errors, [])

    def test_shadow_operational_path_reuses_remote_snapshot_without_fetch(self) -> None:
        candidate = SourceCandidate.create(
            canonical_locator="https://example.edu/programme", locator_type="url",
            source_class="official_web", adapter_id="fixture_adapter",
            relationship=SourceRelationship.DIRECT_OFFICIAL,
            relationship_evidence=("official source",),
            declared_authority=SourceAuthority.OFFICIAL,
            expected_field_groups=("tuition",), academic_cycle="2026-27",
        )
        store = _RemoteStore()
        store.saved.append(RawDocument(
            raw_document_id="raw-existing",
            source_identity=source_identity_for_url(candidate.canonical_locator),
            canonical_url=candidate.canonical_locator, content_hash="body",
            content_type="text/html", retrieved_at="2026-08-28T00:00:00+00:00",
            payload_location="mongo_inline", payload_reference="body",
            academic_cycle="2026-27",
        ))

        class NeverFetch:
            limits = type("Limits", (), {"user_agent": "fixture"})()

            def fetch(self, *args, **kwargs):
                raise AssertionError("reused evidence must not be fetched")

        adapter = _CandidateAdapter(candidate)
        artifacts = {}

        def artifact_sink(stream, row):
            artifacts.setdefault(stream, []).append(row)

        backend = AcquisitionPlatformBackend(
            _LegacyDiscovery([]),
            mode="platform_shadow",
            registry=SourceRegistry((adapter,)),
            fetcher=NeverFetch(),
            raw_evidence_store=store,
            acquisition_run_id="run-1",
            artifact_sink=artifact_sink,
        )
        decisions, attempts = backend.acquire_intent(
            self.intent,
            SourceAdapterContext(
                entity=self.entity, seed=_seed(), target_cycle="2026-27",
            ),
            fetch_admitted=True,
        )
        self.assertEqual(adapter.calls, 1)
        self.assertTrue(decisions[0].admitted)
        reused = next(item for item in attempts if item.status == "RAW_REUSED")
        self.assertEqual(reused.raw_document_id, "raw-existing")
        self.assertEqual(
            set(artifacts),
            {
                "acquisition_intents",
                "source_candidates",
                "source_discovery_evidence",
                "source_admission_decisions",
                "acquisition_attempts",
            },
        )
        staged_candidate = artifacts["source_candidates"][0]
        self.assertEqual(staged_candidate["provider_id"], None)
        self.assertEqual(staged_candidate["source_authority"], "OFFICIAL")
        self.assertNotIn("adapter_metadata", staged_candidate)
        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary)
            (run_dir / "source_candidates.jsonl").write_text(
                json.dumps(staged_candidate) + "\n",
                encoding="utf-8",
            )
            imported = next(_source_candidate_rows(
                run_dir,
                "00000000-0000-0000-0000-000000000001",
            ))
        self.assertEqual(imported["source_authority"], "OFFICIAL")
        self.assertNotIn("adapter_metadata", imported)

    def test_external_rules_minimum_authority_and_redirect_are_fail_closed(self) -> None:
        partner = ExternalSourceRule(
            domain="partner.example", adapter_id="shared_adapter", reason="partner",
            relationship=SourceRelationship.PARTNER_INSTITUTION,
            authority=SourceAuthority.OFFICIAL_PARTNER,
        )
        seed = InstitutionSeed(
            institution_id="u1", name="Example University", country_code="US",
            official_domain="example.edu", homepage_url="https://example.edu",
            external_source_rules=(*_seed().external_source_rules, partner),
        )
        government = SourceCandidate.create(
            canonical_locator="https://government.example/fees", locator_type="url",
            source_class="government_dataset", adapter_id="government_fixture",
            relationship=SourceRelationship.GOVERNMENT,
            relationship_evidence=("published target institution id",),
            declared_authority=SourceAuthority.GOVERNMENT,
        )
        decision = SourceResolver().evaluate(government, seed=seed, intent=self.intent)
        self.assertTrue(decision.admitted)
        self.assertIn("government.example", decision.allowed_domains)
        self.assertNotIn("partner.example", decision.allowed_domains)
        official_only = AcquisitionIntent.create(
            entity=self.entity, field_groups=("tuition",), reason="test",
            minimum_authority=SourceAuthority.OFFICIAL,
        )
        rejected = SourceResolver().evaluate(government, seed=seed, intent=official_only)
        self.assertEqual(rejected.reason, "AUTHORITY_BELOW_MINIMUM")

        class RedirectingFetcher:
            limits = type("Limits", (), {"user_agent": "fixture"})()

            def fetch(self, url, **kwargs):
                return FetchResult(
                    requested_url=url, final_url="https://unexpected.example/path",
                    status=200, headers={}, content_type="text/html", body=b"x",
                    content_hash=hashlib.sha256(b"x").hexdigest(),
                    retrieved_at="2026-08-28T00:00:00+00:00",
                )

        raw, attempt = persist_admitted_fetch(
            candidate=government, decision=decision, fetcher=RedirectingFetcher(),
            raw_store=_RemoteStore(), robots_policy=_AllowAllRobots(),
        )
        self.assertIsNone(raw)
        self.assertEqual(
            attempt.admission_reason,
            "FINAL_URL_OUTSIDE_ADMITTED_DOMAINS",
        )

    def test_missing_robots_policy_prevents_fetch_and_persistence(self) -> None:
        candidate = SourceCandidate.create(
            canonical_locator="https://government.example/fees", locator_type="url",
            source_class="government_dataset", adapter_id="government_fixture",
            relationship=SourceRelationship.GOVERNMENT,
            relationship_evidence=("published target institution id",),
            declared_authority=SourceAuthority.GOVERNMENT,
        )
        decision = SourceResolver().evaluate(candidate, seed=_seed(), intent=self.intent)

        class NeverFetch:
            limits = type("Limits", (), {"user_agent": "fixture"})()

            def fetch(self, *args, **kwargs):
                raise AssertionError("fetch requires an explicit robots policy")

        store = _RemoteStore()
        raw, attempt = persist_admitted_fetch(
            candidate=candidate,
            decision=decision,
            fetcher=NeverFetch(),
            raw_store=store,
        )
        self.assertIsNone(raw)
        self.assertEqual(attempt.error_code.value, "SOURCE_REJECTED_BY_POLICY")
        self.assertEqual(attempt.admission_reason, "ROBOTS_POLICY_REQUIRED")
        self.assertEqual(store.saved, [])


if __name__ == "__main__":
    unittest.main()
