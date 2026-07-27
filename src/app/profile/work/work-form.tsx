'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { WorkExperience } from '@/lib/types';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

const INPUT = 'block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 transition';
const LABEL = 'block text-xs font-semibold text-slate-700 mb-1.5';
const SELECT = INPUT + ' bg-white';

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Internship', 'Volunteer', 'Freelance', 'Other'];

type DraftExperience = Omit<WorkExperience, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { _localId: string; id?: string };

export function WorkForm({
  userId,
  initialExperiences,
}: {
  userId: string;
  initialExperiences: WorkExperience[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [experiences, setExperiences] = useState<DraftExperience[]>(
    initialExperiences.map((e) => ({ ...e, _localId: e.id }))
  );
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const addExperience = () => {
    setExperiences((prev) => [
      ...prev,
      {
        _localId: crypto.randomUUID(),
        company: '',
        role: '',
        employment_type: '',
        start_date: null,
        end_date: null,
        is_current: false,
        description: null,
      },
    ]);
  };

  const update = (localId: string, field: string, value: unknown) => {
    setExperiences((prev) =>
      prev.map((e) => (e._localId === localId ? { ...e, [field]: value } : e))
    );
  };

  const remove = async (exp: DraftExperience) => {
    if (exp.id) {
      await supabase.from('work_experiences').delete().eq('id', exp.id);
    }
    setExperiences((prev) => prev.filter((e) => e._localId !== exp._localId));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    for (const exp of experiences) {
      if (!exp.company.trim() || !exp.role.trim()) continue;
      if (exp.id) {
        await supabase.from('work_experiences').update({
          company: exp.company,
          role: exp.role,
          employment_type: exp.employment_type || null,
          start_date: exp.start_date || null,
          end_date: exp.is_current ? null : exp.end_date || null,
          is_current: exp.is_current ?? false,
          description: exp.description || null,
          updated_at: new Date().toISOString(),
        }).eq('id', exp.id);
      } else {
        const { data } = await supabase.from('work_experiences').insert({
          user_id: userId,
          company: exp.company,
          role: exp.role,
          employment_type: exp.employment_type || null,
          start_date: exp.start_date || null,
          end_date: exp.is_current ? null : exp.end_date || null,
          is_current: exp.is_current ?? false,
          description: exp.description || null,
        }).select('id').single();
        if (data) {
          setExperiences((prev) =>
            prev.map((e) => (e._localId === exp._localId ? { ...e, id: data.id } : e))
          );
        }
      }
    }

    setMessage({ text: 'Saved successfully.', ok: true });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {experiences.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
          <p className="text-sm text-slate-400">No work experience added yet.</p>
          <p className="mt-1 text-xs text-slate-400">Click below to add your first entry.</p>
        </div>
      )}

      {experiences.map((exp, i) => (
        <div key={exp._localId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Experience #{i + 1}</span>
            <button
              type="button"
              onClick={() => remove(exp)}
              className="text-xs text-slate-400 hover:text-red-400 transition"
            >
              Remove
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Company / Organisation</label>
              <input
                className={INPUT}
                placeholder="e.g. Google"
                value={exp.company}
                onChange={(e) => update(exp._localId, 'company', e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Job title / Role</label>
              <input
                className={INPUT}
                placeholder="e.g. Software Engineering Intern"
                value={exp.role}
                onChange={(e) => update(exp._localId, 'role', e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Employment type</label>
              <select
                className={SELECT}
                value={exp.employment_type ?? ''}
                onChange={(e) => update(exp._localId, 'employment_type', e.target.value)}
              >
                <option value="">Select type…</option>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className={LABEL}>Start date</label>
                <input
                  className={INPUT}
                  type="month"
                  value={exp.start_date?.slice(0, 7) ?? ''}
                  onChange={(e) => update(exp._localId, 'start_date', e.target.value ? e.target.value + '-01' : null)}
                />
              </div>
            </div>
            {!exp.is_current && (
              <div>
                <label className={LABEL}>End date</label>
                <input
                  className={INPUT}
                  type="month"
                  value={exp.end_date?.slice(0, 7) ?? ''}
                  onChange={(e) => update(exp._localId, 'end_date', e.target.value ? e.target.value + '-01' : null)}
                />
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id={`current-${exp._localId}`}
                checked={exp.is_current ?? false}
                onChange={(e) => update(exp._localId, 'is_current', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-pink-500"
              />
              <label htmlFor={`current-${exp._localId}`} className="text-sm text-slate-700">I currently work here</label>
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>Description (optional)</label>
              <textarea
                className={INPUT}
                rows={2}
                placeholder="Key responsibilities and achievements…"
                value={exp.description ?? ''}
                onChange={(e) => update(exp._localId, 'description', e.target.value || null)}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addExperience}
        className="w-full rounded-2xl border border-dashed border-pink-300 bg-pink-50/50 py-3 text-sm font-semibold text-pink-600 transition hover:bg-pink-50"
      >
        + Add work experience
      </button>

      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save experiences'}
        </button>
        {message && (
          <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-red-500'}`}>{message.text}</p>
        )}
      </div>
    </div>
  );
}
