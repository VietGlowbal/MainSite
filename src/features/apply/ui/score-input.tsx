'use client';

import { useState } from 'react';
import {
  ENGLISH_TESTS,
  GPA_SCALE,
  IELTS_SCALE,
  englishTest,
  englishTestScale,
  ieltsFromEnglishTest,
  validateScore,
  type EnglishTestId,
  type ScoreMethod,
} from '../domain';
import { ICONS, Input, KitIcon, Select, Textarea } from '@/shared/ui';

/**
 * The two score questions — GPA and English — and the AI conversion behind
 * both.
 *
 * ─── THE PROBLEM THESE SOLVE ─────────────────────────────────────────────────
 *
 * The form used to ask for "GPA" and "IELTS" as free text, which quietly
 * assumed every applicant already holds both on the scales GlowBal matches
 * against. A Vietnamese student with a 8.7/10 average, or a British one with
 * A Levels, had to convert their own results before they could answer — and
 * whatever they typed was stored unvalidated, including the "7 / 10" the IELTS
 * placeholder actually suggested, which is not a band IELTS issues.
 *
 * So each question now has two ways in: enter the score on the real scale, or
 * describe what you have and let the conversion place it.
 *
 * ─── THREE KINDS OF CONVERSION, AND ONLY ONE USES A MODEL ────────────────────
 *
 * 1. A published English test → IELTS is a documented concordance and is done
 *    in code (`ieltsFromEnglishTest`): instant, free, and incapable of
 *    inventing a band.
 * 2. A free-text description of grades → GPA has no table, so it goes to the
 *    model.
 * 3. An English qualification that is not one of the listed tests likewise.
 *
 * ─── AN ESTIMATE IS NEVER WRITTEN WITHOUT CONSENT ────────────────────────────
 *
 * Every conversion lands in a small result card with a "Use this" button. The
 * student can accept it, edit their description and convert again, or ignore
 * it and type a score. Nothing reaches the profile until they press the
 * button, and when it does it is tagged with how it was produced so a
 * converted 4.0 is never mistaken later for one they were awarded. Where the
 * model reports low confidence, the card shows what it would need instead of
 * a number — the brief is explicit that a defensible "I am not sure" beats a
 * confident fabrication.
 */

type ConversionResult = {
  value: number | null;
  understood: string;
  explanation: string;
  confident: boolean;
};

/** Two-way switch between entering a score and describing your results. */
function ModeTabs({
  mode,
  onChange,
  enterLabel,
  convertLabel,
}: {
  mode: 'enter' | 'convert';
  onChange: (mode: 'enter' | 'convert') => void;
  enterLabel: string;
  convertLabel: string;
}) {
  const options: Array<{ value: 'enter' | 'convert'; label: string }> = [
    { value: 'enter', label: enterLabel },
    { value: 'convert', label: convertLabel },
  ];

  return (
    <div role="radiogroup" aria-label={enterLabel} className="grid grid-cols-2 gap-gb-md">
      {options.map((option) => {
        const selected = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex items-center justify-center gap-gb-sm rounded-gb-lg border px-gb-lg py-gb-md text-gb-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              selected
                ? 'border-brand bg-brand-subtle text-fg-brand'
                : 'border-line bg-surface text-fg-tertiary hover:border-line-strong'
            }`}
          >
            {option.label}
            {selected ? (
              <span aria-hidden="true">
                <KitIcon art={ICONS.checkCircle} frame={16} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The result card.
 *
 * Deliberately small and white rather than a full-width brand panel — the
 * brief calls that out specifically. It is a suggestion sitting beside the
 * input, not the answer to the question.
 */
function ResultCard({
  title,
  value,
  scaleLabel,
  explanation,
  confident,
  useLabel,
  onUse,
  estimateNote,
}: {
  title: string;
  value: number | null;
  scaleLabel: string;
  explanation: string;
  confident: boolean;
  useLabel: string;
  onUse: () => void;
  estimateNote: string;
}) {
  return (
    <div className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface p-gb-xl shadow-gb-xs">
      <p className="text-gb-sm font-semibold text-fg-secondary">{title}</p>

      {confident && value !== null ? (
        <p className="flex items-baseline gap-gb-xs">
          <span className="font-display text-gb-display-sm font-semibold text-fg-brand">
            {value.toFixed(scaleLabel.includes('.') ? 1 : 2).replace(/\.00$/, '')}
          </span>
          <span className="text-gb-md text-fg-tertiary">/ {scaleLabel}</span>
        </p>
      ) : null}

      <p className="text-gb-sm text-fg-tertiary">{explanation}</p>

      {confident && value !== null ? (
        <>
          <p className="text-gb-xs text-fg-muted">{estimateNote}</p>
          <button
            type="button"
            onClick={onUse}
            className="self-start rounded-gb-lg border border-brand px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-brand transition-colors hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {useLabel}
          </button>
        </>
      ) : null}
    </div>
  );
}

/** Ask the conversion endpoint to read a free-text description of results. */
async function requestConversion(
  target: 'gpa' | 'ielts',
  description: string,
): Promise<ConversionResult> {
  const response = await fetch('/api/reflection/convert-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, description }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'We could not read those grades.');
  }
  return (await response.json()) as ConversionResult;
}

/* ─────────────────────────────────────────────────────────────────────────
   GPA
   ───────────────────────────────────────────────────────────────────────── */

export function GpaQuestion({
  value,
  source,
  onChange,
  t,
}: {
  value: string | undefined;
  /** The description the student typed, when the GPA came from a conversion. */
  source: string | undefined;
  onChange: (next: { gpa: string | undefined; method: ScoreMethod; source?: string }) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [mode, setMode] = useState<'enter' | 'convert'>(source ? 'convert' : 'enter');
  const [description, setDescription] = useState(source ?? '');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = validateScore(value ?? '', GPA_SCALE, t('GPA'));

  async function convert() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await requestConversion('gpa', description));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('We could not read those grades.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-gb-xl">
      <ModeTabs
        mode={mode}
        onChange={setMode}
        enterLabel={t('Enter GPA')}
        convertLabel={t('Convert with AI')}
      />

      {mode === 'enter' ? (
        <div className="max-w-xs">
          <Input
            name="gpa"
            type="number"
            inputMode="decimal"
            min={GPA_SCALE.min}
            max={GPA_SCALE.max}
            step={0.01}
            label={t('Your GPA')}
            placeholder="3.5"
            hint={t('Out of {max}', { max: GPA_SCALE.label })}
            value={value ?? ''}
            onChange={(e) =>
              onChange({ gpa: e.target.value || undefined, method: 'entered' })
            }
            {...(validation ? { error: validation } : {})}
          />
        </div>
      ) : (
        <div className="grid gap-gb-xl lg:grid-cols-2">
          <div className="flex flex-col gap-gb-md">
            <Textarea
              name="gradeDescription"
              label={t('Tell us about your grades')}
              placeholder={t('e.g. 9 As at GCSE and 4 A*s at A Level')}
              hint={t('Any system — describe them however they were given to you.')}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void convert()}
              disabled={busy || description.trim().length < 2}
              className="self-start rounded-gb-lg bg-brand px-gb-xl py-gb-sm text-gb-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {busy ? t('Understanding your grades…') : t('Estimate my GPA')}
            </button>
            {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
          </div>

          {result ? (
            <ResultCard
              title={t('Estimated GPA')}
              value={result.value}
              scaleLabel={GPA_SCALE.label}
              explanation={result.explanation}
              confident={result.confident}
              useLabel={t('Use this GPA')}
              estimateNote={t(
                'An approximate equivalent for matching — not an official conversion.',
              )}
              onUse={() =>
                onChange({
                  gpa: result.value === null ? undefined : String(result.value),
                  method: 'ai_estimate',
                  source: description,
                })
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   English
   ───────────────────────────────────────────────────────────────────────── */

export function EnglishQuestion({
  ielts,
  test,
  testScore,
  notTaken,
  onChange,
  t,
}: {
  ielts: string | undefined;
  test: EnglishTestId | undefined;
  testScore: string | undefined;
  notTaken: boolean;
  onChange: (next: {
    ielts?: string | undefined;
    method?: ScoreMethod;
    test?: EnglishTestId | undefined;
    testScore?: string | undefined;
    notTaken?: boolean;
  }) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [mode, setMode] = useState<'enter' | 'convert'>(test ? 'convert' : 'enter');
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ieltsError = validateScore(ielts ?? '', IELTS_SCALE, t('IELTS'));
  const activeTest = test ?? 'toefl_ibt';
  const testScale = englishTestScale(activeTest);
  const testError =
    activeTest === 'other'
      ? null
      : validateScore(testScore ?? '', testScale, englishTest(activeTest).label);

  // A listed test converts from a published table, with no model involved.
  const numericScore = Number(testScore);
  const tableEstimate =
    activeTest !== 'other' && testScore && !testError && Number.isFinite(numericScore)
      ? ieltsFromEnglishTest(activeTest, numericScore)
      : null;

  async function convertOther() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await requestConversion('ielts', description));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('We could not read that result.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-gb-xl">
      <ModeTabs
        mode={mode}
        onChange={setMode}
        enterLabel={t('IELTS')}
        convertLabel={t('Equivalent test')}
      />

      {mode === 'enter' ? (
        <div className="flex flex-col gap-gb-lg">
          <div className="max-w-xs">
            <Input
              name="ielts"
              type="number"
              inputMode="decimal"
              min={IELTS_SCALE.min}
              max={IELTS_SCALE.max}
              step={0.5}
              label={t('Your IELTS band')}
              placeholder="7.0"
              hint={t('Out of {max}, in half bands', { max: IELTS_SCALE.label })}
              value={ielts ?? ''}
              disabled={notTaken}
              onChange={(e) =>
                onChange({ ielts: e.target.value || undefined, method: 'entered' })
              }
              {...(ieltsError ? { error: ieltsError } : {})}
            />
          </div>

          <label className="flex items-center gap-gb-md text-gb-sm text-fg-secondary">
            <input
              type="checkbox"
              checked={notTaken}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? { notTaken: true, ielts: undefined, method: 'not_taken' }
                    : { notTaken: false },
                )
              }
              className="size-4 accent-[var(--color-brand)]"
            />
            {t('I haven’t taken an English test yet')}
          </label>
        </div>
      ) : (
        <div className="grid gap-gb-xl lg:grid-cols-2">
          <div className="flex flex-col gap-gb-lg">
            <Select
              name="englishTest"
              label={t('Test type')}
              placeholder={t('Select a test')}
              value={test ?? ''}
              onChange={(e) =>
                onChange({
                  test: (e.target.value || undefined) as EnglishTestId | undefined,
                  testScore: undefined,
                })
              }
            >
              {ENGLISH_TESTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </Select>

            {test && test !== 'other' ? (
              <Input
                name="englishTestScore"
                type="number"
                inputMode="numeric"
                min={testScale.min}
                max={testScale.max}
                label={t('Your score')}
                placeholder={String(testScale.max)}
                hint={t('Out of {max}', { max: testScale.label })}
                value={testScore ?? ''}
                onChange={(e) => onChange({ testScore: e.target.value || undefined })}
                {...(testError ? { error: testError } : {})}
              />
            ) : null}

            {test === 'other' ? (
              <div className="flex flex-col gap-gb-md">
                <Textarea
                  name="englishDescription"
                  label={t('Tell us what English qualification or result you have')}
                  placeholder={t('e.g. Grade A in Cambridge C1 Advanced')}
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void convertOther()}
                  disabled={busy || description.trim().length < 2}
                  className="self-start rounded-gb-lg bg-brand px-gb-xl py-gb-sm text-gb-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {busy ? t('Understanding your result…') : t('Estimate my IELTS')}
                </button>
                {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
              </div>
            ) : null}
          </div>

          {tableEstimate ? (
            <ResultCard
              title={t('Estimated IELTS')}
              value={tableEstimate.ielts}
              scaleLabel={IELTS_SCALE.label}
              explanation={tableEstimate.explanation}
              confident
              useLabel={t('Use this score')}
              estimateNote={t(
                'An approximate equivalent for matching — not an official conversion.',
              )}
              onUse={() =>
                onChange({
                  ielts: String(tableEstimate.ielts),
                  method: 'test_conversion',
                  notTaken: false,
                })
              }
            />
          ) : null}

          {result ? (
            <ResultCard
              title={t('Estimated IELTS')}
              value={result.value}
              scaleLabel={IELTS_SCALE.label}
              explanation={result.explanation}
              confident={result.confident}
              useLabel={t('Use this score')}
              estimateNote={t(
                'An approximate equivalent for matching — not an official conversion.',
              )}
              onUse={() =>
                onChange({
                  ielts: result.value === null ? undefined : String(result.value),
                  method: 'ai_estimate',
                  notTaken: false,
                })
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
