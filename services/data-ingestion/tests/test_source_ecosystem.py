import hashlib
import io
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from pypdf import PdfWriter

from glowbal_ingestion.acquisition import AcquisitionIntent, EntityRef
from glowbal_ingestion.config import ExternalSourceRule, InstitutionSeed, SmokeConfig, SourceEcosystemConfig
from glowbal_ingestion.discovery import ProgrammeCandidate
from glowbal_ingestion.fetcher import FetchError
from glowbal_ingestion.models import FetchResult, SourceAuthority, SourceRelationship
from glowbal_ingestion.raw_evidence import InMemoryRawEvidenceStore
from glowbal_ingestion.pipeline import SmokePipeline
from glowbal_ingestion.source_adapters import (
    AcquisitionPlatformBackend,
    SourceAdapterContext,
    build_source_registry,
)


CONFIG_PATH = Path(__file__).parents[1] / "configs" / "source-ecosystem-expansion-smoke.json"


class _Discovery:
    def discover(self, seed, policy):
        del policy
        return [
            ProgrammeCandidate(
                url=f"https://{seed.official_domain}/catalogue/programme",
                name_hint="Smoke programme",
                catalogue_source="fixture",
                score=3,
            )
        ], [], []


class _Robots:
    def allows(self, url, user_agent, *, allowed_domains=()):
        del url, user_agent
        return True if not allowed_domains else bool(allowed_domains)


class _Fetcher:
    limits = type("Limits", (), {"user_agent": "ecosystem-fixture"})()

    def fetch(self, url, *, allowed_domains, **_kwargs):
        if not allowed_domains:
            raise FetchError("no admitted domain", code="NO_DOMAIN", url=url)
        if url.endswith(".pdf"):
            writer = PdfWriter()
            writer.add_blank_page(width=72, height=72)
            output = io.BytesIO()
            writer.write(output)
            body = output.getvalue()
            content_type = "application/pdf"
        elif url.endswith(".json") or "scorecard" in url or "nces" in url:
            body = json.dumps({"dataset": "bounded-smoke", "tuition": 100}).encode()
            content_type = "application/json"
        else:
            body = b"<html><title>Bounded smoke</title><body>tuition</body></html>"
            content_type = "text/html; charset=utf-8"
        return FetchResult(
            requested_url=url,
            final_url=url,
            status=200,
            headers={"content-type": content_type},
            content_type=content_type,
            body=body,
            content_hash=hashlib.sha256(body).hexdigest(),
            retrieved_at="2026-09-09T00:00:00+00:00",
        )


class _ExpansionRobustnessTests(unittest.TestCase):
    def test_catalogue_providers_are_available_to_decision_bridge(self):
        """Catalogue loading must feed both registry and configured decisions."""
        ecosystem = SourceEcosystemConfig.from_dict({
            "enabled": True,
            "runtime_acquisition_enabled": True,
            "acquisition_mode": "external_source_expansion",
            "external_provider_catalogue": str(
                Path(__file__).parents[1] / "configs" / "external-providers.json"
            ),
            "external_provider_ids": ["eurostat_education"],
            "government_datasets": {"enabled": True},
            "field_groups": ["programme_identity"],
        })
        seed = InstitutionSeed(
            institution_id="eth-zurich-ch",
            name="ETH Zurich",
            country_code="CH",
            official_domain="ethz.ch",
            homepage_url="https://ethz.ch/",
            external_source_rules=(ExternalSourceRule(
                domain="ec.europa.eu",
                adapter_id="government_dataset",
                reason="bounded test provider admission",
                relationship=SourceRelationship.GOVERNMENT,
                authority=SourceAuthority.GOVERNMENT,
                provider_id="eurostat_education",
            ),),
        )
        backend = AcquisitionPlatformBackend(
            _Discovery(),
            mode="platform_shadow",
            source_ecosystem=ecosystem,
            fetcher=_Fetcher(),
            raw_evidence_store=InMemoryRawEvidenceStore(),
            acquisition_run_id="catalogue-provider-bridge",
        )
        self.assertIn("eurostat_education", {
            provider.provider_id for provider in backend.source_ecosystem.external_providers
        })
        decisions = backend.configured_source_decisions(seed, _Robots())
        self.assertTrue(decisions)
        self.assertTrue(any(decision.admitted for _, decision in decisions))

    def test_configured_registry_discovers_and_persists_external_sources(self):
        config = SmokeConfig.load(CONFIG_PATH)
        seed = config.institutions[0]
        backend = AcquisitionPlatformBackend(
            _Discovery(),
            mode="platform_shadow",
            source_ecosystem=config.source_ecosystem,
            fetcher=_Fetcher(),
            raw_evidence_store=InMemoryRawEvidenceStore(),
            acquisition_run_id="ecosystem-smoke",
        )
        self.assertEqual(
            set(backend.registry.adapter_ids),
            {
                "official_catalogue",
                "manual_source",
                "pdf_document",
                "json_api",
                "ipeds",
                "college_scorecard",
            },
        )
        decisions = backend.configured_source_decisions(seed, _Robots())
        admitted = [
            (intent, decision)
            for intent, decision in decisions
            if decision.admitted
        ]
        self.assertGreaterEqual(len(admitted), 5)
        classes = {decision.candidate.source_class for _, decision in admitted}
        self.assertTrue({"official_finance", "official_web", "pdf", "official_api", "government_dataset"}.issubset(classes))

        store = backend.raw_evidence_store
        assert store is not None
        persisted = []
        selected = [
            next(pair for pair in admitted if pair[1].candidate.source_class == source_class)
            for source_class in ("official_finance", "pdf", "official_api")
        ]
        selected.extend(
            next(
                pair
                for pair in admitted
                if pair[1].candidate.adapter_id == adapter_id
            )
            for adapter_id in ("ipeds", "college_scorecard")
        )
        for intent, decision in selected[: config.source_ecosystem.max_fetches_per_institution]:
            candidate = decision.candidate
            document, attempt = backend_fetch(
                candidate=candidate,
                decision=decision,
                fetcher=_Fetcher(),
                raw_store=store,
                robots_policy=_Robots(),
                intent_id=intent.intent_id,
            )
            self.assertEqual(attempt.status, "RAW_PERSISTED")
            self.assertIsNotNone(document)
            assert document is not None
            persisted.append(document)
            self.assertEqual(document.source_class, candidate.source_class)
            self.assertEqual(document.adapter_id, candidate.adapter_id)
            self.assertEqual(document.provider_id, candidate.provider_id)
            self.assertEqual(document.dataset_id, candidate.dataset_id)
            self.assertEqual(document.source_authority, candidate.declared_authority)
            self.assertEqual(document.source_relationship, candidate.relationship)
        self.assertEqual(len(persisted), 5)
        government = [
            item for item in persisted if item.source_authority == SourceAuthority.GOVERNMENT
        ]
        self.assertEqual({item.adapter_id for item in government}, {"ipeds", "college_scorecard"})
        self.assertTrue(
            all(item.source_relationship == SourceRelationship.GOVERNMENT for item in government)
        )
        ipeds_decision = next(
            decision for _, decision in admitted if decision.candidate.adapter_id == "ipeds"
        )
        self.assertEqual(
            ipeds_decision.candidate.adapter_metadata.get("mapped_institution_id"),
            seed.institution_id,
        )

        # The configured runtime path itself may fetch into a local smoke store
        # without changing the helper's remote-retention contract.
        runtime_store = InMemoryRawEvidenceStore()
        runtime_backend = AcquisitionPlatformBackend(
            _Discovery(),
            mode="platform_shadow",
            source_ecosystem=config.source_ecosystem,
            fetcher=_Fetcher(),
            raw_evidence_store=runtime_store,
            acquisition_run_id="ecosystem-runtime-smoke",
        )
        intent = AcquisitionIntent.create(
            entity=EntityRef("UNIVERSITY", seed.institution_id),
            field_groups=("tuition",),
            reason="runtime-smoke",
            preferred_source_classes=("government_dataset",),
            target_cycle="2024-25",
        )
        decisions, attempts = runtime_backend.acquire_intent(
            intent,
            SourceAdapterContext(
                entity=intent.entity,
                seed=seed,
                target_cycle=intent.target_cycle,
                field_groups=intent.field_groups,
                configuration=runtime_backend._context_configuration(
                    seed=seed, policy=_Robots()
                ),
            ),
            fetch_admitted=True,
            max_fetches=1,
        )
        self.assertTrue(any(decision.admitted for decision in decisions))
        runtime_attempt = next(item for item in attempts if item.status == "RAW_PERSISTED")
        runtime_document = runtime_store.get_snapshot(runtime_attempt.raw_document_id or "")
        self.assertIsNotNone(runtime_document)
        assert runtime_document is not None
        self.assertEqual(runtime_document.source_class, "government_dataset")
        self.assertEqual(runtime_document.adapter_id, "ipeds")

    def test_fixture_only_search_and_archive_are_not_runtime_defaults(self):
        config = SmokeConfig.load(CONFIG_PATH)
        self.assertEqual(
            set(build_source_registry(config, discovery=_Discovery()).adapter_ids),
            set(AcquisitionPlatformBackend(
                _Discovery(), mode="platform_shadow", source_ecosystem=config.source_ecosystem
            ).registry.adapter_ids),
        )
        backend = AcquisitionPlatformBackend(
            _Discovery(), mode="platform_shadow", source_ecosystem=config.source_ecosystem
        )
        self.assertNotIn("search_index", backend.registry.adapter_ids)
        self.assertNotIn("fixture_archive", backend.registry.adapter_ids)

        catalogue_only = SourceEcosystemConfig.from_dict({
            "enabled": True,
            "official_web": {"enabled": False},
            "official_catalogue": {
                "enabled": True,
                "resources": [{"url": "https://catalogue.example.edu/programme"}],
            },
        })
        self.assertIn(
            "manual_source",
            build_source_registry(catalogue_only).adapter_ids,
        )

    def test_pipeline_bridge_uses_admitted_candidate_metadata(self):
        config = SmokeConfig.load(CONFIG_PATH)
        with TemporaryDirectory() as temporary:
            pipeline = SmokePipeline(
                config,
                Path(temporary) / "run",
                allow_unreviewed_terms=True,
                discovery_only=False,
                raw_evidence_store=InMemoryRawEvidenceStore(),
            )
            try:
                pipeline.fetcher = _Fetcher()
                pipeline._acquire_configured_source_ecosystem(
                    config.institutions[0], _Robots()
                )
                rows = [
                    json.loads(line)
                    for line in (Path(temporary) / "run" / "sources.jsonl").read_text(
                        encoding="utf-8"
                    ).splitlines()
                ]
                self.assertEqual(len(rows), 6)
                self.assertTrue(
                    any(
                        row["source_class"] == "government_dataset"
                        and row["adapter_id"] == "ipeds"
                        and row["source_authority"] == "GOVERNMENT"
                        and row["source_relationship"] == "GOVERNMENT"
                        for row in rows
                    )
                )
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()


def backend_fetch(**kwargs):
    # Keep the acceptance test's write path identical to the existing source
    # adapter contract while allowing local-only bounded smoke retention.
    from glowbal_ingestion.source_adapters import persist_admitted_fetch

    return persist_admitted_fetch(require_remote_durability=False, **kwargs)


if __name__ == "__main__":
    unittest.main()
