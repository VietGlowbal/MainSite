'use client';

import { useMemo, useState } from 'react';
import {
  ENGLISH_TEST_FORMATS,
  STANDARDIZED_TEST_FORMATS,
  type GradeProblem,
} from '@/features/onboarding/domain';
import { createClient } from '@/lib/supabase/client';
import type { EnglishTestScore, StandardizedTestScore } from '@/lib/types';
import { Input, Panel, PanelHeader, RepeatableFieldset, Select } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { SaveBar, SelectOptions, type SaveMessage } from '../_form-parts';

const ENGLISH_TEST_TYPES = [
  ...Object.keys(ENGLISH_TEST_FORMATS),
  'IELTS General',
  'Cambridge C1 Advanced',
  'Cambridge C2 Proficiency',
  'Other',
];
const STANDARDIZED_TEST_TYPES = Object.keys(STANDARDIZED_TEST_FORMATS);

const BANDS = ['listening', 'reading', 'writing', 'speaking'] as const;

type DraftEnglishScore = Omit<
  EnglishTestScore,
  'id' | 'user_id' | 'created_at' | 'updated_at'
> & {
  _localId: string;
  id?: string;
};

type DraftStandardizedScore = Omit<
  StandardizedTestScore,
  'id' | 'user_id' | 'created_at' | 'updated_at'
> & {
  _localId: string;
  id?: string;
};

function problemText(problem: GradeProblem | null): string | undefined {
  if (problem === null) return undefined;
  return problem.message.replace(/\{(\w+)\}/g, (_match, key: string) =>
    problem.vars[key] === undefined ? `{${key}}` : String(problem.vars[key]),
  );
}

function scoreError(
  testType: string,
  raw: string,
  formats: typeof ENGLISH_TEST_FORMATS | typeof STANDARDIZED_TEST_FORMATS,
): string | undefined {
  if (raw.trim() === '') return undefined;
  const format = formats[testType];
  return format ? problemText(format.check(raw)) : undefined;
}

export function EnglishForm({
  userId,
  initialEnglishScores,
  initialStandardizedScores,
}: {
  userId: string;
  initialEnglishScores: EnglishTestScore[];
  initialStandardizedScores: StandardizedTestScore[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [englishScores, setEnglishScores] = useState<DraftEnglishScore[]>(
    initialEnglishScores.map((score) => ({ ...score, _localId: score.id })),
  );
  const [standardizedScores, setStandardizedScores] = useState<DraftStandardizedScore[]>(
    initialStandardizedScores.map((score) => ({ ...score, _localId: score.id })),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');
  const [message, setMessage] = useState<SaveMessage>(null);

  const addEnglishScore = () => {
    setEnglishScores((current) => [
      ...current,
      {
        _localId: crypto.randomUUID(),
        test_type: '',
        overall_score: null,
        listening_score: null,
        reading_score: null,
        writing_score: null,
        speaking_score: null,
        test_date: null,
        expiry_date: null,
      },
    ]);
  };

  const addStandardizedScore = () => {
    setStandardizedScores((current) => [
      ...current,
      {
        _localId: crypto.randomUUID(),
        test_type: '',
        score: null,
        test_date: null,
      },
    ]);
  };

  const updateEnglish = (
    localId: string,
    field: keyof DraftEnglishScore,
    value: DraftEnglishScore[keyof DraftEnglishScore],
  ) => {
    setEnglishScores((current) =>
      current.map((score) =>
        score._localId === localId ? { ...score, [field]: value } : score,
      ),
    );
  };

  const updateStandardized = (
    localId: string,
    field: keyof DraftStandardizedScore,
    value: DraftStandardizedScore[keyof DraftStandardizedScore],
  ) => {
    setStandardizedScores((current) =>
      current.map((score) =>
        score._localId === localId ? { ...score, [field]: value } : score,
      ),
    );
  };

  const removeEnglishAt = async (index: number) => {
    const score = englishScores[index];
    if (!score) return;
    setMessage(null);

    if (score.id) {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('english_test_scores')
          .delete()
          .eq('id', score.id)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
      } catch (error) {
        setMessage({
          text: `Could not remove English test: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          ok: false,
        });
        return;
      } finally {
        setSaving(false);
      }
    }

    setEnglishScores((current) =>
      current.filter((entry) => entry._localId !== score._localId),
    );
  };

  const removeStandardizedAt = async (index: number) => {
    const score = standardizedScores[index];
    if (!score) return;
    setMessage(null);

    if (score.id) {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('standardized_test_scores')
          .delete()
          .eq('id', score.id)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
      } catch (error) {
        setMessage({
          text: `Could not remove standardized test: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          ok: false,
        });
        return;
      } finally {
        setSaving(false);
      }
    }

    setStandardizedScores((current) =>
      current.filter((entry) => entry._localId !== score._localId),
    );
  };

  const parseScore = (value: string) => (value === '' ? null : Number.parseFloat(value));

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setShowErrors(true);

    const invalidEnglish = englishScores.find((score) => {
      if (!score.test_type || score.overall_score == null) return false;
      return scoreError(
        score.test_type,
        String(score.overall_score),
        ENGLISH_TEST_FORMATS,
      ) !== undefined;
    });
    const invalidStandardized = standardizedScores.find((score) => {
      if (!score.test_type || !score.score?.trim()) return false;
      return (
        scoreError(score.test_type, score.score, STANDARDIZED_TEST_FORMATS) !== undefined
      );
    });
    const englishWithoutType = englishScores.some(
      (score) =>
        !score.test_type &&
        (score.overall_score != null ||
          BANDS.some((band) => score[`${band}_score`] != null) ||
          Boolean(score.test_date) ||
          Boolean(score.expiry_date)),
    );
    const standardizedWithoutType = standardizedScores.some(
      (score) => !score.test_type && (Boolean(score.score?.trim()) || Boolean(score.test_date)),
    );

    if (englishWithoutType || standardizedWithoutType) {
      setMessage({ text: 'Choose a test type for every result before saving.', ok: false });
      setSaving(false);
      return;
    }

    if (invalidEnglish || invalidStandardized) {
      setMessage({ text: 'Correct the highlighted test score before saving.', ok: false });
      setSaving(false);
      return;
    }

    const englishIds = new Map<string, string>();
    const standardizedIds = new Map<string, string>();

    try {
      for (const score of englishScores) {
        if (!score.test_type) continue;
        const payload = {
          test_type: score.test_type,
          overall_score: score.overall_score,
          listening_score: score.listening_score,
          reading_score: score.reading_score,
          writing_score: score.writing_score,
          speaking_score: score.speaking_score,
          test_date: score.test_date || null,
          expiry_date: score.expiry_date || null,
          updated_at: new Date().toISOString(),
        };

        if (score.id) {
          const { error } = await supabase
            .from('english_test_scores')
            .update(payload)
            .eq('id', score.id)
            .eq('user_id', userId);
          if (error) throw new Error(`Could not save ${score.test_type}: ${error.message}`);
        } else {
          const { data, error } = await supabase
            .from('english_test_scores')
            .insert({ user_id: userId, ...payload })
            .select('id')
            .single();
          if (error) throw new Error(`Could not save ${score.test_type}: ${error.message}`);
          if (data?.id) englishIds.set(score._localId, String(data.id));
        }
      }

      for (const score of standardizedScores) {
        if (!score.test_type) continue;
        const payload = {
          test_type: score.test_type,
          score: score.score?.trim() || null,
          test_date: score.test_date || null,
          updated_at: new Date().toISOString(),
        };

        if (score.id) {
          const { error } = await supabase
            .from('standardized_test_scores')
            .update(payload)
            .eq('id', score.id)
            .eq('user_id', userId);
          if (error) throw new Error(`Could not save ${score.test_type}: ${error.message}`);
        } else {
          const { data, error } = await supabase
            .from('standardized_test_scores')
            .insert({ user_id: userId, ...payload })
            .select('id')
            .single();
          if (error) throw new Error(`Could not save ${score.test_type}: ${error.message}`);
          if (data?.id) standardizedIds.set(score._localId, String(data.id));
        }
      }

      setMessage({ text: 'Saved successfully.', ok: true });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not save test scores.',
        ok: false,
      });
    } finally {
      // Keep IDs even when a later row fails. Otherwise retrying after a
      // partial save inserts the successful rows a second time.
      if (englishIds.size > 0) {
        setEnglishScores((current) =>
          current.map((score) => {
            const id = englishIds.get(score._localId);
            return id ? { ...score, id } : score;
          }),
        );
      }
      if (standardizedIds.size > 0) {
        setStandardizedScores((current) =>
          current.map((score) => {
            const id = standardizedIds.get(score._localId);
            return id ? { ...score, id } : score;
          }),
        );
      }
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-gb-3xl">
      <Panel className="flex flex-col gap-gb-4xl">
        <PanelHeader
          title="English proficiency"
          description="IELTS, TOEFL, PTE, Duolingo, Cambridge English, or another language test."
        />

        <RepeatableFieldset
          legend="English-language tests"
          description="Add every result you have. An expired score still helps us judge your level."
          entries={englishScores}
          keyOf={(score) => score._localId}
          entryLabel={(index) => `English test ${index + 1}`}
          addLabel="Add English test"
          onAdd={addEnglishScore}
          onRemove={(index) => void removeEnglishAt(index)}
          emptyState="No English-language scores yet."
          renderEntry={(score) => {
            const overallError = showErrors
              ? scoreError(
                  score.test_type,
                  score.overall_score == null ? '' : String(score.overall_score),
                  ENGLISH_TEST_FORMATS,
                )
              : undefined;
            return (
              <div className="flex flex-col gap-gb-2xl">
                <div className="grid gap-gb-2xl sm:grid-cols-2">
                  <Select
                    name={`english-test-type-${score._localId}`}
                    label="Test type"
                    placeholder="Select test…"
                    value={score.test_type}
                    onChange={(event) => {
                      updateEnglish(score._localId, 'test_type', event.target.value);
                      updateEnglish(score._localId, 'overall_score', null);
                    }}
                    fieldClassName="sm:col-span-2"
                  >
                    <SelectOptions options={ENGLISH_TEST_TYPES} value={score.test_type} />
                  </Select>
                  <Input
                    name={`english-overall-score-${score._localId}`}
                    type="number"
                    step="any"
                    label="Overall score"
                    placeholder={ENGLISH_TEST_FORMATS[score.test_type]?.placeholder ?? 'e.g. 7.5'}
                    hint={ENGLISH_TEST_FORMATS[score.test_type]?.hint}
                    error={overallError}
                    value={score.overall_score ?? ''}
                    onChange={(event) =>
                      updateEnglish(
                        score._localId,
                        'overall_score',
                        parseScore(event.target.value),
                      )
                    }
                  />
                  <Input
                    name={`english-test-date-${score._localId}`}
                    type="date"
                    label="Test date"
                    value={score.test_date ?? ''}
                    onChange={(event) =>
                      updateEnglish(score._localId, 'test_date', event.target.value || null)
                    }
                  />
                  <Input
                    name={`english-expiry-date-${score._localId}`}
                    type="date"
                    label="Expiry date"
                    value={score.expiry_date ?? ''}
                    onChange={(event) =>
                      updateEnglish(score._localId, 'expiry_date', event.target.value || null)
                    }
                  />
                </div>

                <div className="flex flex-col gap-gb-lg">
                  <p className="text-gb-sm font-medium text-fg-secondary">
                    Sub-scores (optional)
                  </p>
                  <div className="grid grid-cols-2 gap-gb-lg sm:grid-cols-4">
                    {BANDS.map((band) => (
                      <Input
                        key={band}
                        name={`english-${band}-score-${score._localId}`}
                        type="number"
                        step="any"
                        label={band.charAt(0).toUpperCase() + band.slice(1)}
                        placeholder="—"
                        value={score[`${band}_score`] ?? ''}
                        onChange={(event) =>
                          updateEnglish(
                            score._localId,
                            `${band}_score`,
                            parseScore(event.target.value),
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          }}
        />
      </Panel>

      <Panel className="flex flex-col gap-gb-4xl">
        <PanelHeader
          title="Standardized tests"
          description="SAT, ACT, AP, IB, A-Level, and GCSE / IGCSE results saved by your education-planning test."
        />

        <RepeatableFieldset
          legend="Standardized test results"
          entries={standardizedScores}
          keyOf={(score) => score._localId}
          entryLabel={(index) => `Standardized test ${index + 1}`}
          addLabel="Add standardized test"
          onAdd={addStandardizedScore}
          onRemove={(index) => void removeStandardizedAt(index)}
          emptyState="No standardized test scores yet."
          renderEntry={(score) => {
            const format = STANDARDIZED_TEST_FORMATS[score.test_type];
            const error = showErrors
              ? scoreError(score.test_type, score.score ?? '', STANDARDIZED_TEST_FORMATS)
              : undefined;
            return (
              <div className="grid gap-gb-2xl sm:grid-cols-2">
                <Select
                  name={`standardized-test-type-${score._localId}`}
                  label="Test type"
                  placeholder="Select test…"
                  value={score.test_type}
                  onChange={(event) => {
                    updateStandardized(score._localId, 'test_type', event.target.value);
                    updateStandardized(score._localId, 'score', null);
                  }}
                >
                  <SelectOptions
                    options={STANDARDIZED_TEST_TYPES}
                    value={score.test_type}
                  />
                </Select>
                <Input
                  name={`standardized-score-${score._localId}`}
                  label={format?.fieldLabel ?? 'Score'}
                  inputMode={format?.numeric === false ? 'text' : 'decimal'}
                  placeholder={format?.placeholder ?? 'Enter your score'}
                  hint={format?.hint}
                  error={error}
                  value={score.score ?? ''}
                  onChange={(event) =>
                    updateStandardized(score._localId, 'score', event.target.value)
                  }
                />
                <Input
                  name={`standardized-test-date-${score._localId}`}
                  type="date"
                  label="Test date"
                  value={score.test_date ?? ''}
                  onChange={(event) =>
                    updateStandardized(
                      score._localId,
                      'test_date',
                      event.target.value || null,
                    )
                  }
                  fieldClassName="sm:col-span-2"
                />
              </div>
            );
          }}
        />
      </Panel>

      <SaveBar onSave={handleSave} saving={saving} message={message} label="Save test scores" />
    </div>
  );
}
