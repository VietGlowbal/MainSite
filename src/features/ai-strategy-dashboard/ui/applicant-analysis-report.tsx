import type { ApplicantAnalysis } from '../domain';
import { APPLICANT_ANALYSIS_SECTIONS, hasSectionContent } from '../domain';
import { Badge, Panel, ScoreRing } from '@/shared/ui';

/**
 * Report 1 — Personal Applicant Analysis (requirements.md Requirement 6).
 *
 * Iterates `APPLICANT_ANALYSIS_SECTIONS` rather than hardcoding each field, so
 * a new section is added in the domain module, not duplicated here.
 */
export function ApplicantAnalysisReport({ analysis }: { analysis: ApplicantAnalysis }) {
  const sections = APPLICANT_ANALYSIS_SECTIONS.filter((section) =>
    hasSectionContent(analysis, section),
  );

  return (
    <Panel className="flex flex-col gap-gb-3xl">
      <div className="flex items-center justify-between gap-gb-xl">
        <div>
          <p className="text-gb-sm font-semibold text-fg-brand">Report 1</p>
          <h2 className="font-display text-gb-display-xs font-semibold text-fg">
            Personal Applicant Analysis
          </h2>
        </div>
        {analysis.overallRating != null ? (
          <ScoreRing value={analysis.overallRating} measure="match" label="Applicant Rating" />
        ) : null}
      </div>

      {sections.length === 0 ? (
        <p className="text-gb-sm text-fg-tertiary">
          Add more to your Personal Summary and Achievements for a fuller portrait.
        </p>
      ) : (
        <div className="grid gap-gb-2xl sm:grid-cols-2">
          {sections.map((section) => {
            const value = analysis[section.key];
            return (
              <div key={section.key} className="flex flex-col gap-gb-xs">
                <p className="text-gb-sm font-semibold text-fg">{section.label}</p>
                {section.kind === 'list' && Array.isArray(value) ? (
                  <ul className="flex flex-wrap gap-gb-xs">
                    {value.map((item) => (
                      <li key={item}>
                        <Badge variant="brand-subtle">{item}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gb-sm text-fg-tertiary">{String(value ?? '')}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
