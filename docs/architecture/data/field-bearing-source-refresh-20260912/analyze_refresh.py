"""Deterministic analysis for the 2026-09-12 field-bearing refresh."""
from __future__ import annotations

import collections
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent / "runs" / "field-bearing-refresh-20260912"


def read_jsonl(name: str) -> list[dict]:
    path = ROOT / name
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def value_present(row: dict) -> bool:
    value = row.get("value_json")
    return value not in (None, "", [], {})


def main() -> None:
    sources = read_jsonl("sources.jsonl")
    assertions = read_jsonl("field_assertions.jsonl")
    effective = read_jsonl("effective_field_assertions.jsonl")
    decisions = read_jsonl("semantic_acceptance_decisions.jsonl")
    source_by_url = {}
    source_by_hash = {}
    for source in sources:
        for key in (source.get("url"), source.get("canonical_url")):
            if key:
                source_by_url[key] = source
        if source.get("content_hash"):
            source_by_hash[source["content_hash"]] = source

    print("SOURCES", len(sources))
    print("SOURCE_PROVIDER", collections.Counter(source.get("provider_id") or "NONE" for source in sources))
    print("SOURCE_CLASS", collections.Counter(source.get("source_class") or "NONE" for source in sources))
    print("FIELD_ASSERTIONS", len(assertions), "NON_NULL", sum(value_present(r) for r in assertions))
    print("EFFECTIVE", len(effective), "NON_NULL", sum(value_present(r) for r in effective))
    print("EFFECTIVE_STATUS", collections.Counter(r.get("verification_status") for r in effective))
    print("EFFECTIVE_NON_NULL_STATUS", collections.Counter(r.get("verification_status") for r in effective if value_present(r)))
    print("DECISIONS", len(decisions), collections.Counter(r.get("classification") for r in decisions))
    print("DECISION_REASONS", collections.Counter(reason for row in decisions for reason in row.get("reasons", [])))
    print("EFFECTIVE_FIELDS", collections.Counter(r.get("field_name") for r in effective if value_present(r)))
    print("EFFECTIVE_SCOPES", collections.Counter(r.get("scope") for r in effective if value_present(r)))
    print("EFFECTIVE_REL", collections.Counter(r.get("source_relationship") for r in effective if value_present(r)))

    # Join assertions to source rows by raw document or URL. This is needed because
    # extractor provider_id identifies the LLM adapter, while source provider_id is
    # retained on the source row.
    joined = []
    for row in effective:
        source = source_by_hash.get(row.get("source_content_hash")) or source_by_url.get(row.get("source_url"))
        joined.append((row, source or {}))
    useful = [(row, source) for row, source in joined if value_present(row)]
    print("USEFUL_BY_SOURCE_PROVIDER", collections.Counter(source.get("provider_id") or "NONE" for _, source in useful))
    print("USEFUL_BY_SOURCE_CLASS", collections.Counter(source.get("source_class") or "NONE" for _, source in useful))
    print("USEFUL_FIELDS_BY_PROVIDER")
    by_provider = collections.defaultdict(collections.Counter)
    for row, source in useful:
        by_provider[source.get("provider_id") or "NONE"][row.get("field_name")] += 1
    for provider, fields in sorted(by_provider.items()):
        print(provider, dict(fields))
    print("USEFUL_FIELDS_BY_SCOPE")
    by_scope = collections.defaultdict(collections.Counter)
    for row, source in useful:
        by_scope[row.get("scope") or "UNKNOWN"][row.get("field_name")] += 1
    for scope, fields in sorted(by_scope.items()):
        print(scope, dict(fields))

    # New verified resources are those explicitly named in the research ledger.
    ledger = json.loads((Path(__file__).resolve().parent / "source-research-ledger.json").read_text(encoding="utf-8"))
    verified = ledger.get("verified_sources", ledger.get("verified", []))
    ids = {item.get("source_id") for item in verified}
    new_sources = [s for s in sources if s.get("provider_id") in ids]
    print("VERIFIED_LEDGER_IDS", len(ids), "NEW_SOURCE_ROWS", len(new_sources))
    print("NEW_SOURCE_PROVIDERS", collections.Counter(s.get("provider_id") for s in new_sources))
    new_useful = [(row, source) for row, source in useful if source.get("provider_id") in ids]
    print("NEW_USEFUL", len(new_useful), "FIELDS", collections.Counter(row.get("field_name") for row, _ in new_useful))
    print("NEW_USEFUL_BY_PROVIDER", collections.Counter(source.get("provider_id") for _, source in new_useful))
    new_accepted = [(row, source) for row, source in new_useful if value_present(row) and row.get("null_reason") is None and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"} and row.get("epistemic_state") == "OBSERVED"]
    print("NEW_ACCEPTED", len(new_accepted), "FIELDS", collections.Counter(row.get("field_name") for row, _ in new_accepted))
    print("NEW_ACCEPTED_BY_PROVIDER", collections.Counter(source.get("provider_id") for _, source in new_accepted))

    # Previous authoritative refresh comparison.
    old_root = Path(__file__).resolve().parents[1] / "field-aware-authoritative-refresh-20260912" / "runs" / "authoritative-refresh-20260912"
    old_path = old_root / "effective_field_assertions.jsonl"
    if old_path.exists():
        old = [json.loads(line) for line in old_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        old_non_null = [r for r in old if value_present(r)]
        print("OLD_EFFECTIVE", len(old), "NON_NULL", len(old_non_null))
        print("OLD_FIELDS", collections.Counter(r.get("field_name") for r in old_non_null))
        print("OLD_STATUS_NON_NULL", collections.Counter(r.get("verification_status") for r in old_non_null))

    # Field-level before/after counts for the report. “Accepted” follows the
    # existing semantic acceptance contract: native OBSERVED plus validated
    # verification status. “Retained” counts non-null effective assertions,
    # including NEEDS_REVIEW, so the two views are not conflated.
    baseline = []
    if old_path.exists():
        baseline = [json.loads(line) for line in old_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    def accepted(row: dict) -> bool:
        return value_present(row) and row.get("null_reason") is None and row.get("epistemic_state") == "OBSERVED" and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
    field_names = sorted(set(r.get("field_name") for r in baseline + effective if r.get("field_name")))
    field_summary = {}
    for field in field_names:
        old_rows = [r for r in baseline if r.get("field_name") == field]
        new_rows = [r for r in effective if r.get("field_name") == field]
        field_summary[field] = {
            "before_retained_non_null": sum(value_present(r) for r in old_rows),
            "after_retained_non_null": sum(value_present(r) for r in new_rows),
            "before_accepted": sum(accepted(r) for r in old_rows),
            "after_accepted": sum(accepted(r) for r in new_rows),
            "after_accepted_scopes": dict(collections.Counter((r.get("scope") or "UNKNOWN") for r in new_rows if accepted(r))),
        }
    out = Path(__file__).resolve().parent / "analysis"
    out.mkdir(exist_ok=True)
    (out / "field-coverage-before-after.json").write_text(json.dumps(field_summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
