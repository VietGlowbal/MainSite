"""Read-only Stage 1 admission/storage audit; never calls extraction or crawling.

Only Mongo reads and local filesystem reads are performed. Reports are written
to --output. Credentials and the physical Drive root are never reported.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv
from pymongo import MongoClient

FIELDS = ("recommendation_letters", "sop_essay_requirements", "graduation_certificate", "academic_transcript")
ALIASES = {"sop_or_essay": "sop_essay_requirements"}
PATTERNS = {
    "recommendation_letters": r"\b(?:recommendation letters?|letters? of recommendation|references?|referees?)\b",
    "sop_essay_requirements": r"\b(?:statement of purpose|personal statement|motivation letter|application essays?)\b",
    "graduation_certificate": r"\b(?:degree certificate|graduation certificate|proof of degree|diploma|certificat de dipl[oô]me)\b",
    "academic_transcript": r"\b(?:academic transcripts?|official transcripts?|transcripts?|academic records?|relev[eé]s? de notes)\b",
}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def jsonl(path):
    if path.exists():
        with path.open(encoding="utf-8-sig") as handle:
            for line in handle:
                if line.strip():
                    yield json.loads(line)


def count(rows, key):
    return dict(Counter(str(row.get(key)) for row in rows))


def digest(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def urlkey(value):
    p = urlsplit(value or "")
    return urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path.rstrip("/"), p.query, ""))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--archive-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    load_dotenv(args.env_file, override=False)
    repo = Path(__file__).resolve().parents[1]
    base = repo / "docs/architecture/data/external-field-stage1-20260915"
    run = base / "runs/stage1-20260915-main"
    population = read_json(base / "stage1-production-population.json")
    targets = {p["programme_id"]: p for p in population["verified_programme_manifest"]}
    report = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "scope": "230 frozen verified Stage 1 programmes; read-only storage/content inventory",
        "llm_calls": 0, "crawl_requests": 0, "remote_writes": 0,
        "population_sha256": digest(base / "stage1-production-population.json"),
        "runtime_env": {k: bool(os.environ.get(k)) for k in (
            "DATA_PLATFORM_ARTIFACT_BACKEND", "DATA_PLATFORM_ARCHIVE_ROOT",
            "MONGODB_URI", "MONGODB_DATABASE", "DEEPSEEK_API_KEY",
            "EXTRACTION_API_KEY", "OPENAI_COMPATIBLE_API_KEY")},
    }
    client = MongoClient(os.environ["MONGODB_URI"], serverSelectionTimeoutMS=10000,
                         connectTimeoutMS=10000, socketTimeoutMS=30000)
    db = client[os.environ["MONGODB_DATABASE"]]
    collections = db.list_collection_names()
    report["collections"] = {n: db[n].count_documents({}) for n in collections}
    blobs = list(db["raw_blobs"].find({}, {"payload": 0}))
    snapshots = list(db["source_snapshots"].find({}, {"safe_response_headers": 0}))
    by_hash = {str(b["_id"]): b for b in blobs}
    by_snapshot = {str(s["_id"]): s for s in snapshots}
    files = [p for p in args.archive_root.rglob("*") if p.is_file() and ".artifact-locks" not in p.parts]
    raw_files = [p for p in files if "raw/objects/" in p.relative_to(args.archive_root).as_posix()]
    drive_hashes = {}
    bad_hash = []
    for p in raw_files:
        actual = digest(p)
        if actual != p.stem:
            bad_hash.append(p.relative_to(args.archive_root).as_posix())
        else:
            drive_hashes[actual] = p
    inline_good, inline_bad = set(), []
    for b in db["raw_blobs"].find({"payload_location": "mongo_inline"}, {"payload": 1}):
        if hashlib.sha256(bytes(b.get("payload") or b"")).hexdigest() == str(b["_id"]):
            inline_good.add(str(b["_id"]))
        else:
            inline_bad.append(str(b["_id"]))
    objects = [b for b in blobs if b.get("payload_location") == "object_store"]
    legacy = [b for b in objects if not str(b.get("object_key", "")).startswith("raw/objects/")]
    report["storage"] = {
        "blob_locations": count(blobs, "payload_location"),
        "blob_backends": count(blobs, "storage_backend"),
        "snapshot_backends": count(snapshots, "storage_backend"),
        "drive_files_by_folder": dict(Counter(p.relative_to(args.archive_root).parts[0] for p in files)),
        "drive_raw_bytes": sum(p.stat().st_size for p in raw_files),
        "drive_raw_hash_verified": len(drive_hashes), "drive_hash_failures": bad_hash,
        "mongo_inline_hash_verified": len(inline_good), "mongo_inline_hash_failures": inline_bad,
        "mongo_object_blobs": len(objects),
        "mongo_object_hashes_on_drive": sum(str(b["_id"]) in drive_hashes for b in objects),
        "legacy_locator_blobs": len(legacy),
        "legacy_locator_blobs_with_drive_copy": sum(str(b["_id"]) in drive_hashes for b in legacy),
        "legacy_locator_hashes_without_drive_copy": [str(b["_id"]) for b in legacy if str(b["_id"]) not in drive_hashes],
        "drive_copy_not_registered_as_mongo_blob": sum(h not in by_hash for h in drive_hashes),
        "cloud_sync": "UNKNOWN; only mounted readback verified",
    }
    dump = args.archive_root / "datasets/stage1/current-supabase-export"
    if (dump / "manifest.json").exists():
        manifest = read_json(dump / "manifest.json")
        checks = [{"file": t["file"], "rows": t["rows"],
                   "hash_matches": digest(dump / t["file"]) == t["sha256"]}
                  for t in manifest["source_tables"]]
        with (dump / "crawl_admission_packages.csv").open(encoding="utf-8-sig", newline="") as h:
            legacy_packages = list(csv.DictReader(h))
        old_urls = {urlkey(p["official_url"]) for p in legacy_packages}
        report["drive_legacy_dataset"] = {
            "exported_at": manifest["exported_at"], "table_checks": checks,
            "admission_package_rows": len(legacy_packages),
            "stage1_exact_programme_id_matches": len(set(targets) & {p["programme_id"] for p in legacy_packages}),
            "stage1_exact_official_url_matches": sum(urlkey(p["official_url"]) in old_urls for p in targets.values()),
            "note": "Historical snapshot; no fuzzy transfer of requirements permitted by this audit.",
        }
    stage_snapshots = [s for s in snapshots if s.get("acquisition_run_id") == "stage1-20260915-main"]
    stage_hashes = {s["content_hash"] for s in stage_snapshots}
    report["stage1_raw"] = {
        "snapshots": len(stage_snapshots), "unique_hashes": len(stage_hashes),
        "locations": count(stage_snapshots, "payload_location"),
        "hashes_in_mongo_inline": len(stage_hashes & inline_good),
        "hashes_on_drive": len(stage_hashes & drive_hashes.keys()),
        "hashes_without_verified_body": sorted(stage_hashes - inline_good - drive_hashes.keys()),
    }
    fields = defaultdict(list)
    evidence_stats = {}
    for path in [run / "field_assertions.jsonl", run / "effective_field_assertions.jsonl",
                 base / "stage1-incremental-evidence.jsonl", base / "stage1-max-fill-evidence.jsonl"]:
        selected = []
        for a in jsonl(path):
            pid = a.get("programme_id") or a.get("entity_id")
            f = ALIASES.get(a.get("field_name"), a.get("field_name"))
            if pid not in targets or f not in (*FIELDS, "required_documents"):
                continue
            value = a.get("value_json", a.get("value"))
            if value in (None, "", [], {}):
                continue
            selected.append(a)
            fields[pid].append({"field": f, "source": path.name,
                                "status": a.get("verification_status", a.get("original_status")),
                                "value": value, "url": a.get("source_url"),
                                "hash": a.get("source_content_hash", a.get("source_hash"))})
        evidence_stats[path.name] = {
            "records": len(selected), "by_field": count(selected, "field_name"),
            "by_status": dict(Counter(str(a.get("verification_status", a.get("original_status"))) for a in selected)),
            "programmes": len({a.get("programme_id", a.get("entity_id")) for a in selected}),
        }
    report["admission_assertions_nonempty"] = evidence_stats
    packages = [p for p in jsonl(run / "admission_packages.jsonl") if p.get("programme_id") in targets]
    package_stats = {}
    for f in FIELDS:
        reqs = [r for p in packages for r in p.get("requirements", []) if r.get("source_field") == f]
        package_stats[f] = {"records": len(reqs), "statuses": count(reqs, "requirement_status"),
                            "with_evidence": sum(bool(r.get("evidence")) for r in reqs)}
    report["original_run_packages"] = {"programmes": len(packages), "fields": package_stats}
    report["original_run_packages"]["missing_target_ids"] = sorted(set(targets) - {p["programme_id"] for p in packages})
    sources = list(jsonl(run / "sources.jsonl"))
    source_urls = defaultdict(set)
    for a in jsonl(run / "effective_field_assertions.jsonl"):
        if a.get("entity_id") in targets and a.get("source_url"):
            source_urls[a["entity_id"]].add(urlkey(a["source_url"]))
    with (base / "stage1-programme-final-results.csv").open(encoding="utf-8-sig", newline="") as h:
        exports = {r["programme_id"]: r for r in csv.DictReader(h)}
    pages = []
    page_sources = {}
    inventories = {}
    recovery_queue = []
    roundtrip_hashes = set()
    reconstructed_hashes = {}
    recapture_queue = []
    from bs4 import BeautifulSoup
    for name in ["_existing_url_fetch_inventory.json", "_official_url_fetch_inventory.json"]:
        batch = read_json(base / name)
        inventories[name] = {"rows": len(batch), "statuses": count(batch, "status"),
                             "with_text": sum(bool(r.get("text")) for r in batch)}
        for r in batch:
            if not (200 <= int(r.get("status") or 0) < 300 and r.get("text")):
                if name == "_existing_url_fetch_inventory.json":
                    recovery_queue.append({"url": r.get("url"), "previous_status": r.get("status"),
                                           "action": "RESOLVE_REPLACEMENT_OFFICIAL_URL" if r.get("status") == 404 else
                                           "CHECK_ALLOWED_ALTERNATE_OFFICIAL_SOURCE" if r.get("status") == 403 else
                                           "BOUNDED_RETRY_AFTER_SOURCE_REVIEW",
                                           "not_executed": True})
                continue
            raw = str(r["text"])
            if hashlib.sha256(raw.encode("utf-8")).hexdigest() == r.get("hash"):
                roundtrip_hashes.add(r["hash"])
            for encoding in ("utf-8", "latin-1", "cp1252", "utf-8-sig", "utf-16", "cp1250"):
                try:
                    body = raw.encode(encoding)
                except UnicodeError:
                    continue
                if hashlib.sha256(body).hexdigest() == r.get("hash"):
                    reconstructed_hashes[r["hash"]] = encoding
                    break
            else:
                recapture_queue.append({"url": r.get("url"), "previous_status": r.get("status"),
                                        "original_hash": r.get("hash"), "reported_bytes": r.get("bytes"),
                                        "retained_text_chars": len(raw), "content_type": r.get("ctype"),
                                        "action": "RECAPTURE_FULL_BODY_IF_NO_OTHER_ARCHIVE_COPY",
                                        "reason": "Decoded/truncated capture does not reconstruct the recorded raw hash; new capture is a new observation, not a restoration of old bytes.",
                                        "not_executed": True})
            soup = BeautifulSoup(raw, "html.parser")
            for tag in soup(["script", "style", "nav", "footer"]):
                tag.decompose()
            text = soup.get_text(" ", strip=True)
            keys = {urlkey(r.get("url")), urlkey(r.get("final_url"))} - {""}
            pages.append({"url": r.get("url"), "final_url": r.get("final_url"),
                          "hash": r.get("hash"), "keys": keys, "text_chars": len(text),
                          "pdf": "pdf" in str(r.get("ctype", "")).lower(),
                          "signals": [f for f, pattern in PATTERNS.items() if re.search(pattern, text, re.I)]})
            if "pdf" not in str(r.get("ctype", "")).lower():
                page_sources[str(r.get("url"))] = {"text": text, "hash": r.get("hash"), "keys": keys, "origin": "local_decoded_capture"}
    report["local_inventories"] = inventories
    page_hashes = {p["hash"] for p in pages if p["hash"]}
    report["local_capture_retention"] = {
        "successful_pages": len(pages), "unique_hashes": len(page_hashes),
        "hashes_registered_in_mongo": len(page_hashes & by_hash.keys()),
        "hashes_on_drive": len(page_hashes & drive_hashes.keys()),
        "hashes_not_in_mongo_or_drive": len(page_hashes - by_hash.keys() - drive_hashes.keys()),
        "unique_hashes_reconstructible_from_utf8_text": len(roundtrip_hashes),
        "unique_hashes_not_reconstructed_by_utf8_encoding": len(page_hashes - roundtrip_hashes),
        "unique_hashes_reconstructible_using_tested_encodings": len(reconstructed_hashes),
        "reconstructed_hash_encoding_counts": dict(Counter(reconstructed_hashes.values())),
        "unreconstructed_unique_hashes": len(page_hashes - reconstructed_hashes.keys()),
        "unreconstructed_capture_rows": len(recapture_queue),
        "unreconstructed_capture_rows_at_200000_char_cap": sum(r["retained_text_chars"] == 200000 for r in recapture_queue),
        "text_under_300_chars": sum(p["text_chars"] < 300 for p in pages),
        "pdf_pages": sum(p["pdf"] for p in pages),
        "pages_with_keyword_signals_only": dict(Counter(f for p in pages for f in p["signals"])),
        "note": "Keyword signals and URL equality are triage only, not validated requirements/identity. Inventory hashes describe original bytes; decoded text may not round-trip.",
    }
    per_programme = []
    # Offline probe of production excerpt rules. No provider or pipeline is
    # constructed. Every result remains an unvalidated review candidate.
    sys.path.insert(0, str(repo / "services/data-ingestion/src"))
    from glowbal_ingestion.deterministic import extract_source_excerpt_assertions
    from glowbal_ingestion.extraction_provider import ExtractionSource

    def collect_strings(value):
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            return [s for item in value for s in collect_strings(item)]
        if isinstance(value, dict):
            return [s for item in value.values() for s in collect_strings(item)]
        return []

    for source in sources:
        content_type = str(source.get("content_type") or "").lower()
        if not any(t in content_type for t in ("json", "html", "text/plain", "xml")):
            continue
        h = source.get("content_hash")
        body = None
        if h in drive_hashes and drive_hashes[h].suffix in (".json", ".html", ".txt"):
            body = drive_hashes[h].read_bytes()
        elif h in inline_good:
            b = db["raw_blobs"].find_one({"_id": h}, {"payload": 1})
            body = bytes(b["payload"])
        if not body or len(body) > 8 * 1024 * 1024:
            continue
        text = body.decode("utf-8", errors="replace")
        try:
            text = "\n".join(collect_strings(json.loads(text)))
        except ValueError:
            pass
        soup = BeautifulSoup(text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        text = soup.get_text("\n", strip=True)
        keys = {urlkey(source.get("url")), urlkey(source.get("canonical_url"))} - {""}
        page_sources[str(source["url"])] = {"text": text, "hash": h, "keys": keys, "origin": "hash_verified_mongo_or_drive"}
    replay_candidates = []
    for pid, target in targets.items():
        urls = source_urls[pid] | {urlkey(target.get("official_url")), urlkey(exports.get(pid, {}).get("application_url"))}
        urls.discard("")
        linked = [p for p in pages if p["keys"] & urls]
        observations = fields[pid]
        candidates = []
        for url, page in page_sources.items():
            if not page["keys"] & urls:
                continue
            extracted = extract_source_excerpt_assertions(
                entity_id=pid,
                sources=[ExtractionSource(url=url, page_type="programme_admission", title=None,
                                          text=page["text"], content_hash=page["hash"] or "")],
                field_names=FIELDS, extractor_version="read-only-audit-excerpt-probe",
                programme_degree=target.get("degree_level"),
            )
            for a in extracted:
                candidate = {"programme_id": pid, "field_name": a.field_name,
                             "url": url, "hash": page["hash"], "origin": page["origin"],
                             "excerpt": a.evidence,
                             "status": "REVIEW_CANDIDATE_NOT_VALIDATED",
                             "warning": "URL association only; programme identity, cycle, applicability and source semantics require review."}
                candidates.append(candidate)
                replay_candidates.append(candidate)
        per_programme.append({
            **{k: target.get(k) for k in ("programme_id", "programme_name", "institution_id", "official_url")},
            "retained_url_matched_pages": len(linked),
            "keyword_candidate_fields": sorted({f for p in linked for f in p["signals"]}),
            "observed_nonempty_fields": sorted({a["field"] for a in observations}),
            "fields_without_top_level_assertion": sorted(set(FIELDS) - {a["field"] for a in observations}),
            "offline_excerpt_candidate_fields": sorted({c["field_name"] for c in candidates}),
            "linked_pages": [{k: p[k] for k in ("url", "hash", "text_chars", "signals")} for p in linked],
            "next_step": "REPARSE_AND_REVIEW_IDENTITY" if linked else "RESOLVE_ADMISSIONS_SOURCE_FROM_RETAINED_RAW_FIRST",
        })
    report["programme_triage"] = {
        "with_url_matched_local_pages": sum(p["retained_url_matched_pages"] > 0 for p in per_programme),
        "with_admission_keyword_candidate": sum(bool(p["keyword_candidate_fields"]) for p in per_programme),
        "without_url_matched_local_pages": sum(p["retained_url_matched_pages"] == 0 for p in per_programme),
        "warning": "No automatic recrawl verdict from this triage; retained Mongo/Drive provider payloads may contain further links or requirements.",
    }
    report["offline_excerpt_probe"] = {
        "candidate_count": len(replay_candidates),
        "programmes": len({c["programme_id"] for c in replay_candidates}),
        "by_field": count(replay_candidates, "field_name"),
        "by_origin": count(replay_candidates, "origin"),
        "unique_programme_fields": len({(c["programme_id"], c["field_name"]) for c in replay_candidates}),
        "candidate_is_not_verified_requirement": True,
    }
    report["source_recovery_queue"] = {
        "failed_existing_urls": len(recovery_queue),
        "previous_statuses": count(recovery_queue, "previous_status"),
        "not_executed": True,
        "successful_but_incomplete_capture_rows": len(recapture_queue),
        "note": "Failed candidate URLs, not a count of programmes needing full recrawl. Resolve identity and inspect retained sources before retrying.",
    }
    report["local_run"] = {"file_count": len(list(run.glob("*.*"))),
                           "bytes": sum(p.stat().st_size for p in run.glob("*.*") if p.is_file()),
                           "package_artifact_hash_on_drive": digest(run / "admission_packages.jsonl") in drive_hashes}
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "storage-admission-audit.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (args.output / "programme-triage.json").write_text(json.dumps(per_programme, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (args.output / "offline-excerpt-candidates.json").write_text(json.dumps(replay_candidates, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (args.output / "source-recovery-queue.json").write_text(json.dumps(recovery_queue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (args.output / "full-body-recapture-queue.json").write_text(json.dumps(recapture_queue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    client.close()
    print(json.dumps(report, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
