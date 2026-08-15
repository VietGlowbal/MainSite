'use client';

import { useT } from '@/lib/i18n';
import type { PersonalReportTrigger, PersonalReportVersionSummary } from '../../domain';
import { Select } from '@/shared/ui';

const TRIGGER_LABEL: Record<PersonalReportTrigger, string> = {
  manual: 'Manual update',
  matching_report: 'Updated with your Matching Report',
  supplement_answer: 'Updated after you answered a question',
};

function formatVersionLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  version: PersonalReportVersionSummary,
  isLatest: boolean,
): string {
  const date = version.generatedAt
    ? new Date(version.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  const reason = t(TRIGGER_LABEL[version.trigger] ?? TRIGGER_LABEL.manual);
  return isLatest ? `${date} · ${t('Latest')} · ${reason}` : `${date} · ${reason}`;
}

export function VersionHistoryPicker({
  versions,
  selectedVersionId,
  latestVersionId,
  disabled,
  onSelect,
}: {
  versions: PersonalReportVersionSummary[];
  selectedVersionId: string | null;
  latestVersionId: string | null;
  disabled: boolean;
  onSelect: (versionId: string) => void;
}) {
  const t = useT();
  if (versions.length < 2) return null;
  return (
    <Select
      name="personal-report-version"
      label={t('Version history')}
      value={selectedVersionId ?? ''}
      disabled={disabled}
      onChange={(event) => onSelect(event.target.value)}
      fieldClassName="w-full max-w-sm"
    >
      {versions.map((version) => (
        <option key={version.id} value={version.id}>
          {formatVersionLabel(t, version, version.id === latestVersionId)}
        </option>
      ))}
    </Select>
  );
}
