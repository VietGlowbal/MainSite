'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EnglishTestScore } from '@/lib/types';
import { Input, Panel, RepeatableFieldset, Select } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { SaveBar, SelectOptions, type SaveMessage } from '../_form-parts';

const TEST_TYPES = ['IELTS Academic', 'IELTS General', 'TOEFL iBT', 'PTE Academic', 'Duolingo English Test', 'Cambridge C1 Advanced', 'Cambridge C2 Proficiency', 'Other'];

const BANDS = ['listening', 'reading', 'writing', 'speaking'] as const;

type DraftScore = Omit<EnglishTestScore, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { _localId: string; id?: string };

export function EnglishForm({
  userId,
  initialScores,
}: {
  userId: string;
  initialScores: EnglishTestScore[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [scores, setScores] = useState<DraftScore[]>(
    initialScores.map((s) => ({ ...s, _localId: s.id }))
  );
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');
  const [message, setMessage] = useState<SaveMessage>(null);

  const addScore = () => {
    setScores((prev) => [
      ...prev,
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

  const update = (localId: string, field: string, value: unknown) => {
    setScores((prev) =>
      prev.map((s) => (s._localId === localId ? { ...s, [field]: value } : s))
    );
  };

  const removeAt = async (index: number) => {
    const score = scores[index];
    if (!score) return;
    if (score.id) {
      await supabase.from('english_test_scores').delete().eq('id', score.id);
    }
    setScores((prev) => prev.filter((s) => s._localId !== score._localId));
  };

  const parseScore = (val: string) => val === '' ? null : parseFloat(val);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    for (const score of scores) {
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
      };
      if (score.id) {
        await supabase.from('english_test_scores').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', score.id);
      } else {
        const { data } = await supabase.from('english_test_scores').insert({ user_id: userId, ...payload }).select('id').single();
        if (data) {
          setScores((prev) => prev.map((s) => (s._localId === score._localId ? { ...s, id: data.id } : s)));
        }
      }
    }

    setMessage({ text: 'Saved successfully.', ok: true });
    setSaving(false);
  };

  return (
    <Panel className="flex flex-col gap-gb-4xl">
      <RepeatableFieldset
        legend="Test scores"
        description="Add every test you have sat. An expired score still helps us judge your level."
        entries={scores}
        keyOf={(score) => score._localId}
        entryLabel={(i) => `Test ${i + 1}`}
        addLabel="Add test score"
        onAdd={addScore}
        onRemove={(index) => void removeAt(index)}
        emptyState="No test scores yet. Add your IELTS, TOEFL, or other English proficiency results."
        renderEntry={(score) => (
          <div className="flex flex-col gap-gb-2xl">
            <div className="grid gap-gb-2xl sm:grid-cols-2">
              <Select
                name={`test_type-${score._localId}`}
                label="Test type"
                placeholder="Select test…"
                value={score.test_type}
                onChange={(e) => update(score._localId, 'test_type', e.target.value)}
                fieldClassName="sm:col-span-2"
              >
                <SelectOptions options={TEST_TYPES} value={score.test_type} />
              </Select>
              <Input
                name={`overall_score-${score._localId}`}
                type="number"
                step="0.5"
                label="Overall score"
                placeholder="e.g. 7.5"
                value={score.overall_score ?? ''}
                onChange={(e) => update(score._localId, 'overall_score', parseScore(e.target.value))}
              />
              <Input
                name={`test_date-${score._localId}`}
                type="date"
                label="Test date"
                value={score.test_date ?? ''}
                onChange={(e) => update(score._localId, 'test_date', e.target.value || null)}
              />
              <Input
                name={`expiry_date-${score._localId}`}
                type="date"
                label="Expiry date"
                value={score.expiry_date ?? ''}
                onChange={(e) => update(score._localId, 'expiry_date', e.target.value || null)}
              />
            </div>

            <div className="flex flex-col gap-gb-lg">
              <p className="text-gb-sm font-medium text-fg-secondary">Sub-scores (optional)</p>
              <div className="grid grid-cols-2 gap-gb-lg sm:grid-cols-4">
                {BANDS.map((band) => (
                  <Input
                    key={band}
                    name={`${band}_score-${score._localId}`}
                    type="number"
                    step="0.5"
                    label={band.charAt(0).toUpperCase() + band.slice(1)}
                    placeholder="—"
                    value={score[`${band}_score`] ?? ''}
                    onChange={(e) => update(score._localId, `${band}_score`, parseScore(e.target.value))}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      />

      <SaveBar onSave={handleSave} saving={saving} message={message} label="Save scores" />
    </Panel>
  );
}
