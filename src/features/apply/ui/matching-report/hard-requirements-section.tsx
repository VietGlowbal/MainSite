'use client';

import { useT } from '@/lib/i18n';
import { Badge } from '@/shared/ui';
import { V3ReferenceList, formatV3Identifier, type V3EvidenceItem, type V3TargetSource } from './v3-report-details';

export type RequirementItem = {
  id: string;
  label: string;
  status: 'met' | 'not_met' | 'unknown' | 'not_applicable';
  statusLabel?: string;
  explanation?: string | null;
  blocking?: boolean;
  kind?: string;
  deadlineStatus?: 'open' | 'passed' | 'unknown';
  applicantValue?: string | number | null;
  requiredValue?: string | number | null;
  evidenceIds?: string[];
  targetSourceRefs?: string[];
  evidenceIndex?: V3EvidenceItem[];
  targetSourceIndex?: V3TargetSource[];
};

type HardRequirementsSectionProps = {
  requirements: RequirementItem[];
  courseRequirementsText?: string | null;
  englishRequirementsText?: string | null;
  officialCourseUrl?: string | null;
};

export function HardRequirementsSection({
  requirements,
  courseRequirementsText,
  englishRequirementsText,
  officialCourseUrl,
}: HardRequirementsSectionProps) {
  const t = useT();

  if (requirements.length === 0 && !courseRequirementsText && !englishRequirementsText) {
    return null;
  }

  return (
    <div className="flex flex-col gap-gb-md rounded-gb-2xl border border-line bg-surface p-gb-2xl shadow-xs">
      <div className="flex flex-col gap-gb-2xs">
        <h3 className="text-gb-sm font-bold text-fg">{t('Entry Requirements & Eligibility Checks')}</h3>
        <p className="text-gb-xs text-fg-tertiary">
          {t(
            'Whether you can apply at all, which is a deterministic check separate from your competitive alignment score.',
          )}
        </p>
      </div>

      <div className="mt-gb-sm grid gap-gb-md sm:grid-cols-2 lg:grid-cols-3">
        {requirements.map((req) => (
          <div
            key={req.id}
            className={`flex flex-col justify-between gap-gb-xs rounded-gb-xl border p-gb-md ${
              req.status === 'not_met' || req.blocking
                ? 'border-rose-200 bg-rose-50/40'
                : 'border-line bg-surface-subtle/40'
            }`}
          >
            <div className="flex items-start justify-between gap-gb-sm">
              <span className="text-gb-sm font-semibold text-fg">{t(req.label)}</span>
              <Badge
                variant={
                  req.status === 'met'
                    ? 'safe-chip'
                    : req.status === 'not_met' || req.blocking
                      ? 'reach'
                      : 'neutral-chip'
                }
              >
                {t(req.statusLabel || (req.status === 'met' ? 'Met' : req.status === 'not_met' ? 'Not met' : 'We could not check this'))}
              </Badge>
            </div>
            {req.kind || req.deadlineStatus || req.applicantValue !== undefined || req.requiredValue !== undefined ? (
              <div className="grid grid-cols-1 gap-1 text-[11px] text-fg-secondary">
                {req.kind ? <span><strong className="text-fg">{t('Requirement type')}:</strong> {formatV3Identifier(req.kind)}</span> : null}
                {req.applicantValue !== undefined ? (
                  <span><strong className="text-fg">{t('Applicant value')}:</strong> {req.applicantValue === null ? t('Not provided') : String(req.applicantValue)}</span>
                ) : null}
                {req.requiredValue !== undefined ? (
                  <span><strong className="text-fg">{t('Required value')}:</strong> {req.requiredValue === null ? t('Not specified') : String(req.requiredValue)}</span>
                ) : null}
                {req.deadlineStatus ? (
                  <span><strong className="text-fg">{t('Deadline status')}:</strong> {t(req.deadlineStatus === 'open' ? 'Open' : req.deadlineStatus === 'passed' ? 'Passed' : 'Unknown')}</span>
                ) : null}
              </div>
            ) : null}
            {req.explanation ? (
              <p className="text-[11px] leading-relaxed text-fg-secondary">{req.explanation}</p>
            ) : null}
            <V3ReferenceList
              evidenceIds={req.evidenceIds}
              targetSourceRefs={req.targetSourceRefs}
              evidenceIndex={req.evidenceIndex}
              targetSourceIndex={req.targetSourceIndex}
            />
          </div>
        ))}
      </div>

      {(courseRequirementsText || englishRequirementsText || officialCourseUrl) && (
        <div className="mt-gb-sm flex flex-col gap-gb-xs border-t border-line/60 pt-gb-md text-gb-xs text-fg-tertiary">
          {courseRequirementsText ? (
            <p>
              <strong className="text-fg">{t('Published requirements')}:</strong> {courseRequirementsText}
            </p>
          ) : null}
          {englishRequirementsText ? (
            <p>
              <strong className="text-fg">{t('English requirements')}:</strong> {englishRequirementsText}
            </p>
          ) : null}
          {officialCourseUrl ? (
            <a
              href={officialCourseUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-gb-2xs w-fit text-brand font-semibold hover:underline"
            >
              {t('Check official course page →')}
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
