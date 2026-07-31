'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  EDUCATION_LEVELS,
  FUNDING_SOURCES,
  INTENDED_LEVELS,
  INTEREST_AREAS,
  LEARNING_STYLE_OPTIONS,
  TUITION_BUDGETS_USD,
  reflectionStep,
  type AboutYouValues,
  type AspirationsValues,
  type PersonalSummaryValues,
} from '@/features/apply/domain';
import { ReflectionSection, ReflectionShell } from '@/features/apply/ui';
import { Button, Checkbox, Input, RangeHistogram, Select, Textarea } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * Reflection step 1 — personal and study information.
 *
 * Fields and vocabularies come from `features/apply/domain/reflection`, which
 * was written against these frames in an earlier phase, so this is the wiring
 * rather than a new model: education, nationality, GPA and IELTS as written
 * strings, then major, countries, intended level, funding and budget.
 */

/**
 * The bars behind the budget slider.
 *
 * FLAT, AND THAT IS THE POINT. The frame draws a lively distribution, and it
 * would be a few lines to reproduce one — but `RangeHistogram` states the rule
 * plainly in its own source: real data or nothing, because a curve here is a
 * claim about what other students budget, and we have no cohort data to
 * support it. A student reading a peak at 500M VND would reasonably conclude
 * that is what people like them spend.
 *
 * So the bars are uniform: they render the scale the handles move along and
 * assert nothing. When there are enough saved budgets to aggregate without
 * identifying anyone, this becomes a real distribution and the frame's shape
 * arrives honestly.
 */
const BUDGET_BINS = Array.from({ length: 48 }, () => 1);

/** 0 – 2 tỷ VND, the span the frame's chip is inside. */
const BUDGET_MIN_VND = 0;
const BUDGET_MAX_VND = 2_000_000_000;

function formatVnd(value: number): string {
  return `${Math.round(value).toLocaleString('vi-VN')} VND`;
}

export type AboutFormValues = AboutYouValues & AspirationsValues & PersonalSummaryValues;

export function ReflectionAboutForm({ initial }: { initial: AboutFormValues }) {
  const router = useRouter();
  /**
   * Set when a Strategy (ai-strategy-dashboard) sent the student here because
   * their Personal Summary/Achievements weren't done yet — carried through
   * both steps so achievements' final submit can send them back to that
   * Strategy instead of the standalone flow's default landing page.
   */
  const returnTo = useSearchParams().get('return');
  const [values, setValues] = useState<AboutFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLoadingIndicator(saving, 'Saving your information');

  function set<K extends keyof AboutFormValues>(key: K, value: AboutFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /** The stored band is "min-max" in VND; the slider works in numbers. */
  const [budgetLow, budgetHigh] = parseBand(values.budgetRange, BUDGET_MIN_VND, BUDGET_MAX_VND);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/reflection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ about: values }),
      });

      if (!response.ok) {
        setError('We could not save that. Please try again.');
        setSaving(false);
        return;
      }

      const nextPath = reflectionStep('evidence').path;
      router.push(returnTo ? `${nextPath}?return=${encodeURIComponent(returnTo)}` : nextPath);
    } catch {
      setError('We could not save that. Please try again.');
      setSaving(false);
    }
  }

  return (
    <ReflectionShell step="about">
      <form onSubmit={handleSubmit} className="flex flex-col gap-gb-3xl">
        <ReflectionSection title="Thông tin cá nhân">
          <Select
            name="highestEducation"
            label="What is your highest level of education?"
            placeholder="Select your level"
            value={values.highestEducation ?? ''}
            onChange={(e) =>
              set('highestEducation', (e.target.value || undefined) as AboutFormValues['highestEducation'])
            }
          >
            {EDUCATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </Select>

          <Input
            name="nationality"
            label="What is your nationality?"
            placeholder="Vietnam"
            value={values.nationality ?? ''}
            onChange={(e) => set('nationality', e.target.value || undefined)}
          />

          <Input
            name="country"
            label="What country do you currently live in?"
            placeholder="Vietnam"
            value={values.country ?? ''}
            onChange={(e) => set('country', e.target.value || undefined)}
          />

          <Input
            name="languages"
            label="Which languages do you speak?"
            placeholder="Vietnamese, English"
            hint="Separate several with a comma."
            value={values.languages.join(', ')}
            onChange={(e) => set('languages', splitList(e.target.value))}
          />

          <Input
            name="age"
            label="Age"
            type="number"
            min={10}
            max={100}
            value={values.age ?? ''}
            onChange={(e) => set('age', e.target.value ? Number(e.target.value) : undefined)}
          />
        </ReflectionSection>

        <ReflectionSection title="Học vấn">
          <Input
            name="schoolName"
            label="School"
            placeholder="Hanoi - Amsterdam High School"
            value={values.schoolName ?? ''}
            onChange={(e) => set('schoolName', e.target.value || undefined)}
          />

          <Input
            name="currentYear"
            label="Current year"
            placeholder="Grade 11"
            value={values.currentYear ?? ''}
            onChange={(e) => set('currentYear', e.target.value || undefined)}
          />

          <Input
            name="currentSubjects"
            label="Subjects you are currently studying"
            placeholder="Maths, Physics, English"
            hint="Separate several with a comma."
            value={values.currentSubjects.join(', ')}
            onChange={(e) => set('currentSubjects', splitList(e.target.value))}
          />

          <Input
            name="predictedGrades"
            label="Predicted grades"
            placeholder="A*AA"
            value={values.predictedGrades ?? ''}
            onChange={(e) => set('predictedGrades', e.target.value || undefined)}
          />
        </ReflectionSection>

        <ReflectionSection title="Điểm số">
          {/* Kept as written rather than parsed to a number: students give
              these on different scales ("3.5 / 4", "8.7/10"), and normalising
              at input time would mean guessing which. */}
          <Input
            name="gpa"
            label="GPA"
            placeholder="3.5 / 4"
            value={values.gpa ?? ''}
            onChange={(e) => set('gpa', e.target.value || undefined)}
          />
          <Input
            name="ielts"
            label="IELTS"
            placeholder="7 / 10"
            value={values.ielts ?? ''}
            onChange={(e) => set('ielts', e.target.value || undefined)}
          />
        </ReflectionSection>

        <ReflectionSection title="Nguyện vọng">
          <Input
            name="majors"
            label="Select a major"
            placeholder="Design"
            hint="Separate several with a comma."
            value={values.majors.join(', ')}
            onChange={(e) => set('majors', splitList(e.target.value))}
          />

          <Input
            name="countries"
            label="Which countries are you interested in?"
            placeholder="Japan"
            hint="Separate several with a comma."
            value={values.countries.join(', ')}
            onChange={(e) => set('countries', splitList(e.target.value))}
          />

          {/* Three cards rather than a dropdown, per the frame. A radiogroup
              because they are mutually exclusive — the frame's green outline on
              the chosen one is a selection state, not a checkbox. */}
          <fieldset className="flex flex-col gap-gb-md">
            <legend className="mb-gb-md text-gb-sm font-semibold text-fg">
              What is your intended level of study?
            </legend>
            <div role="radiogroup" aria-label="Intended level of study" className="flex flex-col gap-gb-md">
              {INTENDED_LEVELS.map((level) => {
                const selected = values.intendedLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => set('intendedLevel', selected ? undefined : level)}
                    className={`rounded-gb-xl border px-gb-xl py-gb-lg text-left text-gb-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      selected
                        ? 'border-tier-safe bg-surface font-semibold text-fg'
                        : 'border-line bg-surface text-fg-tertiary hover:border-line-strong'
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Select
            name="fundingSource"
            label="Ngân sách"
            placeholder="Select a funding source"
            value={values.fundingSource ?? ''}
            onChange={(e) =>
              set('fundingSource', (e.target.value || undefined) as AboutFormValues['fundingSource'])
            }
          >
            {FUNDING_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>

          <RangeHistogram
            min={BUDGET_MIN_VND}
            max={BUDGET_MAX_VND}
            step={10_000_000}
            low={budgetLow}
            high={budgetHigh}
            onChange={({ low, high }) => set('budgetRange', `${low}-${high}`)}
            distribution={BUDGET_BINS}
            label="Total budget"
            formatValue={(low, high) => `${formatVnd(low)} - ${formatVnd(high)}`}
          />

          <Select
            name="tuitionBudgetUsd"
            label="Select your tuition budget (USD)"
            placeholder="Select a band"
            value={values.tuitionBudgetUsd ?? ''}
            onChange={(e) =>
              set(
                'tuitionBudgetUsd',
                (e.target.value || undefined) as AboutFormValues['tuitionBudgetUsd'],
              )
            }
          >
            {TUITION_BUDGETS_USD.map((band) => (
              <option key={band} value={band}>
                {band}
              </option>
            ))}
          </Select>

          <Input
            name="studyStyle"
            label="Study style"
            placeholder="Small classes, hands-on labs"
            value={values.studyStyle ?? ''}
            onChange={(e) => set('studyStyle', e.target.value || undefined)}
          />

          <Textarea
            name="careerGoals"
            label="Career goals"
            placeholder="What do you want to be doing five years after you graduate?"
            value={values.careerGoals ?? ''}
            onChange={(e) => set('careerGoals', e.target.value || undefined)}
          />
        </ReflectionSection>

        <ReflectionSection title="Sở thích">
          <fieldset className="flex flex-col gap-gb-md">
            <legend className="mb-gb-md text-gb-sm font-semibold text-fg">
              Which of these describe you?
            </legend>
            <div className="flex flex-col gap-gb-md">
              {INTEREST_AREAS.map((area) => (
                <Checkbox
                  key={area}
                  name="interestAreas"
                  value={area}
                  label={area}
                  checked={values.interestAreas.includes(area)}
                  onChange={(e) =>
                    set(
                      'interestAreas',
                      e.target.checked
                        ? [...values.interestAreas, area]
                        : values.interestAreas.filter((a) => a !== area),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
        </ReflectionSection>

        <ReflectionSection title="Phong cách học">
          <fieldset className="flex flex-col gap-gb-md">
            <legend className="mb-gb-md text-gb-sm font-semibold text-fg">
              How do you learn best?
            </legend>
            <div className="flex flex-col gap-gb-md">
              {LEARNING_STYLE_OPTIONS.map((style) => (
                <Checkbox
                  key={style}
                  name="learningStyle"
                  value={style}
                  label={style}
                  checked={values.learningStyle.includes(style)}
                  onChange={(e) =>
                    set(
                      'learningStyle',
                      e.target.checked
                        ? [...values.learningStyle, style]
                        : values.learningStyle.filter((s) => s !== style),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
        </ReflectionSection>

        <ReflectionSection title="Câu hỏi bài luận">
          <Textarea
            name="psMotivations"
            label="What motivates you to study this?"
            value={values.psMotivations ?? ''}
            onChange={(e) => set('psMotivations', e.target.value || undefined)}
          />
          <Textarea
            name="psGoals"
            label="What are your goals?"
            value={values.psGoals ?? ''}
            onChange={(e) => set('psGoals', e.target.value || undefined)}
          />
          <Textarea
            name="psDreamCareer"
            label="What is your dream career?"
            value={values.psDreamCareer ?? ''}
            onChange={(e) => set('psDreamCareer', e.target.value || undefined)}
          />
          <Textarea
            name="psReasonsAbroad"
            label="Why do you want to study abroad?"
            value={values.psReasonsAbroad ?? ''}
            onChange={(e) => set('psReasonsAbroad', e.target.value || undefined)}
          />
        </ReflectionSection>

        {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

        <div className="flex justify-center">
          <Button type="submit" size="lg" disabled={saving} className="min-w-64">
            {saving ? 'Đang lưu…' : 'Tiếp tục'}
          </Button>
        </div>
      </form>
    </ReflectionShell>
  );
}

/** "1000-2000" → [1000, 2000], falling back to the full span. */
function parseBand(band: string | undefined, min: number, max: number): [number, number] {
  if (!band) return [min, max];
  const [low, high] = band.split('-').map((part) => Number.parseInt(part.trim(), 10));
  if (!Number.isFinite(low) || !Number.isFinite(high)) return [min, max];
  return [Math.max(min, low as number), Math.min(max, high as number)];
}

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
