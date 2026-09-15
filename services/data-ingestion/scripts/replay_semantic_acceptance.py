"""Replay retained proposals without acquisition, LLM calls or DB writes."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import importlib.util
import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

from glowbal_ingestion.extraction_provider import ExtractionSource
from glowbal_ingestion.models import FieldAssertion
from glowbal_ingestion.parsing import parse_html, parse_pdf
from glowbal_ingestion.semantic_acceptance import (
    SourceBinding,
    reconcile_assertion_metadata,
    reconsider_assertions,
)
from glowbal_ingestion.evidence_resolution import (
    binding_for_assertion,
    resolve_entity_scope,
    resolve_evidence_alignment,
    resolve_provenance,
    source_resolution_summary,
)
from glowbal_ingestion.regression_corpus import classify_corpus, corpus_summary


def load_lines(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--audit-script", type=Path, required=True)
    args = parser.parse_args()
    run, out = args.run_dir.resolve(), args.output_dir.resolve()
    if out == run or run in out.parents:
        raise ValueError("Replay output must be outside the frozen input run")
    out.mkdir(parents=True, exist_ok=True)
    sources = load_lines(run / "sources.jsonl")
    raw = load_lines(run / "field_assertions.jsonl")
    effective = load_lines(run / "effective_field_assertions.jsonl")
    programmes = load_lines(run / "programmes.jsonl")
    institutions = load_lines(run / "institutions.jsonl")
    organisation_units_path = run / "organisation_units.jsonl"
    organisation_units = load_lines(organisation_units_path) if organisation_units_path.exists() else []
    manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
    programme_map = {p["programme_id"]: p for p in programmes}
    institution_map = {i["institution_id"]: i for i in institutions}
    bindings, source_failures = {}, []
    run_ids = {r["run_id"] for r in load_lines(run / "source_ecosystem_fetches.jsonl")}
    if len(run_ids) != 1:
        raise ValueError("Ambiguous retained acquisition run identity")
    run_id = next(iter(run_ids))
    for s in sources:
        p = (run / s["raw_object_path"]).resolve()
        if run not in p.parents or not p.is_file():
            source_failures.append({"source_id":s["source_id"],"reason":"LOCAL_SNAPSHOT_UNAVAILABLE"})
            continue
        try:
            with (gzip.open(p,"rb") if p.suffix==".gz" else p.open("rb")) as f:
                body = f.read(8*1024*1024+1)
            if len(body)>8*1024*1024:
                raise ValueError("BOUNDED_REPLAY_BYTE_LIMIT")
            if hashlib.sha256(body).hexdigest() != s["content_hash"]:
                raise ValueError("RAW_HASH_MISMATCH")
            mime = s.get("content_type") or ""
            if "html" in mime:
                text = parse_html(body,s["url"],mime).text
            elif "pdf" in mime:
                text = parse_pdf(body,s["url"]).text
            else:
                text = body.decode("utf-8",errors="replace")
            source = ExtractionSource(url=s["url"],page_type=s["page_type"],title=s.get("title"),
                text=text,content_hash=s["content_hash"],raw_document_id=s["raw_document_id"],
                acquisition_run_id=run_id,source_authority=s.get("source_authority"),
                source_relationship=s.get("source_relationship"),source_class=s.get("source_class"),
                provider_id=s.get("provider_id"),dataset_id=s.get("dataset_id"),
                temporal_state=s.get("temporal_state","UNKNOWN"),academic_cycle=s.get("academic_cycle"),
                source_resolution=s.get("source_resolution"),linked_programme_id=s.get("linked_programme_id"))
            inst=institution_map[s["institution_id"]]
            bindings[source.raw_document_id] = SourceBinding(source,s["institution_id"],inst["official_domain"])
        except Exception as exc:
            source_failures.append({"source_id":s["source_id"],"reason":str(exc)})
    fields=manifest["target_fields"]
    kwargs=dict(bindings=bindings,programmes=programme_map,
                organisation_units=organisation_units,
                target_cycle=manifest.get("source_ecosystem",{}).get("target_cycle"))
    metadata_decisions=reconcile_assertion_metadata(
        [FieldAssertion(**a) for a in effective], bindings=bindings,
        programmes=programme_map, organisation_units=organisation_units)
    raw_metadata_decisions=reconcile_assertion_metadata(
        [FieldAssertion(**a) for a in raw], bindings=bindings,
        programmes=programme_map, organisation_units=organisation_units)
    reconciled=[d.assertion for d in metadata_decisions]
    raw_reconciled=[d.assertion for d in raw_metadata_decisions]
    decisions=reconsider_assertions(reconciled,**kwargs)
    raw_decisions=reconsider_assertions(raw_reconciled,**kwargs)
    corpus_before=classify_corpus([FieldAssertion(**a) for a in effective])
    corpus_after=classify_corpus([d.assertion for d in decisions])
    resolution_rows=[]
    for original_row, reconciled_assertion, decision in zip(effective, reconciled, decisions):
        if original_row.get("verification_status") != "NEEDS_REVIEW":
            continue
        original_assertion = FieldAssertion(**original_row)
        binding = binding_for_assertion(original_assertion, bindings)
        source = binding.source if binding else None
        alignment = resolve_evidence_alignment(original_assertion, source) if source else None
        provenance = resolve_provenance(original_assertion, source, alignment=alignment) if source else None
        programme = programme_map.get(reconciled_assertion.entity_id, {})
        expected_institution = str(
            programme.get("institution_id")
            or (reconciled_assertion.entity_id if reconciled_assertion.entity_type == "institution" else "")
        )
        entity = (
            resolve_entity_scope(
                original_assertion,
                source,
                target_institution_id=expected_institution,
                target_programme={**programme, "programme_id": original_assertion.entity_id},
                organisation_units=organisation_units,
                supplied_organisation_unit_id=binding.organisation_unit_id if binding else None,
                fallback_to_institution=bool(
                    binding and source and binding.official_domain
                    and (
                        (urlsplit(source.url or "").hostname or "").casefold()
                        == binding.official_domain.casefold()
                        or (
                            urlsplit(source.url or "").hostname or ""
                        ).casefold().endswith(
                            "." + binding.official_domain.casefold()
                        )
                    )
                ),
            )
            if source else None
        )
        category = source_resolution_summary(
            original_row,
            binding=binding,
            alignment=alignment,
            provenance=provenance,
            entity=entity,
            acceptance_reasons=decision.reasons,
        )
        resolution_rows.append({
            "assertion_id": original_row.get("assertion_id"),
            "field_name": original_row.get("field_name"),
            "original_scope": original_row.get("scope"),
            "original_entity_id": original_row.get("entity_id"),
            "original_entity_type": original_row.get("entity_type"),
            "original_status": original_row.get("verification_status"),
            "post_status": decision.assertion.verification_status.value,
            "acceptance_classification": decision.classification,
            "acceptance_reasons": list(decision.reasons),
            "root_cause": category,
            "binding_found": bool(binding),
            "alignment": alignment.to_dict() if alignment else None,
            "provenance": provenance.to_dict() if provenance else None,
            "entity_scope": entity.to_dict() if entity else None,
        })
    with (out / "evidence-resolution-decisions.jsonl").open("w", encoding="utf-8") as f:
        for row in resolution_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    with (out / "metadata-reconciliation-decisions.jsonl").open("w", encoding="utf-8") as f:
        for original, decision in zip(effective, metadata_decisions):
            if decision.changes or decision.reasons:
                f.write(json.dumps({"original_assertion_id": original["assertion_id"],
                    "changes": decision.changes, "reasons": decision.reasons,
                    "assertion": decision.assertion.to_dict()}, ensure_ascii=False) + "\n")
    after=[d.assertion.to_dict() for d in decisions]
    for name, ds in (("acceptance-decisions",decisions),("raw-proposal-classifications",raw_decisions)):
        with (out/(name+".jsonl")).open("w",encoding="utf-8") as f:
            for original,d in zip(effective if name=="acceptance-decisions" else raw,ds):
                if d.classification=="UNCHANGED": continue
                f.write(json.dumps({"original_assertion_id":original["assertion_id"],
                    "original_entity_id":original["entity_id"],"classification":d.classification,
                    "reasons":d.reasons,"changes":d.changes,"assertion":d.assertion.to_dict()},ensure_ascii=False)+"\n")
    with (out/"effective_field_assertions.jsonl").open("w",encoding="utf-8") as f:
        for a in after:f.write(json.dumps(a,ensure_ascii=False)+"\n")
    spec=importlib.util.spec_from_file_location("retained_field_audit",args.audit_script)
    audit=importlib.util.module_from_spec(spec); spec.loader.exec_module(audit)
    pc,ic=audit._contexts(programmes,institutions)
    hierarchy={}
    for label,rows in (("before",effective),("after",after)):
        hierarchy[label]=audit._evaluate_hierarchy(target_rows=programmes,assertion_rows=rows,
            programme_contexts=pc,institution_contexts=ic,fields=fields)
    write_json(out/"hierarchical-evaluation.json",hierarchy)
    accepted=lambda a:a.get("value_json") is not None and a.get("verification_status") in {"RULE_VALIDATED","HUMAN_VERIFIED"} and a.get("epistemic_state")=="OBSERVED"
    before_accepted=[a for a in effective if accepted(a)]
    after_accepted=[a for a in after if accepted(a)]
    source_class={s["raw_document_id"]:s.get("source_class") for s in sources}
    result={
        "input_run_id":run_id,"frozen_targets":20,"acquired_targets":len(programmes),"fields":fields,
        "before":{"needs_review":sum(a["verification_status"]=="NEEDS_REVIEW" for a in effective),"accepted":len(before_accepted)},
        "after":{"newly_accepted":len(after_accepted)-len(before_accepted),"accepted":len(after_accepted),
            "needs_review":sum(a["verification_status"]=="NEEDS_REVIEW" for a in after),
            "new_hard_rejected":sum(d.classification == "HARD_INVALID" for d in decisions)},
        "raw_proposals":{"needs_review_before":sum(a["verification_status"]=="NEEDS_REVIEW" for a in raw),
            "preexisting_rejected":sum(a["verification_status"]=="REJECTED" for a in raw),
            "classifications":dict(Counter(d.classification for d in raw_decisions if d.classification!="UNCHANGED"))},
        "classifications":dict(Counter(d.classification for d in decisions if d.classification!="UNCHANGED")),
        "evidence_resolution": {
            "review_cases": len(resolution_rows),
            "by_root_cause": dict(Counter(row["root_cause"] for row in resolution_rows)),
            "remaining_review_by_root_cause": dict(Counter(
                row["root_cause"] for row in resolution_rows
                if row["post_status"] == "NEEDS_REVIEW"
            )),
            "resolved_by_root_cause": dict(Counter(
                row["root_cause"] for row in resolution_rows
                if row["post_status"] in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
            )),
            "alignment_resolved": sum(
                1 for row in resolution_rows
                if row["alignment"] and row["alignment"].get("status") == "ALIGNED"
            ),
            "scope_bound": sum(
                1 for row in resolution_rows
                if row["entity_scope"]
                and row["entity_scope"].get("status") == "BOUND"
                and (
                    row["entity_scope"].get("scope")
                    != row.get("original_scope")
                    or row["entity_scope"].get("entity_id")
                    != row.get("original_entity_id")
                    or row["entity_scope"].get("entity_type")
                    != row.get("original_entity_type")
                )
            ),
            "provenance_repaired": sum(
                1 for row in resolution_rows
                if row["provenance"] and row["provenance"].get("status") == "REPAIRED"
            ),
        },
        "metadata_reconciliation": {
            "changed_assertions": sum(bool(d.changes) for d in metadata_decisions),
            "changes_by_type": dict(Counter(change for d in metadata_decisions for change in d.changes)),
            "unavailable_bindings": sum(bool(d.reasons) for d in metadata_decisions),
        },
        "remaining_review_reasons":dict(Counter(r for d in decisions if d.assertion.verification_status=="NEEDS_REVIEW" for r in d.reasons)),
        "accepted_by_field":{"before":dict(Counter(a["field_name"] for a in before_accepted)),"after":dict(Counter(a["field_name"] for a in after_accepted))},
        "accepted_by_scope":dict(Counter(a.get("scope") or "UNKNOWN" for a in after_accepted)),
        "accepted_by_entity_type":dict(Counter(a.get("entity_type") or "UNKNOWN" for a in after_accepted)),
        "accepted_unique_assertion_ids":len({a["assertion_id"] for a in after_accepted}),
        "accepted_by_temporal_state":dict(Counter(a.get("temporal_state") or "UNKNOWN" for a in after_accepted)),
        "accepted_by_source_class":dict(Counter(source_class.get(a.get("raw_document_id"),"UNKNOWN") for a in after_accepted)),
        "source_binding_count":len(bindings),"source_failures":source_failures,
        "input_hashes":{name:hashlib.sha256((run/name).read_bytes()).hexdigest() for name in ["field_assertions.jsonl","effective_field_assertions.jsonl","sources.jsonl","manifest.json"]},
        "new_acquisition":0,"llm_calls":0,"database_writes":0,"promotion_calls":0,
        "regression_corpus":{"before":corpus_summary(corpus_before),"after":corpus_summary(corpus_after)},
    }
    for label, data in hierarchy.items():
        ds=[d for f in data["fields"].values() for d in f["decisions"]]
        reasons=Counter(d["reason"] for d in ds)
        direct=reasons["DIRECT_TARGET_AVAILABLE"]
        activated=sum(not d["abstained"] for d in ds)
        result.setdefault("hierarchy_summary",{})[label]={
            "target_field_pairs":len(ds),"direct":direct,
            "direct_coverage":direct/len(ds),
            "activated_by_level":dict(Counter(d["level"] for d in ds if not d["abstained"])),
            "missing_target_abstentions":len(ds)-direct-activated,
            "missing_target_abstention_rate":(len(ds)-direct-activated)/(len(ds)-direct),
            "engine_abstentions_including_direct":sum(d["abstained"] for d in ds),
            "reasons":dict(reasons)}
    write_json(out/"result.json",result)
    print(json.dumps(result,ensure_ascii=True,indent=2))


if __name__=="__main__":main()
