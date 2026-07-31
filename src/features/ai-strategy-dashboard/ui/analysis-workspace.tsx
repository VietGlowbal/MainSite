'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApplicantAnalysis, CourseMatchAnalysis } from '../domain';
import { ApplicantAnalysisReport } from './applicant-analysis-report';
import { CourseMatchReport } from './course-match-report';
import { Button } from '@/shared/ui';

/** requirements.md 5.1 — cycled while both reports are generating. */
const LOADING_MESSAGES = [
  'Analysing profile...',
  'Understanding achievements...',
  'Comparing against course...',
  'Building recommendations...',
] as const;

type LoadState = 'checking' | 'generating' | 'ready' | 'error';

/**
 * `/ai-strategy/[applicationId]/strategy/analysis` — Stage 3 (requirements.md
 * Requirement 5-7).
 *
 * On mount: read whatever's already stored for this application; generate
 * whichever of the two reports is missing; render both once both exist.
 * Course Match generation POSTs to the pre-existing
 * `/api/applications/[id]/match-insights` endpoint rather than a new one —
 * see the note on `strategy/course-match/route.ts`.
 */
export function AnalysisWorkspace({
  applicationId,
  improveHref,
}: {
  applicationId: string;
  improveHref: string;
}) {
  const [state, setState] = useState<LoadState>('checking');
  const [applicant, setApplicant] = useState<ApplicantAnalysis | null>(null);
  const [courseMatch, setCourseMatch] = useState<CourseMatchAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const ran = useRef(false);

  useEffect(() => {
    if (state !== 'generating') return;
    const timer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void run();

    async function run() {
      try {
        const [applicantRes, matchRes] = await Promise.all([
          fetch(`/api/applications/${applicationId}/strategy/applicant-analysis`),
          fetch(`/api/applications/${applicationId}/strategy/course-match`),
        ]);
        const applicantJson = await applicantRes.json();
        const matchJson = await matchRes.json();

        const needsApplicant = !applicantJson.analysis;
        const needsMatch = !matchJson.analysis;

        if (!needsApplicant && !needsMatch) {
          setApplicant(mapApplicant(applicantJson.analysis));
          setCourseMatch(matchJson.analysis);
          setState('ready');
          return;
        }

        setState('generating');

        const [applicantFinal, matchFinal] = await Promise.all([
          needsApplicant
            ? fetch(`/api/applications/${applicationId}/strategy/applicant-analysis`, {
                method: 'POST',
              }).then((r) => r.json())
            : Promise.resolve(applicantJson),
          needsMatch
            ? fetch(`/api/applications/${applicationId}/match-insights`, { method: 'POST' }).then(
                (r) => r.json(),
              )
            : Promise.resolve(matchJson),
        ]);

        if (applicantFinal.error || matchFinal.error) {
          setError(applicantFinal.error || matchFinal.error);
          setState('error');
          return;
        }

        setApplicant(mapApplicant(applicantFinal.analysis));

        // The match-insights POST returns the raw stored row, not the
        // reshaped view — re-read through our own GET so both paths agree.
        const reshaped = needsMatch
          ? await fetch(`/api/applications/${applicationId}/strategy/course-match`).then((r) =>
              r.json(),
            )
          : matchJson;
        setCourseMatch(reshaped.analysis);
        setState('ready');
      } catch {
        setError('Something went wrong. Please try again.');
        setState('error');
      }
    }
  }, [applicationId]);

  if (state === 'checking') return null;

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-gb-lg py-gb-7xl text-center">
        <p className="text-gb-md text-fg-error">{error ?? 'Analysis failed.'}</p>
        <Button
          onClick={() => {
            ran.current = false;
            setState('checking');
            setError(null);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (state === 'generating') {
    return (
      <div className="flex flex-col items-center gap-gb-lg py-gb-7xl text-center">
        <p className="text-gb-lg font-semibold text-fg">{LOADING_MESSAGES[messageIndex]}</p>
        <p className="text-gb-sm text-fg-tertiary">This usually takes 30–60 seconds.</p>
      </div>
    );
  }

  if (!applicant || !courseMatch) return null;

  return (
    <div className="flex flex-col gap-gb-3xl">
      <ApplicantAnalysisReport analysis={applicant} />
      <CourseMatchReport analysis={courseMatch} onImproveHref={improveHref} />
    </div>
  );
}

/** The applicant-analysis API returns the raw DB row (snake_case); map it. */
function mapApplicant(row: Record<string, unknown> | null): ApplicantAnalysis | null {
  if (!row) return null;
  return {
    id: row.id as string,
    applicationId: row.application_id as string,
    profileVersion: row.profile_version as number,
    personalitySummary: (row.personality_summary as string) ?? null,
    learningStyle: (row.learning_style as string[]) ?? [],
    academicStrengths: (row.academic_strengths as string[]) ?? [],
    growthAreas: (row.growth_areas as string[]) ?? [],
    motivationAnalysis: (row.motivation_analysis as string) ?? null,
    competitiveAdvantages: (row.competitive_advantages as string[]) ?? [],
    suggestedPositioning: (row.suggested_positioning as string) ?? null,
    overallRating: (row.overall_rating as number) ?? null,
    inputsPresent: (row.inputs_present as ApplicantAnalysis['inputsPresent']) ?? {
      personalSummary: false,
      achievements: false,
      evidence: false,
    },
    modelName: (row.model_name as string) ?? null,
    promptVersion: (row.prompt_version as string) ?? null,
    createdAt: row.created_at as string,
  };
}
