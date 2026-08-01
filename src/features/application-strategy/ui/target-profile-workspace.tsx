'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/shared/ui';
import {
  TARGET_PROFILE_FIELDS,
  TARGET_PROFILE_FIELD_DEFS,
  type CvTargetProfile,
  type TargetProfileField,
} from '../domain';
import { useAutosave } from '../hooks/use-autosave';
import { AutosaveStatus } from './autosave-status';
import { CvSteps } from './cv-steps';
import { OriginBadge } from './origin-badge';
import { StrategyPanel } from './panel';
import { GeneratingState, NoProgrammeDataState, StateBlock } from './states';

/**
 * "Xác định CV cần chứng minh những điều gì" — CV step 1.
 *
 * WHY THE UNGENERATED AND GENERATED STATES SHARE ONE LAYOUT. The page does not
 * rearrange itself when content arrives: the seven cards are in the same places,
 * the same size, in the same order. A student who has just pressed generate is
 * reading new content, and having to relearn the page at the same time is what
 * makes generated output feel like it came from somewhere else. The only
 * differences are that the placeholder examples are replaced by real values and
 * the origin badges appear.
 *
 * WHY REGENERATION IS A TEXT LINK. A prominent "Tạo lại" button teaches students
 * to reroll until they like the wording, which is the opposite of the intended
 * behaviour — these are meant to be edited, by them, into something they can
 * defend in an interview. So the primary action after generation is to continue,
 * and regeneration is available but quiet.
 */

export type TargetProfileWorkspaceProps = {
  applicationId: string;
  initial: CvTargetProfile | null;
  /** From the context assembler. Drives the warning before generation. */
  hasProgrammeData: boolean;
  /** True once there is CV content, so the step indicator can offer later steps. */
  furthestStep?: 'target-profile' | 'content' | 'review' | 'layout' | undefined;
};

type Values = Record<TargetProfileField, string>;

function toValues(tp: CvTargetProfile | null): Values {
  return TARGET_PROFILE_FIELDS.reduce((acc, field) => {
    acc[field] = tp?.[field] ?? '';
    return acc;
  }, {} as Values);
}

export function TargetProfileWorkspace({
  applicationId,
  initial,
  hasProgrammeData,
  furthestStep,
}: TargetProfileWorkspaceProps) {
  const [profile, setProfile] = useState<CvTargetProfile | null>(initial);
  const [values, setValues] = useState<Values>(() => toValues(initial));
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const generated = profile?.generatedAt != null;
  const missing = profile?.missingInformation ?? [];

  const persist = useCallback(
    async (next: Values) => {
      const response = await fetch(`/api/applications/${applicationId}/cv/target-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error('save failed');
      const data = (await response.json()) as { version?: number };
      return { version: data.version };
    },
    [applicationId],
  );

  const autosave = useAutosave(persist, { initialVersion: initial?.version });

  const update = useCallback(
    (field: TargetProfileField, value: string) => {
      setValues((current) => {
        const next = { ...current, [field]: value };
        autosave.save(next);
        return next;
      });
    },
    [autosave],
  );

  async function generate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const response = await fetch(
        `/api/applications/${applicationId}/cv/target-profile/generate`,
        { method: 'POST' },
      );
      const data = (await response.json().catch(() => ({}))) as {
        targetProfile?: CvTargetProfile;
        error?: string;
      };

      if (!response.ok || !data.targetProfile) {
        setGenerateError(data.error ?? 'We could not generate your target profile.');
        return;
      }

      setProfile(data.targetProfile);
      setValues(toValues(data.targetProfile));
    } catch {
      setGenerateError('We could not reach Glowbal. Check your connection and try again.');
    } finally {
      setGenerating(false);
    }
  }

  const filled = useMemo(
    () => TARGET_PROFILE_FIELDS.filter((field) => values[field].trim().length > 0).length,
    [values],
  );

  return (
    <div className="flex flex-col gap-gb-3xl">
      <CvSteps
        applicationId={applicationId}
        current="target-profile"
        {...(furthestStep ? { furthestReached: furthestStep } : {})}
      />

      <header className="flex flex-col gap-gb-lg">
        <div className="flex flex-wrap items-start justify-between gap-gb-lg">
          <h1 className="max-w-2xl font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            Xác định CV cần chứng minh những điều gì
          </h1>
          <AutosaveStatus
            status={autosave.status}
            version={autosave.version}
            onRetry={autosave.retry}
          />
        </div>
        <p className="max-w-3xl text-gb-md text-fg-tertiary">
          Trước khi viết CV, cần rõ CV này phải chứng minh điều gì với chương trình bạn đang ứng
          tuyển. Bảy mục dưới đây là những gì AI sẽ đối chiếu khi đánh giá CV của bạn.
        </p>
        <p className="text-gb-sm text-fg-muted">
          {filled} of {TARGET_PROFILE_FIELDS.length} fields have content
        </p>
      </header>

      {!hasProgrammeData && !generated ? <NoProgrammeDataState applicationId={applicationId} /> : null}

      {generating ? (
        <GeneratingState
          title="Đang tạo target profile"
          body="Reading this programme's page and your Glowbal profile."
        />
      ) : null}

      {generateError ? (
        <StateBlock
          tone="error"
          title="Không tạo được target profile"
          body={generateError}
          action={{ label: 'Try again', onClick: () => void generate() }}
        />
      ) : null}

      {!generated && !generating ? (
        <StateBlock
          title="Chưa có target profile"
          body="AI sẽ đọc trang chương trình và hồ sơ của bạn, rồi điền bảy mục dưới đây. Bạn có thể sửa mọi mục sau đó."
          action={{ label: 'Tạo trang target profile', onClick: () => void generate() }}
        />
      ) : null}

      {generated && missing.length > 0 ? (
        <div className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-brand-subtle p-gb-2xl">
          <p className="text-gb-sm font-semibold text-fg">
            Một số thông tin chưa xác định được
          </p>
          <ul className="flex list-disc flex-col gap-gb-xs pl-gb-xl">
            {missing.map((item) => (
              <li key={item} className="text-gb-sm text-fg-tertiary">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-gb-2xl lg:grid-cols-2">
        {TARGET_PROFILE_FIELD_DEFS.map((def) => {
          const inputId = `tp-${def.key}`;
          return (
            <StrategyPanel key={def.key} padding="sm">
              <div className="flex flex-col gap-gb-lg">
                <div className="flex flex-wrap items-center justify-between gap-gb-md">
                  <label htmlFor={inputId} className="text-gb-sm font-semibold text-fg">
                    {def.label}
                  </label>
                  {/* Only after generation: before it, there is no provenance to
                      report and a badge on an empty field is noise. */}
                  {generated ? <OriginBadge origin={def.origin} /> : null}
                </div>

                <textarea
                  id={inputId}
                  name={inputId}
                  rows={def.rows}
                  value={values[def.key]}
                  placeholder={def.example}
                  onChange={(event) => update(def.key, event.target.value)}
                  className="w-full resize-y rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-lg text-gb-sm text-fg placeholder:text-fg-placeholder placeholder:italic focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                />

                <p className="text-gb-xs text-fg-muted">{def.hint}</p>
              </div>
            </StrategyPanel>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-gb-xl">
        <Button size="lg" href={`/ai-strategy/${applicationId}/cv/content`}>
          Tiếp tục nhập nội dung
        </Button>
        {generated ? (
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            className="rounded-gb-md text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
          >
            Tạo lại target profile
          </button>
        ) : null}
      </div>
    </div>
  );
}
