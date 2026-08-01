'use client';

import Link from 'next/link';
import { useState } from 'react';
import { TARGET_PROFILE_FIELDS } from '@/features/application-strategy/domain';
import type { TargetProfileField } from '@/features/application-strategy/domain';
import {
  AutosaveStatus,
  CvSteps,
  OriginBadge,
  Panel,
  StateBlock,
  useFakeAutosave,
} from '../../demo-ui';
import {
  FAKE_AI_MS,
  TARGET_PROFILE_EXAMPLES,
  TARGET_PROFILE_LABELS,
  makeTargetProfile,
  type Scenario,
} from '../../fixtures';

/**
 * THROWAWAY DEMO — "Xác định CV cần chứng minh những điều gì". Delete with the folder.
 *
 * The ungenerated and generated states share one layout, which is the point: the
 * page does not rearrange itself when content arrives, so the student is not
 * relearning it. Regeneration is deliberately secondary — the spec is explicit
 * that it must not dominate, because a prominent regenerate button teaches
 * students to reroll instead of edit.
 */
export function TargetProfileWorkspace({ scenario }: { scenario: Scenario }) {
  const fixture = makeTargetProfile(scenario);

  const [generated, setGenerated] = useState(fixture !== null);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<TargetProfileField, string>>(() =>
    blank(),
  );
  const [missing, setMissing] = useState<string[]>(fixture?.missingInformation ?? []);
  const autosave = useFakeAutosave(fixture?.version ?? 1);

  // Seed from the fixture on first render when the scenario has data.
  const [seeded, setSeeded] = useState(false);
  if (!seeded && fixture) {
    setValues(fromFixture(fixture));
    setSeeded(true);
  }

  function generate() {
    setBusy(true);
    setTimeout(() => {
      const fresh = makeTargetProfile('partial');
      if (fresh) {
        setValues(fromFixture(fresh));
        setMissing(fresh.missingInformation);
      }
      setGenerated(true);
      setBusy(false);
    }, FAKE_AI_MS);
  }

  const filled = TARGET_PROFILE_FIELDS.filter((f) => values[f].trim() !== '').length;

  return (
    <div className="flex flex-col gap-gb-3xl">
      <CvSteps current="target-profile" />

      <header className="flex flex-col gap-gb-lg">
        <div className="flex flex-wrap items-start justify-between gap-gb-lg">
          <h1 className="max-w-2xl font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            Xác định CV cần chứng minh những điều gì
          </h1>
          <AutosaveStatus status={autosave.status} version={autosave.version} />
        </div>
        <p className="max-w-3xl text-gb-md text-fg-tertiary">
          Trước khi viết CV, cần rõ CV này phải chứng minh điều gì với chương trình bạn
          đang ứng tuyển. Bảy mục dưới đây là những gì AI sẽ đối chiếu khi đánh giá CV của
          bạn.
        </p>
        <p className="text-gb-sm text-fg-muted">
          {filled} of {TARGET_PROFILE_FIELDS.length} fields have content
        </p>
      </header>

      {busy ? (
        <StateBlock
          title="Đang tạo target profile"
          body="Reading the programme page and your Glowbal profile."
          busy
        />
      ) : null}

      {!generated && !busy ? (
        <StateBlock
          title="Chưa có target profile"
          body="AI sẽ đọc trang chương trình và hồ sơ của bạn, rồi điền bảy mục dưới đây. Bạn có thể sửa mọi mục sau đó."
          action={{ label: 'Tạo trang target profile', onClick: generate }}
        />
      ) : null}

      {generated && missing.length > 0 ? (
        <StateBlock
          tone="attention"
          title="AI không xác định được một số thông tin"
          body={missing.join(' ')}
        />
      ) : null}

      <div className="grid gap-gb-2xl lg:grid-cols-2">
        {TARGET_PROFILE_FIELDS.map((field) => {
          const meta = TARGET_PROFILE_LABELS[field];
          return (
            <Panel key={field}>
              <div className="flex flex-col gap-gb-lg">
                <div className="flex flex-wrap items-center justify-between gap-gb-md">
                  <label
                    htmlFor={`tp-${field}`}
                    className="text-gb-sm font-semibold text-fg"
                  >
                    {meta.vi}
                  </label>
                  {generated ? <OriginBadge origin={meta.origin} /> : null}
                </div>

                <textarea
                  id={`tp-${field}`}
                  rows={3}
                  value={values[field]}
                  placeholder={TARGET_PROFILE_EXAMPLES[field]}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [field]: e.target.value }));
                    autosave.save();
                  }}
                  className="w-full resize-y rounded-gb-md border border-line-strong bg-surface px-gb-xl py-gb-lg text-gb-sm text-fg placeholder:text-fg-placeholder placeholder:italic focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                />

                <p className="text-gb-xs text-fg-muted">{meta.en}</p>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-gb-xl">
        <Link
          href={`/demo-throwaway/cv/content?scenario=${scenario}`}
          className="rounded-gb-md bg-brand px-gb-3xl py-gb-lg text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
        >
          Tiếp tục nhập nội dung
        </Link>
        {generated ? (
          <button
            type="button"
            onClick={generate}
            className="text-gb-sm font-medium text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg"
          >
            Tạo lại target profile
          </button>
        ) : null}
      </div>
    </div>
  );
}

function blank(): Record<TargetProfileField, string> {
  return TARGET_PROFILE_FIELDS.reduce(
    (acc, f) => ({ ...acc, [f]: '' }),
    {} as Record<TargetProfileField, string>,
  );
}

function fromFixture(
  tp: NonNullable<ReturnType<typeof makeTargetProfile>>,
): Record<TargetProfileField, string> {
  return TARGET_PROFILE_FIELDS.reduce(
    (acc, f) => ({ ...acc, [f]: tp[f] ?? '' }),
    {} as Record<TargetProfileField, string>,
  );
}
