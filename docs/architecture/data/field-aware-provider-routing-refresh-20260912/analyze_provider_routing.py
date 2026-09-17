from __future__ import annotations
import json
from collections import Counter,defaultdict
from pathlib import Path
from urllib.parse import urlsplit
import sys
sys.path.insert(0,'services/data-ingestion/src')
from glowbal_ingestion.config import SmokeConfig
from glowbal_ingestion.source_adapters import AcquisitionPlanner, build_source_registry


def is_explicit(row):
    """Mirror the refresh audit's conservative native-value contract."""
    return (
        row.get("value_json") is not None
        and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("epistemic_state") == "OBSERVED"
        and row.get("null_reason") is None
        and not row.get("inherited_from_assertion_id")
        and not row.get("inherited_from_entity_id")
        and row.get("source_type") not in {"historical_inference", "hierarchical_inference"}
    )

ROOT=Path('docs/architecture/data/field-aware-provider-routing-refresh-20260912')
RUN=ROOT/'runs'/'routed-refresh-20260912'
OUT=ROOT/'analysis'
OUT.mkdir(parents=True,exist_ok=True)
def load(name):
 p=RUN/name
 if not p.exists(): return []
 with p.open(encoding='utf-8') as f:
  out=[]
  for line in f:
   try: out.append(json.loads(line))
   except Exception: pass
 return out

def hostkey(u):
 s=str(u or '').strip()
 return s.rstrip('/')

def read_json(path): return json.loads(Path(path).read_text(encoding='utf-8'))
config=SmokeConfig.load(ROOT/'population-config.json')
reg=build_source_registry(config.source_ecosystem)
registry_ids=list(reg.adapter_ids)
manifest=read_json(ROOT/'population-manifest.json')
run_manifest=read_json(RUN/'manifest.json')
catalogue={p.provider_id:p for p in config.source_ecosystem.external_providers}
requested_fields=tuple(run_manifest.get('target_fields') or config.source_ecosystem.field_groups)
planner=AcquisitionPlanner(mode='external_source_expansion')
provider_groups=planner.provider_field_groups(requested_fields)
# map concrete fields to routed provider groups using the same planner mapping
field_map={f:list(AcquisitionPlanner._PROVIDER_FIELD_GROUPS.get(f,(f,))) for f in requested_fields}
provider_routes={}
for pid,p in catalogue.items():
 groups=[str(x) for x in (getattr(p,'field_groups',()) or ())]
 provider_routes[pid]={
   'provider_groups':groups,
   'routed_groups':[g for g in groups if g.casefold() in {x.casefold() for x in provider_groups}],
   'fields':[f for f,gs in field_map.items() if set(x.casefold() for x in gs).intersection({g.casefold() for g in groups})],
 }
# rows
sources=load('sources.jsonl'); candidates=load('source_candidates.jsonl'); selection=load('source_selection_events.jsonl'); fetches=load('source_ecosystem_fetches.jsonl'); attempts=load('acquisition_attempts.jsonl'); assertions=load('effective_field_assertions.jsonl'); raw_assertions=load('field_assertions.jsonl'); intents=load('acquisition_intents.jsonl')
source_by_url={hostkey(r.get('url')):r for r in sources}
source_by_canon={hostkey(r.get('canonical_url')):r for r in sources}
source_by_id={str(r.get('source_id')):r for r in sources}
candidate_by_id={str(r.get('candidate_id')):r for r in candidates}
intent_by_id={str(r.get('intent_id')):r for r in intents}
# Add provider rows
provider_summary={}
for pid,p in catalogue.items():
 pd=p.to_dict()
 cs=[r for r in candidates if r.get('provider_id')==pid]
 fs=[r for r in fetches if r.get('provider_id')==pid]
 ss=[r for r in sources if r.get('provider_id')==pid]
 sel=[r for r in selection if (source_by_url.get(hostkey(r.get('url'))) or source_by_canon.get(hostkey(r.get('url'))) or {}).get('provider_id')==pid]
 sel_counts=Counter((r.get('decision'),r.get('reason_code')) for r in sel)
 fstatuses=Counter(str(r.get('status') or '') for r in fs)
 scopes=Counter(str(r.get('source_resolution') or '') for r in ss)
 # source-backed assertions (value-bearing effective rows) by URL and source provider
 pa=[]
 pa_non_null=[]
 for a in assertions:
  s=source_by_url.get(hostkey(a.get('source_url'))) or source_by_canon.get(hostkey(a.get('source_url')))
  if s and s.get('provider_id')==pid and a.get('value_json') not in (None,'',[]):
   pa_non_null.append(a)
   if is_explicit(a): pa.append(a)
 provider_summary[pid]={
   'source_class':pd.get('source_class'),'authority':pd.get('authority'),'relationship':pd.get('relationship'),'dataset_id':pd.get('dataset_id'),
   'adapter_id':pd.get('adapter_id') or pd.get('adapter'),'enabled':bool(pd.get('enabled',True)),
   'configured':True,'adapter_registered':str(pd.get('adapter_id') or pd.get('adapter') or '') in registry_ids or str(pd.get('source_class') or '') in registry_ids,
   'candidate_count':len(cs),'selection_selected':sum(1 for r in sel if r.get('decision')=='selected'),'selection_rejected':sum(1 for r in sel if r.get('decision')=='rejected'),
   'selection_reasons':dict(Counter(str(r.get('reason_code') or '') for r in sel)),
   'fetch_attempt_count':len(fs),'fetch_statuses':dict(fstatuses),'raw_source_rows':len(ss),'source_resolution':dict(scopes),
   'field_groups':list(pd.get('field_groups') or []),'routed_groups':provider_routes[pid]['routed_groups'],'routed_fields':provider_routes[pid]['fields'],
   'field_valued_assertions':len(pa),
   'field_valued_non_null_assertions':len(pa_non_null),
   'assertion_fields':dict(Counter(str(a.get('field_name')) for a in pa)),
   'assertion_scopes':dict(Counter(str(a.get('scope') or '') for a in pa)),
 }
# all effective assertions joined to source metadata (source contribution)
assertion_by_sourceclass=Counter(); assertion_by_provider=Counter(); assertion_scopes=Counter(); assertion_prov_complete=Counter(); assertion_non_null_by_sourceclass=Counter(); assertion_non_null_by_provider=Counter()
for a in assertions:
 if a.get('value_json') in (None,'',[]): continue
 s=source_by_url.get(hostkey(a.get('source_url'))) or source_by_canon.get(hostkey(a.get('source_url')))
 cls=(s or {}).get('source_class') or 'unlinked'
 pid=(s or {}).get('provider_id') or 'official_web' if s else 'unlinked'
 assertion_non_null_by_sourceclass[cls]+=1; assertion_non_null_by_provider[pid]+=1
 if not is_explicit(a):
  continue
 assertion_by_sourceclass[cls]+=1; assertion_by_provider[pid]+=1; assertion_scopes[str(a.get('scope') or '')]+=1
 assertion_prov_complete['complete' if s and s.get('raw_document_id') and s.get('content_hash') and a.get('source_content_hash') and a.get('raw_document_id') and a.get('acquisition_run_id') else 'incomplete']+=1
# source-class and provider attempts (include no-yield adapter attempts)
class_attempts=defaultdict(Counter)
for a in attempts:
 if a.get('source_class'):
  class_attempts[str(a['source_class'])][str(a.get('status') or '')]+=1
# statuses by provider for fetches plus source rows
# external source classes actually yielded
source_class_yield={k:sum(v['raw_source_rows'] for v in provider_summary.values() if v['source_class']==k) for k in sorted({v['source_class'] for v in provider_summary.values()})}
# before/after core coverage from existing analysis
before=read_json('docs/architecture/data/field-aware-refresh-20260911/analysis/field-coverage.json')
after=read_json(OUT/'field-coverage.json')
core=list(requested_fields)
before_after={}
for f in core:
 b=before['fields'].get(f,{})
 n=after['fields'].get(f,{})
 before_after[f]={
  'before':{'targets':b.get('target_count'),'explicit':b.get('explicit_value_count'),'extractable':b.get('state_counts',{}).get('SEMANTICALLY_EXTRACTABLE',0),'partial':b.get('state_counts',{}).get('PARTIAL',0),'ambiguous':b.get('state_counts',{}).get('AMBIGUOUS',0),'runtime_blocked':b.get('state_counts',{}).get('RUNTIME_BLOCKED',0),'no_evidence':b.get('state_counts',{}).get('NO_EVIDENCE',0),'programme_specific':b.get('programme_specific_explicit_count'),'current_cycle':b.get('current_cycle_explicit_count')},
  'after':{'targets':n.get('target_count'),'explicit':n.get('explicit_value_count'),'extractable':n.get('state_counts',{}).get('SEMANTICALLY_EXTRACTABLE',0),'partial':n.get('state_counts',{}).get('PARTIAL',0),'ambiguous':n.get('state_counts',{}).get('AMBIGUOUS',0),'runtime_blocked':n.get('state_counts',{}).get('RUNTIME_BLOCKED',0),'no_evidence':n.get('state_counts',{}).get('NO_EVIDENCE',0),'programme_specific':n.get('programme_specific_explicit_count'),'current_cycle':n.get('current_cycle_explicit_count')},
 }
# hierarchy useful activation summary
before_h=read_json('docs/architecture/data/field-aware-refresh-20260911/analysis/hierarchical-evaluation.json')
after_h=read_json(OUT/'hierarchical-evaluation.json')
def hsummary(h):
 out={}
 for f,v in h.get('fields',{}).items():
  if f in core or v.get('activated_by_level'):
   out[f]={'direct_coverage':v.get('direct_coverage'),'activated_by_level':v.get('activated_by_level',{}),'abstention_count':v.get('abstention_count'),'target_count':v.get('target_count'),'uncertainty_by_level':v.get('uncertainty_by_level',{}),'support_counts':v.get('support_counts',[]),'donor_dispersion':v.get('donor_dispersion',{}),'conflict_rate':v.get('conflict_rate',0)}
 return out
# Provider routing field groups and attempts.  An acquisition intent carries the
# complete requested group set for an entity; it is not the provider-specific
# routing decision.  Attribute a fetch only to the groups on its candidate so
# the report does not claim that a taxonomy fetch attempted every finance or
# language field.
fetch_by_field_group=defaultdict(Counter)
candidate_by_provider_group=defaultdict(Counter)
for c in candidates:
 pid=c.get('provider_id') or 'unidentified'
 for g in tuple(c.get('expected_field_groups') or ()):
  candidate_by_provider_group[(pid,str(g))]['candidates'] += 1
for f in fetches:
 c=candidate_by_id.get(str(f.get('candidate_id')), {})
 groups=tuple(c.get('expected_field_groups') or ())
 pid=f.get('provider_id') or c.get('provider_id') or 'unidentified'
 # A missing candidate record is retained as an explicit unknown rather than
 # falling back to the entity-wide intent fields.
 if not groups:
  fetch_by_field_group[(pid,'unknown')][str(f.get('status') or '')]+=1
 else:
  for g in groups: fetch_by_field_group[(pid,str(g))][str(f.get('status') or '')]+=1
# actual event acquisition time/durations not available from events; use metrics
metrics=read_json(RUN/'coverage_report.json').get('metrics',{})
# invariants
search_assertions=[a for a in raw_assertions if str(a.get('source_type') or '').casefold() in {'search','search_snippet','search_discovery'}]
archive_sources=[s for s in sources if s.get('source_class')=='archive']
archive_current_promotions=[a for a in assertions if (a.get('source_url') in {s.get('url') for s in archive_sources}) and str(a.get('temporal_state') or '').upper() not in {'HISTORICAL','UNKNOWN'}]
heavy_local=[p for p in (RUN/'raw').rglob('*') if p.is_file() and p.stat().st_size>8*1024*1024]
result={
 'run_id':'routed-refresh-20260912','population':{'institutions':len(manifest.get('institution_ids',[])),'targets_frozen':int(manifest.get('target_count') or 0),'programmes_live':metrics.get('programmes_discovered'),'countries':list(manifest.get('countries') or [])},
 'requested_fields':core,'provider_groups_requested':list(provider_groups),'registry_adapter_ids':registry_ids,
 'providers':provider_summary,
 'routing':{
  'field_to_provider_groups':field_map,
  'provider_group_to_fields':{g:[f for f,gs in field_map.items() if g in gs] for g in provider_groups},
  'candidate_count_by_provider_field_group':{f'{p}|{g}':int(v['candidates']) for (p,g),v in candidate_by_provider_group.items()},
  'fetch_status_by_provider_field_group':{f'{p}|{g}':dict(c) for (p,g),c in fetch_by_field_group.items()},
 },
 'source_contribution':{'retained_sources':len(sources),'source_rows_by_class':dict(Counter(str(s.get('source_class') or 'unclassified') for s in sources)),'source_rows_by_provider':dict(Counter(str(s.get('provider_id') or 'official_web') for s in sources)),'assertions_by_source_class':dict(assertion_by_sourceclass),'assertions_by_provider':dict(assertion_by_provider),'non_null_assertions_by_source_class':dict(assertion_non_null_by_sourceclass),'non_null_assertions_by_provider':dict(assertion_non_null_by_provider),'assertion_scopes':dict(assertion_scopes),'assertion_provenance_join':dict(assertion_prov_complete)},
 'attempts':{'by_source_class':{k:dict(v) for k,v in class_attempts.items()},'source_ecosystem_fetches':len(fetches),'statuses':dict(Counter(str(x.get('status') or '') for x in fetches))},
 'runtime_metrics':metrics,
 'before_after_core_fields':before_after,
 'hierarchical_evaluation':{'before':hsummary(before_h),'after':hsummary(after_h),'after_assertions_supplied':after_h.get('assertions_supplied')},
 'invariants':{'search_snippet_assertions':len(search_assertions),'archive_sources':len(archive_sources),'archive_current_truth_promotions':len(archive_current_promotions),'heavy_local_files_over_8MiB':len(heavy_local),'max_local_temp_bytes':config.limits.max_local_temp_bytes,'llm_provider_calls':metrics.get('provider_stats',{}).get('calls')},
 'interpretation':{'external_field_valued_assertions':sum(v['field_valued_assertions'] for v in provider_summary.values()),'external_non_null_assertions':sum(v['field_valued_non_null_assertions'] for v in provider_summary.values()),'external_sources_persisted':sum(v['raw_source_rows'] for v in provider_summary.values()),'external_sources_selected_for_semantic_input':sum(v['selection_selected'] for v in provider_summary.values()),'institution_scope_external_sources':sum(1 for s in sources if s.get('provider_id') and str(s.get('source_resolution') or '').casefold()=='institution'),'programme_scope_external_sources':sum(1 for s in sources if s.get('provider_id') and str(s.get('source_resolution') or '').casefold()=='programme')}
}
(OUT/'provider-routing-summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'providers':len(provider_summary),'sources':len(sources),'fetches':len(fetches),'external_assertions':result['interpretation']['external_field_valued_assertions'],'assertions_by_source_class':dict(assertion_by_sourceclass),'registry':registry_ids},ensure_ascii=False,indent=2))
