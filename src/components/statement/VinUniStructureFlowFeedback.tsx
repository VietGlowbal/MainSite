'use client';

import { useT } from '@/lib/i18n';
import type {
  EvidenceRef,
  ReviewClaim,
  StructureCriterionAssessment,
  StructureFlowMap,
  StructureFlowReview,
} from '@/lib/ai/vinuni-evaluation-v2';

type Props = {
  review: StructureFlowReview;
  map: StructureFlowMap;
  onEvidenceSelect?: (claim: ReviewClaim) => void;
  activeClaimKeys?: string[];
};

function claimKey(claim: ReviewClaim) {
  return [
    claim.id,
    claim.text,
    ...claim.evidenceRefs.map(({ source, id }) => `${source}:${id}`),
  ].join('\u001f');
}

function Claim({
  claim,
  onEvidenceSelect,
  activeClaimKeys,
}: {
  claim: ReviewClaim | null;
  onEvidenceSelect?: (claim: ReviewClaim) => void;
  activeClaimKeys: ReadonlySet<string>;
}) {
  const t = useT();
  if (!claim) return <p className="text-sm italic leading-6 text-slate-500">{t('Not established from the current draft')}</p>;
  const active = activeClaimKeys.has(claimKey(claim));
  return (
    <button
      type="button"
      disabled={!onEvidenceSelect || !claim.evidenceRefs.length}
      onClick={() => onEvidenceSelect?.(claim)}
      className={`block w-full rounded-xl p-3 text-left text-sm leading-6 transition-colors disabled:cursor-default ${
        active ? 'bg-amber-100 text-amber-950' : 'bg-slate-50 text-slate-700 hover:bg-rose-50'
      }`}
    >
      {claim.text}
    </button>
  );
}

function EvidenceLabel({ refs }: { refs: EvidenceRef[] }) {
  if (!refs.length) return null;
  return (
    <span className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {refs.map(({ source, id }) => `${source}:${id}`).join(' · ')}
    </span>
  );
}

function CriterionCard({
  criterion,
  onEvidenceSelect,
  activeClaimKeys,
}: {
  criterion: StructureCriterionAssessment;
  onEvidenceSelect?: (claim: ReviewClaim) => void;
  activeClaimKeys: ReadonlySet<string>;
}) {
  const t = useT();
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="font-semibold text-slate-950">{t(criterion.label)}</h4>
        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {t(criterion.severity.replace('_', ' '))}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {[
          ['Strength', criterion.strength],
          ['Weakness', criterion.weakness],
          ['Why it matters', criterion.whyItMatters],
          ['Improvement direction', criterion.improvement],
        ].map(([label, claim]) => (
          <div key={String(label)}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t(label as string)}</p>
            <Claim
              claim={claim as ReviewClaim | null}
              onEvidenceSelect={onEvidenceSelect}
              activeClaimKeys={activeClaimKeys}
            />
            <EvidenceLabel refs={claim ? (claim as ReviewClaim).evidenceRefs : criterion.evidenceRefs} />
          </div>
        ))}
      </div>
    </article>
  );
}

export function VinUniStructureFlowFeedback({
  review,
  map,
  onEvidenceSelect,
  activeClaimKeys = [],
}: Props) {
  const t = useT();
  const active = new Set(activeClaimKeys);
  const units = new Map(map.narrativeUnits.map((unit) => [unit.id, unit]));
  const unitLabel = (id: string) => units.get(id)?.label ?? id;
  const criteria = Object.values(review.criteria);
  const dimensions = [
    ['Responsibility', review.evolution.responsibility],
    ['Problem complexity', review.evolution.problemComplexity],
    ['Thinking', review.evolution.thinking],
    ['Approach', review.evolution.approach],
    ['Identity', review.evolution.identity],
  ] as const;
  const ending = [
    ['Past evidence', review.endingProgression.pastEvidence],
    ['Key learning', review.endingProgression.keyLearning],
    ['Current direction', review.endingProgression.currentDirection],
    ['Capability gap', review.endingProgression.capabilityGap],
    ['Next step', review.endingProgression.nextStep],
    ['Long-term aspiration', review.endingProgression.longTermAspiration],
  ] as const;

  return (
    <div data-testid="structure-flow-feedback" className="space-y-5">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 md:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-600">{t('Actual narrative architecture')}</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-950">{t('How this draft is built')}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">{review.narrativeOverview.architectureSummary}</p>
        {review.narrativeOverview.corePurpose ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            <strong className="text-slate-950">{t('Core purpose')}: </strong>
            {review.narrativeOverview.corePurpose}
          </p>
        ) : null}
        <ol data-testid="narrative-map" className="mt-5 space-y-3">
          {map.narrativeUnits.map((unit, index) => (
            <li key={unit.id}>
              <button
                type="button"
                onClick={() =>
                  onEvidenceSelect?.({
                    id: `unit-${unit.id}`,
                    text: unit.summary,
                    evidenceRefs: unit.evidenceIds.map((id) => ({ source: 'essay', id }) as EvidenceRef),
                    priority: 'low',
                  })
                }
                className="grid w-full gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-rose-200 md:grid-cols-[38px_150px_1fr]"
              >
                <span className="text-sm font-semibold tabular-nums text-rose-700">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t(unit.type.replaceAll('_', ' '))}</span>
                  <span className="mt-1 block font-semibold text-slate-950">{unit.label}</span>
                </span>
                <span className="text-sm leading-6 text-slate-700">{unit.summary}</span>
              </button>
            </li>
          ))}
        </ol>
        {map.links.length ? (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('Observed links')}</p>
            <div className="flex flex-wrap gap-2">
              {map.links.map((link) => (
                <span key={`${link.fromUnitId}-${link.toUnitId}`} className="rounded-full bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                  {unitLabel(link.fromUnitId)} → {unitLabel(link.toUnitId)} · {t(link.relationship)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {map.possibleMultipleThreads || map.unresolvedStructureQuestions.length ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm leading-6 text-amber-950">
            {map.possibleMultipleThreads ? <p>{t('The draft may contain more than one narrative thread.')}</p> : null}
            {map.unresolvedStructureQuestions.map((question) => <p key={question}>{question}</p>)}
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="mb-3 text-xl font-semibold text-slate-950">{t('Seven structure criteria')}</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {criteria.map((criterion) => (
            <CriterionCard key={criterion.key} criterion={criterion} onEvidenceSelect={onEvidenceSelect} activeClaimKeys={active} />
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 md:p-6">
        <h3 className="text-xl font-semibold text-slate-950">{t('Transitions and continuity')}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t('Each transition is checked for logical, causal, thematic, and personal continuity.')}</p>
        <div className="mt-4 space-y-3">
          {review.transitions.length ? review.transitions.map((transition) => (
            <article key={transition.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="font-semibold text-slate-950">{unitLabel(transition.fromUnitId)} → {unitLabel(transition.toUnitId)}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {[
                  ['Logical', transition.logical],
                  ['Causal', transition.causal],
                  ['Thematic', transition.thematic],
                  ['Personal', transition.personal],
                ].map(([label, status]) => <span key={label} className="rounded-lg bg-white px-2 py-2 text-center text-xs text-slate-600">{t(label as string)}: <strong>{t(status as string)}</strong></span>)}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{transition.diagnosis}</p>
              {transition.missingBridge || transition.improvement ? <p className="mt-2 text-sm leading-6 text-rose-700">{transition.improvement ?? transition.missingBridge}</p> : null}
            </article>
          )) : <p className="text-sm italic text-slate-500">{t('No explicit transitions were established from the current draft.')}</p>}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 md:p-6">
        <h3 className="text-xl font-semibold text-slate-950">{t('Development and evolution')}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {dimensions.map(([label, dimension]) => (
            <article key={label} className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-slate-950">{t(label)}</h4>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t(dimension.status.replaceAll('_', ' '))}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{dimension.summary}</p>
              {dimension.missingStep ? <p className="mt-2 text-sm leading-6 text-rose-700">{dimension.missingStep}</p> : null}
              <EvidenceLabel refs={dimension.evidenceRefs} />
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 md:p-6">
        <h3 className="text-xl font-semibold text-slate-950">{t('Important moments and depth')}</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {review.importantMoments.length ? review.importantMoments.map((moment) => (
            <article key={moment.id} className="rounded-xl border border-slate-100 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">{unitLabel(moment.unitId)}</p>
              <h4 className="mt-1 font-semibold text-slate-950">{moment.title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-700">{moment.whyImportant}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                {Object.entries(moment.levels).map(([level, status]) => <span key={level} className="rounded-lg bg-slate-50 px-2 py-2">{t(level)}: <strong>{t(status)}</strong></span>)}
              </div>
              <p className="mt-3 text-sm leading-6 text-rose-700">{moment.improvement}</p>
              <EvidenceLabel refs={moment.evidenceRefs} />
            </article>
          )) : <p className="text-sm italic text-slate-500">{t('No important moment was established from the current draft.')}</p>}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 md:p-6">
        <h3 className="text-xl font-semibold text-slate-950">{t('Focus and narrative balance')}</h3>
        <div className="mt-4 space-y-3">
          {review.balanceAnalysis.units.map((unit) => (
            <div key={unit.unitId} className="grid gap-2 rounded-xl bg-slate-50 p-4 md:grid-cols-[1fr_100px_1fr] md:items-center">
              <div><p className="font-semibold text-slate-950">{unitLabel(unit.unitId)}</p><p className="text-sm text-slate-600">{unit.function}</p></div>
              <p className="text-sm tabular-nums text-slate-700">{unit.wordCount} {t('words')} · {unit.share}%</p>
              <p className="text-sm leading-6 text-slate-600">{unit.narrativePurpose} · {t(unit.imbalance)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ['Strength', review.balanceAnalysis.strength],
            ['Weakness', review.balanceAnalysis.weakness],
            ['Why it matters', review.balanceAnalysis.whyItMatters],
            ['Improvement direction', review.balanceAnalysis.improvement],
          ].map(([label, claim]) => <div key={String(label)}><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t(label as string)}</p><Claim claim={claim as ReviewClaim | null} onEvidenceSelect={onEvidenceSelect} activeClaimKeys={active} /></div>)}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 md:p-6">
        <h3 className="text-xl font-semibold text-slate-950">{t('Ending and forward progression')}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ending.map(([label, node]) => <article key={label} className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold text-slate-950">{t(label)}</h4><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t(node.status)}</span></div><p className="mt-2 text-sm leading-6 text-slate-700">{node.text ?? t('Not established from the current draft')}</p><EvidenceLabel refs={node.evidenceRefs} /></article>)}
        </div>
        {review.endingProgression.missingLinks.length ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm leading-6 text-amber-950">{review.endingProgression.missingLinks.map((link) => <p key={link}>{link}</p>)}</div> : null}
      </section>

      <section className="rounded-[1.5rem] border border-rose-200 bg-rose-50/50 p-5 md:p-6">
        <h3 className="text-xl font-semibold text-slate-950">{t('Prioritised improvements')}</h3>
        <div className="mt-4 space-y-4">
          {review.priorities.map((priority) => <article key={priority.rank} className="rounded-xl border border-white bg-white p-4"><div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">{priority.rank}</span><div><h4 className="font-semibold text-slate-950">{priority.title}</h4><p className="mt-2 text-sm leading-6 text-slate-700"><strong>{t('What to improve')}: </strong>{priority.whatToImprove}</p><p className="mt-1 text-sm leading-6 text-slate-700"><strong>{t('Why it matters')}: </strong>{priority.whyItMatters}</p><p className="mt-1 text-sm leading-6 text-rose-700"><strong>{t('Specific direction')}: </strong>{priority.specificDirection}</p>{priority.exampleOrTemplate ? <p className="mt-1 text-sm leading-6 text-slate-600"><strong>{t('Example or template')}: </strong>{priority.exampleOrTemplate}</p> : null}<EvidenceLabel refs={priority.evidenceRefs} /></div></div></article>)}
        </div>
      </section>
    </div>
  );
}
