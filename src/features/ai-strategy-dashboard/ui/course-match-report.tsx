import type { CourseMatchAnalysis, CourseMatchSubScore } from '../domain';
import { Badge, Panel, ScoreRing } from '@/shared/ui';

function SubScoreRow({ subScore }: { subScore: CourseMatchSubScore }) {
  return (
    <div className="flex items-center justify-between gap-gb-lg border-t border-line py-gb-lg first:border-t-0 first:pt-0">
      <p className="text-gb-sm font-medium text-fg">{subScore.label}</p>
      <p className="text-gb-sm font-semibold text-fg-brand">{subScore.score}%</p>
    </div>
  );
}

/**
 * Report 2 — Course Match Analysis (requirements.md Requirement 7).
 *
 * Reads a `CourseMatchAnalysis` already reshaped by
 * `domain/course-match.ts#deriveCourseMatchAnalysis` from the existing
 * match-insights pillar scores — this component does no scoring itself.
 */
export function CourseMatchReport({
  analysis,
  onImproveHref,
}: {
  analysis: CourseMatchAnalysis;
  onImproveHref: string;
}) {
  return (
    <Panel className="flex flex-col gap-gb-3xl">
      <div className="flex items-center justify-between gap-gb-xl">
        <div>
          <p className="text-gb-sm font-semibold text-fg-brand">Report 2</p>
          <h2 className="font-display text-gb-display-xs font-semibold text-fg">
            Course Match Analysis
          </h2>
        </div>
        <ScoreRing value={analysis.overallMatchPercent} measure="match" label="Overall Match" />
      </div>

      <div className="flex flex-col">
        <SubScoreRow subScore={analysis.entryRequirementMatch} />
        <SubScoreRow subScore={analysis.experienceMatch} />
        <SubScoreRow subScore={analysis.personalQualitiesMatch} />
      </div>

      {analysis.missingAreas.length > 0 ? (
        <div className="flex flex-col gap-gb-xs">
          <p className="text-gb-sm font-semibold text-fg">Missing Areas</p>
          <ul className="flex flex-wrap gap-gb-xs">
            {analysis.missingAreas.map((area) => (
              <li key={area}>
                <Badge variant="reach">{area}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {analysis.admissionsRisk.length > 0 ? (
        <div className="flex flex-col gap-gb-xs">
          <p className="text-gb-sm font-semibold text-fg">Admissions Risk Analysis</p>
          <ul className="flex flex-col gap-gb-xs text-gb-sm text-fg-tertiary">
            {analysis.admissionsRisk.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-gb-lg">
        <p className="text-gb-sm text-fg-tertiary">
          Admissions Confidence: {analysis.admissionsConfidence}%
        </p>
        <a
          href={onImproveHref}
          className="text-gb-sm font-semibold text-fg-brand hover:underline"
        >
          Improve My Chances with AI
        </a>
      </div>
    </Panel>
  );
}
