"""Build the source-research and bounded-refresh report from retained artifacts."""
from __future__ import annotations

import collections
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
RUN = ROOT / "runs" / "field-bearing-refresh-20260912"
ANALYSIS = ROOT / "analysis"


def jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def present(row: dict) -> bool:
    return row.get("value_json") not in (None, "", [], {}) and row.get("null_reason") is None


def accepted(row: dict) -> bool:
    return present(row) and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"} and row.get("epistemic_state") == "OBSERVED"


def source_maps(sources: list[dict]):
    by_hash = {s.get("content_hash"): s for s in sources if s.get("content_hash")}
    by_raw = {s.get("raw_document_id"): s for s in sources if s.get("raw_document_id")}
    by_url = {s.get("url"): s for s in sources if s.get("url")}
    def source(row: dict) -> dict:
        return by_hash.get(row.get("source_content_hash")) or by_raw.get(row.get("raw_document_id")) or by_url.get(row.get("source_url")) or {}
    return source


def pct(n: int, d: int) -> str:
    return f"{(100.0*n/d):.1f}%" if d else "0.0%"


def main() -> None:
    ledger = json.loads((ROOT / "source-research-ledger.json").read_text(encoding="utf-8"))
    config = json.loads((ROOT / "population-config.json").read_text(encoding="utf-8"))
    manifest = json.loads((RUN / "manifest.json").read_text(encoding="utf-8"))
    coverage = json.loads((RUN / "coverage_report.json").read_text(encoding="utf-8"))
    sources = jsonl(RUN / "sources.jsonl")
    effective = jsonl(RUN / "effective_field_assertions.jsonl")
    attempts = jsonl(RUN / "acquisition_attempts.jsonl")
    source_for = source_maps(sources)
    effective_present = [r for r in effective if present(r)]
    effective_accepted = [r for r in effective if accepted(r)]
    provider_ids = {item.get("source_id") for item in ledger["verified_sources"]}
    configured_resources = config["source_ecosystem"]["official_web"]["resources"]
    configured_by_provider = {r.get("provider_id"): r for r in configured_resources if r.get("provider_id")}
    persisted = collections.Counter(s.get("provider_id") for s in sources if s.get("provider_id"))
    accepted_by_provider = collections.Counter(source_for(r).get("provider_id") or "UNATTRIBUTED" for r in effective_accepted)
    useful_by_provider = collections.Counter(source_for(r).get("provider_id") or "UNATTRIBUTED" for r in effective_present)
    attempt_states = collections.defaultdict(collections.Counter)
    for row in attempts:
        if row.get("provider_id") in provider_ids:
            attempt_states[row.get("provider_id")][row.get("status") or row.get("execution_state") or "UNKNOWN"] += 1

    # Existing authoritative refresh is the before comparison.
    old_run = ROOT.parent / "field-aware-authoritative-refresh-20260912" / "runs" / "authoritative-refresh-20260912"
    old = jsonl(old_run / "effective_field_assertions.jsonl") if (old_run / "effective_field_assertions.jsonl").exists() else []
    old_present = [r for r in old if present(r)]
    old_accepted = [r for r in old if accepted(r)]
    field_names = sorted(set(r.get("field_name") for r in effective + old if r.get("field_name")))
    field_summary = {}
    for field in field_names:
        now = [r for r in effective if r.get("field_name") == field]
        before = [r for r in old if r.get("field_name") == field]
        field_summary[field] = {
            "before_retained_non_null": sum(present(r) for r in before),
            "after_retained_non_null": sum(present(r) for r in now),
            "before_accepted": sum(accepted(r) for r in before),
            "after_accepted": sum(accepted(r) for r in now),
            "after_accepted_scopes": dict(collections.Counter((r.get("scope") or "UNKNOWN") for r in now if accepted(r))),
        }

    hierarchy = json.loads((ANALYSIS / "hierarchical-evaluation.json").read_text(encoding="utf-8"))
    h_summary = {}
    for pool in ("accepted_only", "all_non_rejected"):
        h_summary[pool] = {}
        for field, row in hierarchy[pool]["fields"].items():
            h_summary[pool][field] = {
                "direct_count": row["direct_count"],
                "target_count": row["target_count"],
                "activated_by_level": row["activated_by_level"],
                "missing_target_activated": row["missing_target_activated"],
                "missing_target_abstentions": row["missing_target_abstentions"],
                "support_counts": row["support_counts"],
                "mean_support_count": row["mean_support_count"],
                "donor_dispersion": row["donor_dispersion"],
                "uncertainty_by_level": row["uncertainty_by_level"],
                "conflict_rate": row["conflict_rate"],
            }

    result = {
        "schema": "FieldBearingSourceRefreshReport/v1",
        "research_ledger": "docs/architecture/data/field-bearing-source-refresh-20260912/source-research-ledger.json",
        "run_id": manifest.get("run_name"),
        "population": {
            "institutions": len(manifest.get("institutions", [])),
            "programmes": coverage.get("metrics", {}).get("programmes_discovered"),
            "institution_ids": [row.get("institution_id") for row in manifest.get("institutions", [])],
            "countries": sorted({row.get("country_code") for row in manifest.get("institutions", [])}),
        },
        "research": {
            "verified_sources": len(ledger["verified_sources"]),
            "rejected_sources": len(ledger["rejected_sources"]),
            "existing_verified_not_extended": len(ledger["existing_verified_but_not_extended"]),
            "explicit_gaps": ledger["no_verified_field_bearing_source_found"],
        },
        "implementation": {
            "new_adapters": [],
            "reused_adapters": ["manual_source"],
            "configured_resources": len(configured_resources),
            "verified_resources_configured": len(provider_ids & set(configured_by_provider)),
            "external_provider_sets_enabled": {
                key: bool(config["source_ecosystem"].get(key, {}).get("enabled", False))
                for key in ("government_datasets", "official_registries", "accreditation", "official_partners", "external_authoritative")
            },
        },
        "runtime": {
            "sources_fetched": coverage.get("metrics", {}).get("sources_fetched"),
            "source_rows": len(sources),
            "verified_resources_persisted": dict(sorted(persisted.items())),
            "verified_resources_not_persisted": sorted(provider_ids - set(persisted)),
            "verified_attempt_states": {k: dict(v) for k, v in sorted(attempt_states.items())},
            "effective_non_null": len(effective_present),
            "accepted_native_observed": len(effective_accepted),
            "needs_review_non_null": sum(r.get("verification_status") == "NEEDS_REVIEW" for r in effective_present),
            "accepted_by_field": dict(collections.Counter(r.get("field_name") for r in effective_accepted)),
            "accepted_by_scope": dict(collections.Counter(r.get("scope") or "UNKNOWN" for r in effective_accepted)),
            "accepted_by_source_provider": dict(sorted(accepted_by_provider.items())),
            "useful_by_source_provider": dict(sorted(useful_by_provider.items())),
        },
        "field_before_after": field_summary,
        "hierarchy": h_summary,
        "old_run": {"retained_non_null": len(old_present), "accepted_native_observed": len(old_accepted)},
        "llm": {
            "calls": coverage.get("metrics", {}).get("provider_stats", {}).get("calls"),
            "failures": coverage.get("metrics", {}).get("provider_stats", {}).get("failures"),
            "provider": manifest.get("extraction_provider"),
        },
    }
    ANALYSIS.mkdir(exist_ok=True)
    (ANALYSIS / "refresh-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines: list[str] = []
    lines.extend([
        "# Field-bearing source research and bounded refresh",
        "",
        "This report records a direct web-research pass followed by one bounded refresh over the frozen six-institution/12-programme population. Only sources whose pages were opened and whose field-bearing content was verified were added. The existing acquisition, evidence-resolution, semantic-acceptance, hierarchy, uncertainty, storage, promotion, and benchmark rails were not changed.",
        "",
        "## Research result",
        "",
        f"The ledger verified **{len(ledger['verified_sources'])}** field-bearing resources and rejected/deferred **{len(ledger['rejected_sources'])}**. Four previously verified resources were retained without duplication. The machine-readable record is [`source-research-ledger.json`](source-research-ledger.json).",
        "",
        "| Institution | Verified source | Exact fields observed | Scope / identifiers |",
        "|---|---|---|---|",
    ])
    for item in ledger["verified_sources"]:
        fields = ", ".join(f"`{f}`" for f in item["exact_fields"])
        ident = item.get("identifiers", "")
        lines.append(f"| {item['institution_id']} | [{item['source']}]({item['url']}) | {fields} | {item['scope']}; {ident} |")
    lines.extend([
        "",
        "Cycle, audience, currency/basis and machine-readable details for every row are in the ledger. Examples with explicit current fields include MIT's 2026–27 undergraduate cost page (tuition and student-life fee), Cornell's MPS AEM finance page (tuition and mandatory fees), ETH's ESOP page (CHF 13,500 per semester), UNSW's 2026 programme page (fees, terms and English/entry information), and NTU's MSDS page (S$ fee table, application fee, language thresholds and funding notes).",
        "",
        "## Rejected or not added",
        "",
    ])
    for item in ledger["rejected_sources"]:
        lines.append(f"- [{item['source']}]({item['url']}) — {item['reason']}")
    lines.extend(["", "Explicit no-source findings:"])
    for item in ledger["no_verified_field_bearing_source_found"]:
        lines.append(f"- `{item['field']}` for {', '.join(item['institutions'])}: {item['note']}")
    lines.extend([
        "",
        "## Implementation",
        "",
        "The refresh configuration is [`population-config.json`](population-config.json). It clones the frozen population and appends the verified resources as ordinary bounded `official_web`, `official_finance`, `central_admissions`, or `international_admissions` entries. Each entry carries provider/dataset identity, field groups, resolution, cycle/audience/basis when explicit, and a programme ID only for a deterministic programme match. The existing `manual_source` adapter and normal provenance path were reused; no new adapter or provider-specific core code was required. Existing verified MIT graduate, ETH, Sorbonne, UNSW and NTU resources remain configured once. External government/registry/accreditation providers were not enabled in this field-bearing run because they were not verified as field-bearing for these 12 targets.",
        "",
        "## Bounded refresh",
        "",
        f"The run attempted {result['population']['institutions']} institutions and {result['population']['programmes']} programmes across {', '.join(result['population']['countries'])}. It fetched {result['runtime']['sources_fetched']} sources. Nine of the 14 newly verified resources were persisted; five were either blocked by the existing robots/domain policy or admitted but not selected within the bounded per-programme source limit. The run made {result['llm']['calls']} DeepSeek extraction calls with {result['llm']['failures']} provider failures.",
        "",
        "| Verified provider resource | Runtime status | Effective non-null fields | Accepted OBSERVED fields |",
        "|---|---|---|---|",
    ])
    for item in ledger["verified_sources"]:
        pid = item["provider_id"]
        statuses = ", ".join(f"{k}:{v}" for k, v in sorted(attempt_states.get(pid, {}).items())) or ("RAW_PERSISTED" if persisted.get(pid) else "not selected")
        lines.append(f"| `{pid}` | {statuses} | {', '.join(f'{k} ({v})' for k,v in sorted({field:count for field,count in collections.Counter(r.get('field_name') for r in effective_present if source_for(r).get('provider_id') == pid).items()}.items())) or 'none'} | {', '.join(f'{k} ({v})' for k,v in sorted({field:count for field,count in collections.Counter(r.get('field_name') for r in effective_accepted if source_for(r).get('provider_id') == pid).items()}.items())) or 'none'} |")
    lines.extend([
        "",
        "New verified resources contributed 30 non-null effective assertions and seven newly accepted native observations. The accepted additions were scholarships (3), minimum degree (1), application fee (1), programme identity (1), and programme status (1); no newly verified resource produced an accepted tuition value in this run. Most accepted values still came from the previously configured official pages. The source-to-assertion attribution above is a join on retained content hash/raw document/URL; the extractor's own provider identifier remains the LLM adapter, while source provider identity is retained on `sources.jsonl`.",
        "",
        "### Before versus after retained field values",
        "",
        "| Field | Before retained | After retained | Before accepted | After accepted |",
        "|---|---:|---:|---:|---:|",
    ])
    for field in sorted(field_summary):
        row = field_summary[field]
        lines.append(f"| `{field}` | {row['before_retained_non_null']} | {row['after_retained_non_null']} | {row['before_accepted']} | {row['after_accepted']} |")
    lines.extend([
        "",
        "Current accepted native observations are 94 (43 programme-scoped, 51 institution-scoped); 142 non-null rows remain `NEEDS_REVIEW`. The accepted field counts are in [`refresh-results.json`](analysis/refresh-results.json).",
        "",
        "## H1–H4 evaluation",
        "",
        "The existing engine was run unchanged against the accepted-only pool and, separately, against all non-rejected observations as a diagnostic. The accepted-only tuition result is **0/12 direct**, H1 **0**, H2 **0**, H3 **0**, H4 **0**, with **12/12 hierarchical abstentions**. The diagnostic all-non-rejected pool has 6/12 direct tuition rows, one H2 activation, no H1/H3/H4 activation, and five abstentions among six targets lacking direct evidence. That one H2 candidate is a review-status observation and is not a usable accepted donor. No independent tuition donor exists. Across non-tuition fields, accepted H2 activations occur for intakes (1), minimum degree (2), scholarships (5), standardized tests (3), and subject prerequisites (1); there are no parent-unit records in this run, so H1 is not measurable, and no verified peer attributes exist for H4.",
        "",
        "For the one diagnostic tuition H2 estimate, support count is 1, dispersion is 0, and the existing heuristic combined uncertainty is 0.1567. Tuition support/dispersion/uncertainty are otherwise not measurable on the accepted pool. No accuracy or calibration claim is made because this refresh has no independent held-out truth set.",
        "",
        "## Remaining gaps",
        "",
        "- Tuition is accepted only at institution scope (five observations) and has no accepted programme-level value in this run; no independent H3 or H4 tuition donor was verified.",
        "- Additional fees have one accepted institution-level observation; programme-specific mandatory fees remain sparse.",
        "- Current accepted deadline values remain sparse (intakes are present; funding/rolling deadlines are not); MIT language pages were rejected by the existing domain policy because `mitadmissions.org` is not in the seed's approved domains, and Cornell graduate pages were blocked by robots.",
        "- Numeric IELTS/TOEFL and GPA coverage is incomplete in this run. ETH and Sorbonne sources expose qualitative language/degree requirements, while the researched numeric sources were not all selected or accepted by the current schema/field mapping.",
        "- Scholarship observations increased substantially, but many retain award-specific eligibility/amount context requiring review; they are not tuition donors.",
        "- The next bounded input work should narrowly admit verified official admissions domains/resources and target the unselected NTU/Sorbonne/MIT pages, then add a source-specific table/fee mapping only where the retained evidence demonstrably contains the verified value. No generic external provider expansion is justified by this run.",
        "",
        "## Artifacts",
        "",
        "- [`source-research-ledger.json`](source-research-ledger.json)",
        "- [`source-research-report.md`](source-research-report.md)",
        "- [`population-config.json`](population-config.json)",
        "- [`population-manifest.json`](population-manifest.json)",
        "- [`runs/field-bearing-refresh-20260912`](runs/field-bearing-refresh-20260912)",
        "- [`analysis/refresh-results.json`](analysis/refresh-results.json)",
        "- [`analysis/hierarchical-evaluation.json`](analysis/hierarchical-evaluation.json)",
    ])
    (ROOT / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
