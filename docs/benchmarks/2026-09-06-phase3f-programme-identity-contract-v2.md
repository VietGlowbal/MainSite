# Phase 3F Programme Identity Contract v2

Status: **APPROVED — frozen as part of Benchmark V3**
Version: `phase3f-programme-identity-contract-v2`
Approved: `2026-09-06`

## 1. Purpose

Define a structured, evidence-first identity representation for benchmark
adjudication and deterministic comparison. This candidate does not modify frozen
GT v2, scorer v1, pipeline behavior, or official runs.

## 2. Terminology and ontology

The identity object distinguishes `INSTITUTION`, `SCHOOL`, `FACULTY`,
`DEPARTMENT`, `PROGRAMME`, `MAJOR`, `TRACK`, `CONCENTRATION`,
`SPECIALIZATION`, `DEGREE_PROGRAMME`, `JOINT_PROGRAMME`, `DUAL_DEGREE`,
`DELIVERY_VARIANT`, `STAGE`, `PRE_MAJOR`, and `CREDENTIAL`. A source may
describe more than one layer; the object retains the layers instead of forcing
them into one display string.

## 3. Core definition

`programme_identity` is the evidence-supported academic entity being evaluated:
normally the named programme, major, concentration, or degree programme. It is
not automatically the institution, department, credential, delivery mode,
track, or stage. The benchmark target may be a child entity; that target is
encoded explicitly with `parent_programme` and `track`/`concentration`.

`institution_id` is structurally separate from the programme name. Institution
text may be retained as provenance or collision context, but arbitrary strings
such as `University X — Computer Science` are not canonical identity names.

## 4. Credential and degree-programme semantics

Credential is a separate structured component whenever evidence supports a
decomposition such as `Computer Science` + `B.S.` or `Computer Science` +
`Master of Science`. The exact source-native title is always retained.

If an official degree-programme title uses a credential phrase as part of its
registered name, the source-native name remains intact while the structured
credential component is populated when the evidence makes the decomposition
defensible. No credential is inferred from a programme name alone.

## 5. Programme, major, concentration, and track

A major or concentration may serve as the benchmark programme entity when the
official catalogue treats it as the named field of study for the target scope.
It is not automatically interchangeable with a department or school.

A track, concentration, specialization, or parent programme is a separate
hierarchical component. `Parent Programme` and `Track A` are not equal merely
because one title contains the other. The benchmark target must state whether it
is the parent or child entity.

## 6. Stages and pre-majors

`PRE_MAJOR`, `DECLARED_MAJOR`, `DIRECT_ADMISSION`, and
`POST_ADMISSION_TRACK` are stage values, not aliases. A pre-major pathway is not
silently collapsed into the later major. When the official structure describes a
pathway, the stage relationship is stored explicitly.

## 7. Joint and dual degrees

`JOINT_PROGRAMME` means one programme administered across institutions or
schools. `DUAL_DEGREE` means a dual-credential/dual-degree structure. A single
programme offering multiple credentials is distinct from both. Partner names
and degree variants are retained when materially part of the official identity.

## 8. Source-native and canonical identity

`source_native_identity` is the exact official naming from evidence.
`canonical_programme_identity` is a structured comparison name, with credential,
institution, parent/child, stage, and alias fields kept separately. Source-native
text is never discarded and model-generated translations are never canonical
truth by themselves.

## 9. Native-language and English aliases

Native official titles are valid source-native identities. An official English
title is an alias only when the institution publishes or explicitly identifies
it. A model-generated translation is a review candidate, not an accepted alias.
Every alias carries source provenance and an alias type (`native`, `official
English`, abbreviation, legacy, or other official alias).

## 10. Canonicalization rules

### SAFE_DETERMINISTIC

- case, whitespace, and punctuation normalization;
- separation of a credential component when the source structure supports it;
- official abbreviation expansion with provenance;
- official alias mapping with provenance;
- deterministic parent/track decomposition when the official source explicitly
  provides the relationship.

### CONTEXT_DEPENDENT

- degree-programme versus subject-programme decomposition;
- major versus programme selection;
- current versus legacy name;
- joint/dual-degree structure;
- stage/pre-major relationships;
- inherited parent/child scope.

### PROHIBITED_WITHOUT_REVIEW

- fuzzy title substitution;
- invented translations;
- dropping a track or joint partner;
- collapsing a department into a programme;
- treating a credential mismatch as harmless when it changes entity meaning;
- using roster labels as factual identity evidence.

## 11. Identity key and display names

Identity equality uses a structured key: institution, canonical programme entity,
entity type, parent/child relationship, credential scope, and stage where
material. Display names are presentation fields and cannot alone decide equality.

## 12. Equivalence and scorer implications

The candidate scorer distinguishes:

- `EXACT_EQUIVALENT`: deterministic surface normalization only;
- `CANONICALLY_EQUIVALENT`: structured fields match or an official alias maps;
- `PARENT_CHILD_RELATED_NOT_EQUIVALENT`: related hierarchy, not equal;
- `CREDENTIAL_VARIANT`: same programme with a separately supported credential
  variant;
- `ALIAS_EQUIVALENT`: official alias relationship;
- `NOT_EQUIVALENT`: incompatible entity or scope;
- `AMBIGUOUS`: official evidence does not select one canonical interpretation.

Fuzzy-only comparison can never PASS. Credential text appended to a programme
does not fail when the same credential is separately represented and the
programme component matches; it does fail or become ambiguous when the
credential changes the entity or scope. Parent and child entities are never
automatically equivalent.

## 13. Benchmark-pattern examples

- MIT course/degree titles retain Course numbers as programme identifiers while
  Bachelor/Master/SM text is structured as credential or official alias.
- Northwestern dual degrees retain `DUAL_DEGREE` and credential variants.
- UCLA Public Affairs retains the pre-major-to-major stage pathway.
- UTokyo Computer Science and ICE retain department and degree scope.
- Sorbonne Licence/MIND/SAR retain parent/track hierarchy.
- ETH Cyber Security retains the ETH–EPFL joint programme and Computer Science
  major/track relationship.
- Michigan Aerospace retains College of Engineering entry and post-acceptance
  major declaration.

## 14. Backward compatibility with v2

GT v2 strings, frozen hashes, scorer v1, and official runs remain immutable.
The v3 candidate is a schema evolution and representation restructuring, not a
claim that the v2 factual labels were wrong. A future freeze would need an
explicit migration map from v2 strings to structured v3 records.

## 15. Migration implications

Future runtime output should preserve source-native identity and expose a
structured identity candidate. The pipeline is not changed by this task. A
future scorer should compare structured records and report missing granularity
separately from factual mismatch.


## 16. Approved policy resolutions

1. Multiple official degree variants are represented as one structured academic
   entity only when the source establishes that relationship; credentials remain
   explicit variants. A case without a selected target variant is `AMBIGUOUS`.
2. Institution-specific concentration terminology remains its source ontology
   type unless official structure establishes a major/programme equivalence.
3. A track may inherit a parent only through explicit official relationship
   evidence. Parent and child are related, never automatically equivalent.
4. Legacy and current aliases require official provenance and temporal metadata;
   an undated or model-generated alias cannot establish current identity.

## 17. Ambiguity policy

`AMBIGUOUS` is a first-class identity comparison result. It is not a fuzzy pass
and is not a factual failure. An ambiguous identity result is excluded from the
concrete identity-precision numerator and denominator, reported separately, and
treated as unresolved for resolved-coverage reporting. The rule is generic and
applies to every case whose official evidence does not select one defensible
canonical entity; it is not a case-specific exception.

## 18. Approval and freeze boundary

The twelve human-queue cases were reviewed under this contract and recorded in
`docs/benchmarks/audits/2026-09-06-phase3f-programme-identity-contract-v2-human-review-log.jsonl`.
The final structured truth, scorer contract, and freeze manifest are versioned
Benchmark V3 artifacts. No runtime pipeline, provider, prompt, scorer v1, GT v2,
or official run artifact is changed by this approval.

## 16. Approved policy resolutions

1. Multiple official degree variants are represented as one structured academic
   entity only when the source establishes that relationship; credentials remain
   explicit variants. A case without a selected target variant is `AMBIGUOUS`.
2. Institution-specific concentration terminology remains its source ontology
   type unless official structure establishes a major/programme equivalence.
3. A track may inherit a parent only through explicit official relationship
   evidence. Parent and child are related, never automatically equivalent.
4. Legacy and current aliases require official provenance and temporal metadata;
   an undated or model-generated alias cannot establish current identity.

## 17. Ambiguity policy

`AMBIGUOUS` is a first-class identity comparison result. It is not a fuzzy pass
and is not a factual failure. An ambiguous identity result is excluded from the
concrete identity-precision numerator and denominator, reported separately, and
treated as unresolved for resolved-coverage reporting. The rule is generic and
applies to every case whose official evidence does not select one defensible
canonical entity; it is not a case-specific exception.

## 18. Approval and freeze boundary

The twelve human-queue cases were reviewed under this contract and recorded in
`docs/benchmarks/audits/2026-09-06-phase3f-programme-identity-contract-v2-human-review-log.jsonl`.
The final structured truth, scorer contract, and freeze manifest are versioned
Benchmark V3 artifacts. No runtime pipeline, provider, prompt, scorer v1, GT v2,
or official run artifact is changed by this approval.

## 16. Approved policy resolutions

1. Multiple official degree variants are represented as one structured academic
   entity only when the source establishes that relationship; credentials remain
   explicit variants. A case without a selected target variant is `AMBIGUOUS`.
2. Institution-specific concentration terminology remains its source ontology
   type unless official structure establishes a major/programme equivalence.
3. A track may inherit a parent only through explicit official relationship
   evidence. Parent and child are related, never automatically equivalent.
4. Legacy and current aliases require official provenance and temporal metadata;
   an undated or model-generated alias cannot establish current identity.

## 17. Ambiguity policy

`AMBIGUOUS` is a first-class identity comparison result. It is not a fuzzy pass
and is not a factual failure. An ambiguous identity result is excluded from the
concrete identity-precision numerator and denominator, reported separately, and
treated as unresolved for resolved-coverage reporting. The rule is generic and
applies to every case whose official evidence does not select one defensible
canonical entity; it is not a case-specific exception.

## 18. Approval and freeze boundary

The twelve human-queue cases were reviewed under this contract and recorded in
`docs/benchmarks/audits/2026-09-06-phase3f-programme-identity-contract-v2-human-review-log.jsonl`.
The final structured truth, scorer contract, and freeze manifest are versioned
Benchmark V3 artifacts. No runtime pipeline, provider, prompt, scorer v1, GT v2,
or official run artifact is changed by this approval.
