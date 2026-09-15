"""Bounded no-LLM live validation for one configured external provider.

This diagnostic intentionally calls only the configured acquisition bridge. It
does not run the programme crawler, extraction provider, estimator, or import.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from glowbal_ingestion.config import SmokeConfig
from glowbal_ingestion.pipeline import SmokePipeline
from glowbal_ingestion.policy import check_policy


class RecordingFetcher:
    def __init__(self, delegate):
        self.delegate = delegate
        self.limits = delegate.limits
        self.calls: list[dict[str, object]] = []

    def fetch(self, url, *, allowed_domains, **kwargs):
        self.calls.append({
            "url": url,
            "allowed_domains": list(allowed_domains),
            "method": kwargs.get("method", "GET"),
        })
        return self.delegate.fetch(url, allowed_domains=allowed_domains, **kwargs)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--run-dir", type=Path, required=True)
    args = parser.parse_args()

    config = SmokeConfig.load(args.config)
    seed = config.institutions[0]
    provider = next(
        item for item in config.source_ecosystem.external_providers
        if item.provider_id == "openalex"
    )
    # One real provider resource is enough to prove the production raw path;
    # keep this validation bounded and leave the other configured classes for a
    # separately authorized experiment.
    live_ecosystem = replace(
        config.source_ecosystem,
        external_providers=(provider,),
        max_fetches_per_institution=1,
        required_source_classes=("external_authoritative",),
    )
    live_config = replace(config, source_ecosystem=live_ecosystem)
    pipeline = SmokePipeline(
        live_config,
        args.run_dir,
        allow_unreviewed_terms=True,
        discovery_only=False,
        skip_school_profile=True,
    )
    recorder = RecordingFetcher(pipeline.fetcher)
    pipeline.fetcher = recorder
    pipeline.discovery.fetcher = recorder
    policy = check_policy(seed, recorder, allow_unreviewed_terms=True)
    try:
        pipeline._acquire_configured_source_ecosystem(seed, policy)
        sources = [
            json.loads(line)
            for line in (args.run_dir / "sources.jsonl").read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        attempts = [
            json.loads(line)
            for line in (args.run_dir / "acquisition_attempts.jsonl").read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        result = {
            "provider_id": provider.provider_id,
            "source_class": provider.source_class,
            "requests": recorder.calls,
            "sources": sources,
            "attempts": attempts,
            "source_class_coverage": pipeline.discovery.source_class_coverage(),
            "metrics": pipeline.metrics.to_dict(),
            "policy": policy.check.to_dict(),
            "llm_calls": 0,
        }
        output = args.run_dir / "external-live-validation.json"
        output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(json.dumps({
            "output": str(output),
            "requests": len(recorder.calls),
            "source_rows": len(sources),
            "attempt_statuses": [item.get("status") for item in attempts],
            "source_provenance": [
                {
                    key: item.get(key)
                    for key in (
                        "canonical_url", "source_class", "adapter_id", "provider_id",
                        "dataset_id", "source_authority", "source_relationship",
                        "temporal_state", "academic_cycle", "content_type", "http_status",
                    )
                }
                for item in sources
            ],
            "llm_calls": 0,
        }, indent=2))
    finally:
        pipeline.state.close()
        pipeline.llm_state.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
