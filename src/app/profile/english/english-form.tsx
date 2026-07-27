'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EnglishTestScore } from '@/lib/types';
import { useLoadingIndicator } from '@/shared/ui';

const INPUT = 'block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 transition';
const LABEL = 'block text-xs font-semibold text-slate-700 mb-1.5';
const SELECT = INPUT + ' bg-white';

const TEST_TYPES = ['IELTS Academic', 'IELTS General', 'TOEFL iBT', 'PTE Academic', 'Duolingo English Test', 'Cambridge C1 Advanced', 'Cambridge C2 Proficiency', 'Other'];

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
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

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

  const remove = async (score: DraftScore) => {
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
    <div className="space-y-4">
      {scores.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
          <p className="text-sm text-slate-400">No test scores added yet.</p>
          <p className="mt-1 text-xs text-slate-400">Add your IELTS, TOEFL, or other English proficiency results.</p>
        </div>
      )}

      {scores.map((score, i) => (
        <div key={score._localId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Test #{i + 1}</span>
            <button type="button" onClick={() => remove(score)} className="text-xs text-slate-400 hover:text-red-400 transition">
              Remove
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL}>Test type</label>
              <select className={SELECT} value={score.test_type} onChange={(e) => update(score._localId, 'test_type', e.target.value)}>
                <option value="">Select test…</option>
                {TEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Overall score</label>
              <input
                className={INPUT}
                type="number"
                step="0.5"
                placeholder="e.g. 7.5"
                value={score.overall_score ?? ''}
                onChange={(e) => update(score._localId, 'overall_score', parseScore(e.target.value))}
              />
            </div>
            <div>
              <label className={LABEL}>Test date</label>
              <input
                className={INPUT}
                type="date"
                value={score.test_date ?? ''}
                onChange={(e) => update(score._localId, 'test_date', e.target.value || null)}
              />
            </div>
            <div>
              <label className={LABEL}>Expiry date</label>
              <input
                className={INPUT}
                type="date"
                value={score.expiry_date ?? ''}
                onChange={(e) => update(score._localId, 'expiry_date', e.target.value || null)}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className={LABEL + ' mb-2'}>Sub-scores (optional)</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['listening', 'reading', 'writing', 'speaking'] as const).map((band) => (
                <div key={band}>
                  <label className="block text-[11px] text-slate-500 mb-1 capitalize">{band}</label>
                  <input
                    className={INPUT}
                    type="number"
                    step="0.5"
                    placeholder="—"
                    value={score[`${band}_score`] ?? ''}
                    onChange={(e) => update(score._localId, `${band}_score`, parseScore(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addScore}
        className="w-full rounded-2xl border border-dashed border-pink-300 bg-pink-50/50 py-3 text-sm font-semibold text-pink-600 transition hover:bg-pink-50"
      >
        + Add test score
      </button>

      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save scores'}
        </button>
        {message && (
          <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-red-500'}`}>{message.text}</p>
        )}
      </div>
    </div>
  );
}
