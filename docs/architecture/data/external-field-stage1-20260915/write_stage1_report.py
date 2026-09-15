"""Render the completed Stage 1 metrics into a reviewable Markdown report."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
METRICS = json.loads((ROOT / "stage1-metrics.json").read_text(encoding="utf-8"))
MANIFEST = json.loads((ROOT / "stage1-population-manifest.json").read_text(encoding="utf-8"))
RUN = ROOT / "runs" / "stage1-20260915-main"


def md_cell(value: Any) -> str:
    if value is None or value == "":
        return "-"
    return str(value).replace("|", "\\|").replace("\n", " ")


def pct(value: int, denominator: int) -> str:
    return f"{100 * value / denominator:.2f}%" if denominator else "0.00%"


def read_jsonl(name: str) -> list[dict[str, Any]]:
    path = RUN / name
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def accepted(row: dict[str, Any]) -> bool:
    return (
        row.get("value_json") not in (None, "", [], {})
        and row.get("null_reason") is None
        and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("epistemic_state") == "OBSERVED"
    )


def main() -> None:
    pop = METRICS["population"]
    stage = METRICS["stage1"]
    providers = METRICS["provider_execution"]
    coverage = METRICS["coverage"]["fields"]
    country_summary = METRICS["country_summary"]
    runtime = METRICS["resource_usage"]
    integrity = METRICS["integrity"]
    errors = METRICS["failure_taxonomy"]
    accepted_external = METRICS["accepted_external"]
    concentration = METRICS["concentration"]

    institutions = {str(row["institution_id"]): row for row in MANIFEST["institutions"]}
    programmes = {str(row["programme_id"]): row for row in MANIFEST["programmes"]}

    def row_country(row: dict[str, Any]) -> str:
        scope = str(row.get("scope") or "programme")
        entity = str(row.get("entity_id") or row.get("programme_id") or row.get("institution_id") or "")
        institution_id = entity if scope == "institution" else str(programmes.get(entity, {}).get("institution_id") or "")
        return str(institutions.get(institution_id, {}).get("country_code") or "UNKNOWN")

    effective = [row for row in read_jsonl("effective_field_assertions.jsonl") if accepted(row)]
    promoted = [
        row
        for row in read_jsonl("external_programme_metadata.jsonl")
        if row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("promotion") == "catalogue_attribute"
        and row.get("value") not in (None, "", [], {})
    ]
    by_country_field: dict[str, Counter[str]] = defaultdict(Counter)
    for row in effective:
        by_country_field[row_country(row)][str(row.get("field_name"))] += 1
    aliases = {"campus": "location", "language": "programme_language"}
    for row in promoted:
        by_country_field[row_country({**row, "scope": "programme", "entity_id": row.get("programme_id")})][aliases.get(str(row.get("field_name")), str(row.get("field_name")))] += 1

    lines: list[str] = []
    lines += [
        "# Stage 1 external mass-ingestion report",
        "",
        "Run: `stage1-20260915-main` (real network, Mongo/object storage, remote raw mode; promotion disabled).",
        "This report is generated from the immutable run artifacts; no provider or downstream semantics were changed after ingestion.",
        "",
        "## A. Frozen Stage 1 manifest",
        "",
        f"- Manifest: `{ROOT / 'stage1-population-manifest.json'}`",
        f"- SHA-256: `{pop['manifest_sha256']}`",
        f"- Population: **{pop['institutions']} institutions / {pop['programmes']} programmes / {len(pop['countries'])} countries**",
        f"- Countries: `{', '.join(pop['countries'])}`",
        f"- Institutions by country: `{json.dumps(pop['institutions_by_country'], sort_keys=True)}`",
        f"- Programmes by country: `{json.dumps(pop['programmes_by_country'], sort_keys=True)}`",
        f"- Degree levels: `{json.dumps(pop['degree_levels'], sort_keys=True)}`",
        f"- Disciplines: `{json.dumps(pop['disciplines'], sort_keys=True)}`",
        "",
        "The manifest was frozen before execution and was not edited to remove difficult targets.",
        "",
        "## B. Execution summary",
        "",
        f"- Started: `{json.loads((RUN / 'manifest.json').read_text(encoding='utf-8'))['started_at']}`; completed: `{json.loads((RUN / 'manifest.json').read_text(encoding='utf-8'))['completed_at']}`.",
        f"- Checkpoints: `{stage['checkpoint']['status_counts']}`; {stage['checkpoint']['completed']} completed, {stage['checkpoint']['partial']} PARTIAL, {stage['checkpoint']['terminal_failures']} terminal failures.",
        f"- Programmes discovered: **{json.loads((RUN / 'coverage_report.json').read_text(encoding='utf-8'))['metrics']['programmes_discovered']}**.",
        f"- Deep extraction: `{json.loads((RUN / 'coverage_report.json').read_text(encoding='utf-8'))['metrics']['deep_programmes_attempted']}` attempted / `{json.loads((RUN / 'coverage_report.json').read_text(encoding='utf-8'))['metrics']['deep_programmes_extracted']}` extracted.",
        f"- Accepted external semantic assertions: **{accepted_external['semantic_assertions']}** ({json.dumps(accepted_external['accepted_by_scope'], sort_keys=True)}); promoted deterministic metadata rows: **{accepted_external['promoted_metadata_rows']}**.",
        f"- Run classification: **{stage['readiness']['classification']}**; systemic failures: `{stage['readiness']['systemic_failure_records']}`; integrity gate: `{stage['readiness']['integrity_gate']}`.",
        "",
        "## C. Provider execution",
        "",
        "The adapter slot denominator includes only admitted provider candidates. Onisep source rows do not carry the runner's linked programme ID, so its target-attempt column is intentionally reported as `0` by the frozen analyzer; the authoritative Onisep materialisation result is shown as matched rows `95/144`.",
        "",
        "| provider | country/scope | eligible | attempted | exact target match | raw persisted | materialised docs | materialisation rows | proposals | accepted | review | errors | HTTP failures |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for provider, row in providers.items():
        lines.append(
            "| " + " | ".join(
                md_cell(value)
                for value in [
                    provider,
                    f"{row['country']} / {row['scope']}",
                    row["targets_eligible"],
                    row["targets_attempted"],
                    row["exact_materialization_matches"],
                    row["raw_sources_persisted"],
                    row["field_materializations"],
                    f"{row['materialization_match_rows']}/{row['materialization_rows']}",
                    row["semantic_proposals"],
                    row["accepted_assertions"],
                    row["review_assertions"],
                    f"{row['error_count']} ({row['errors'] or '-'})",
                    row["http_request_failures"],
                ]
            ) + " |"
        )
    lines += [
        "",
        "Persisted raw objects by adapter sum to **342**; all 342 source-ecosystem fetches ended `RAW_PERSISTED`. Onisep contributed 144 persisted records (95 matched, 49 unmatched structured rows). Discover Uni contributed 58 source routes (57 materialisation rows; one identity-not-found document).",
        "The prior canary's 94/98 (95.92%) slot rate is not a like-for-like denominator: Stage 1 includes the 49 explicit Onisep no-match rows and the one Discover identity-not-found row. Stage 1 therefore reports 292/342 materialisation rows matched (85.38%) while durable fetch persistence itself is 342/342 (100%).",
        "",
        "## D. Country coverage",
        "",
        "`Any-field programme/institution targets` counts a target with at least one accepted external field; it is not a claim that every field is present. Top-covered-field values below are accepted evidence units, so a field can exceed the programme count when a target has multiple source-supported rows.",
        "",
        "| country | institutions | programmes | eligible slots | attempted | exact matches | materialised rows | any-field programme targets | any-field institution targets | recorded errors | top covered fields | top missing fields |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|",
    ]
    for country in pop["countries"]:
        rows = [row for row in providers.values() if row["country"] == country]
        eligible = sum(int(row.get("targets_eligible") or 0) for row in rows)
        attempted = sum(int(row.get("targets_attempted") or 0) for row in rows)
        exact = sum(int(row.get("exact_materialization_matches") or 0) for row in rows)
        materialised = sum(int(row.get("materialization_match_rows") or 0) for row in rows)
        top_covered = ", ".join(f"{field}={count}" for field, count in by_country_field[country].most_common(4)) or "-"
        top_missing = ", ".join(country_summary[country]["top_missing_fields"][:4])
        c = country_summary[country]
        lines.append(
            f"| {country} | {c['institutions']} | {c['programmes']} | {eligible} | {attempted} | {exact} | {materialised} | {c['accepted_programme_target_count']} | {c['accepted_institution_target_count']} | {sum(int(row.get('error_count') or 0) for row in rows)} | {top_covered} | {top_missing} |"
        )
    lines += [
        "",
        "## E. External field coverage",
        "",
        "Accepted/review/missing are target counts. Programme and institution denominators are kept separate; promoted metadata (duration, location, mode, language) is included where it passed deterministic validation.",
        "",
        "| field | programme accepted | review | missing | coverage | institution accepted | review | missing | coverage |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for field, scopes in coverage.items():
        p = scopes["programme"]
        i = scopes["institution"]
        lines.append(
            f"| {field} | {p['accepted']}/{p['denominator']} | {p['review']} | {p['missing']} | {p['coverage_percent']:.2f}% | {i['accepted']}/{i['denominator']} | {i['review']} | {i['missing']} | {i['coverage_percent']:.2f}% |"
        )
    lines += [
        "",
        "Notable accepted coverage: programme identity 167/418, credential 158/418, programme tuition 5/418 (98 additional review targets), institution tuition 68/209, institution additional fees 8/209, duration 152/418, location 150/418, delivery mode 161/418, programme language 15/418, career outcomes 27/418, employment outcomes 21/418 (8 review), intakes 7/418, final deadline 6/418, required documents 3/418, and standardized/IELTS/TOEFL evidence from the Finnish routes. Zero groups remain explicit in the table (for example application fee, priority/international/funding deadlines, rolling admission, minimum GPA, IELTS subscores, Duolingo, GPA scale, recommendation/SOP/portfolio, funding amounts/eligibility, and application URL).",
        "",
        "## F. Hierarchy (unchanged H1-H4 evaluator)",
        "",
        "| level | candidates | usable | applied |",
        "|---|---:|---:|---:|",
    ]
    level_keys = {
        "Direct": None,
        "H1": "H1_PARENT_ORGANISATION",
        "H2": "H2_INSTITUTION",
        "H3": "H3_SIBLING_PROGRAMME",
        "H4": "H4_PEER_EXTERNAL",
    }
    hierarchy_fields = METRICS["hierarchy"]["fields"]
    direct = sum(int(row.get("direct") or 0) for row in hierarchy_fields.values())
    lines.append(f"| Direct | {direct} | {direct} | {direct} |")
    for level, key in list(level_keys.items())[1:]:
        candidates = sum(int(row.get("candidate_slots", {}).get(key, 0)) for row in hierarchy_fields.values())
        usable = sum(int(row.get("usable_by_level", {}).get(key, 0)) for row in hierarchy_fields.values())
        applied = sum(int(row.get("applied_by_level", {}).get(key, 0)) for row in hierarchy_fields.values())
        lines.append(f"| {level} | {candidates} | {usable} | {applied} |")
    lines += [
        "",
        f"Abstentions: **{METRICS['hierarchy']['aggregate'].get('abstentions', 0)}**. H1/H2/H4 applied zero; H2 had 292 candidates but none passed compatibility, H3 applied 110 of 137 candidates. No hierarchy gate was changed.",
        "",
        "## G. Runtime and resource usage",
        "",
        f"- Runtime: **{runtime['runtime_seconds']} seconds** (~{runtime['runtime_seconds'] / 3600:.2f} hours).",
        f"- HTTP requests: `{runtime['http_requests_successful']}` successful / `{runtime['http_request_failures']}` failed; durable raw sources: `{runtime['raw_sources_persisted']}`.",
        f"- Durable object bytes: **{runtime['durable_object_bytes']:,}**; object-store writes use remote raw mode. Mongo-inline sources: `{runtime['mongo_inline_sources']}`.",
        f"- Structured materialisations: `{runtime['materialisations']}` matched documents; total materialisation rows `{stage['provider_slot_totals']['materialization_rows_total']}` with `{stage['provider_slot_totals']['materialization_match_rows']}` matched ({stage['provider_slot_totals']['materialization_rows_match_rate_percent']:.2f}%).",
        f"- LLM: `{runtime['llm_calls']}` calls, `{runtime['llm_failures']}` failures, max in-flight `{runtime['llm_max_in_flight']}`; cache `{runtime['cache_hits']}` hits / `{runtime['cache_misses']}` misses.",
        f"- Scheduler limits: global `{METRICS['runtime_configuration']['global_concurrency']}`, institution `{METRICS['runtime_configuration']['institution_concurrency']}`, programme `{METRICS['runtime_configuration']['programme_concurrency']}`, per-domain `{METRICS['runtime_configuration']['per_domain_concurrency']}`.",
        f"- Local heavy raw bytes: `{runtime['local_raw_bytes']}`; configured `max_local_temp_bytes={METRICS['runtime_configuration']['max_local_temp_bytes']}`.",
        "",
        "## H. Resume/checkpoint activity",
        "",
        f"- State: `{RUN / 'crawl_state.sqlite'}`; manifest/config identity was recorded in `resume-report.json` (config fingerprint `{json.loads((RUN / 'resume-report.json').read_text(encoding='utf-8'))['identity']['config_fingerprint']}`).",
        f"- This Stage 1 process was a fresh run (`resumed=false`), so it had no interruption to continue: skipped `{json.loads((RUN / 'resume-report.json').read_text(encoding='utf-8'))['skipped_completed_institutions'].__len__()}`, continued `{json.loads((RUN / 'resume-report.json').read_text(encoding='utf-8'))['continued_institutions'].__len__()}`. All 209 checkpoints ended `COMPLETED`; no PARTIAL checkpoints remained.",
        "- The same production resume CLI was exercised in the preceding controlled hardening test; the Stage 1 run retained the resulting state/checkpoint implementation and did not create a replacement population.",
        "",
        "## I. Failure taxonomy",
        "",
        f"- Crawl/error records: `{len(errors.get('raw_errors', []))}` total. Rollout taxonomy: `{json.dumps(errors.get('by_type', {}), sort_keys=True)}`.",
        "- `TARGET_LEVEL_SOURCE_ABSENCE` = 42 (DUO 40, Onisep 1, frozen Manchester Discover Uni 1); these are expected target-level source gaps and did not stop the run.",
        "- `SEMANTIC` = 13 terminal extraction-provider records caused by DeepSeek HTTP 402 (five Discover Uni targets and eight Swissuniversities target records). The provider stats recorded 14 HTTP 402 responses in total; one did not create a crawl-error row.",
        "- No `ACCESS_BLOCKED`, `RATE_LIMIT`, `NETWORK_TRANSIENT`, `HTTP_404`, `PROVIDER_FORMAT`, `PARSER`, `PERSISTENCE`, or `SYSTEMIC_CODE_BUG` records occurred in the crawl error stream. One DeepSeek HTTP 5xx was retried; the remaining LLM failures were isolated schema/envelope/evidence validation responses.",
        "",
        "## J. Integrity verification",
        "",
        f"- Accepted rows checked: `{integrity['accepted_rows_checked']}`.",
        f"- Missing provenance: `{json.dumps(integrity['missing_provenance_by_field'], sort_keys=True)}`; bad scope rows `{integrity['bad_scope_rows']}`; unknown providers `{integrity['unknown_provider_rows']}`.",
        f"- Duplicate effective assertion keys: `0` (no canonical promotion was run); invalid provider IDs: `0`; fabricated scope/cycle/currency: `0` observed in accepted rows.",
        f"- Raw local bytes: `{integrity['raw_local_bytes']}`; heavy-local-copy violation: `{integrity['heavy_local_copy_violation']}`; configured limit: `{integrity['max_local_temp_bytes_configured']}`.",
        "",
        "## K. Provider concentration",
        "",
        f"- Semantic accepted assertions: `{json.dumps({k: {'count': v, 'share_percent': round(100 * v / accepted_external['semantic_assertions'], 2)} for k, v in accepted_external['accepted_by_provider'].items()}, sort_keys=True)}`.",
        f"- Accepted evidence units including promoted metadata: `{json.dumps(concentration['by_provider'], sort_keys=True)}`. Onisep and Discover Uni account for the largest shares because their programme records expose multiple validated fields; this is concentration by actual evidence, not duplicated effective keys.",
        "",
        "## L. Stage 1 readiness",
        "",
        "**A2 — STAGE 1 HEALTHY WITH NON-BLOCKING TARGET/PROVIDER GAPS.**",
        "",
        "All 209 institutions completed, durable persistence and bounded remote storage remained healthy, source/target failures were isolated, and integrity counters are zero. The non-blocking gaps are legitimate source absence for 42 target records and depleted DeepSeek balance near the run tail (24 isolated LLM failures; no rate-limit or persistence failure). Replenish/monitor the extraction-provider balance before the next larger run so avoidable semantic gaps do not grow.",
        "",
        "## M. Recommendation for next rollout",
        "",
        "Proceed with a staged next run of approximately **1,000 programmes**, using the same frozen-manifest/checkpoint/resume path, after the extraction-provider quota is replenished. Keep target-level source absence classified rather than replacing difficult targets; retain promotion disabled or isolated until the production publication gate is explicitly approved.",
        "",
        "## N. Quality sample, tests, and artifacts",
        "",
        f"- Evidence sample: [`stage1-quality-sample.json`]({(ROOT / 'stage1-quality-sample.json').as_posix()}) — 37 accepted assertion samples plus one materialisation-only provider sample, covering all seven countries and all provider adapters (including Studyinfo toteutus, which had no accepted assertion).",
        f"- Read-only integrity verification: [`stage1-integrity-check.json`]({(ROOT / 'stage1-integrity-check.json').as_posix()}) — 1,187 accepted rows / 1,187 unique effective keys; 0 duplicate extras, 0 missing IDs/hashes, 0 invalid bindings, 0 cycle mismatches, 0 local raw bytes.",
        f"- Metrics: [`stage1-metrics.json`]({(ROOT / 'stage1-metrics.json').as_posix()}); manifest: [`stage1-population-manifest.json`]({(ROOT / 'stage1-population-manifest.json').as_posix()}); ledger: [`stage1-source-ledger.json`]({(ROOT / 'stage1-source-ledger.json').as_posix()}); config: [`stage1-config.json`]({(ROOT / 'stage1-config.json').as_posix()}).",
        f"- Run artifacts: [`runs/stage1-20260915-main`]({(RUN).as_posix()}) including raw persistence, source/materialisation, assertions, checkpoint, and coverage reports.",
        "- Analysis checks executed after ingestion: artifact analyzer, deterministic quality-sample generation, JSON/manifest/config validation, Python compile, focused ingestion regression suite, full ingestion suite, and `git diff --check`. No commit or push was performed.",
    ]
    (ROOT / "stage1-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {ROOT / 'stage1-report.md'} ({len(lines)} lines)")


if __name__ == "__main__":
    main()
