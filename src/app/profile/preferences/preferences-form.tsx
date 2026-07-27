'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StudentProfile } from '@/lib/types';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

const INPUT = 'block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 transition';
const LABEL = 'block text-xs font-semibold text-slate-700 mb-1.5';
const SELECT = INPUT + ' bg-white';

const BUDGET_OPTIONS = [
  'Under $10,000 / year',
  '$10,000–$20,000 / year',
  '$20,000–$35,000 / year',
  '$35,000–$50,000 / year',
  'Over $50,000 / year',
  'Flexible / Scholarship dependent',
];

const STUDY_MODES = ['Full-time', 'Part-time', 'Either'];

const POPULAR_COUNTRIES = ['United Kingdom', 'United States', 'Australia', 'Canada', 'Germany', 'Netherlands', 'Singapore', 'Japan', 'South Korea', 'Vietnam'];

function TagInput({
  label,
  values,
  onChange,
  placeholder,
  suggestions,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  suggestions?: string[];
}) {
  const [input, setInput] = useState('');
  const add = (val: string) => {
    const t = val.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setInput('');
  };
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="flex gap-2">
        <input
          className={INPUT}
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input); } }}
        />
        <button
          type="button"
          onClick={() => add(input)}
          className="shrink-0 rounded-xl border border-pink-300 bg-pink-50 px-4 text-sm font-semibold text-pink-600 transition hover:bg-pink-100"
        >
          Add
        </button>
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions.filter((s) => !values.includes(s)).slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-500 transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-600"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="hover:text-red-500 transition">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function PreferencesForm({
  userId,
  initialProfile,
}: {
  userId: string;
  initialProfile: StudentProfile | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [countries, setCountries] = useState<string[]>(initialProfile?.preferred_countries ?? []);
  const [cities, setCities] = useState<string[]>(initialProfile?.preferred_cities ?? []);
  const [subjects, setSubjects] = useState<string[]>(initialProfile?.target_subjects ?? []);
  const [budget, setBudget] = useState(initialProfile?.budget_range ?? '');
  const [campus, setCampus] = useState(initialProfile?.campus_preferences ?? '');
  const [studyMode, setStudyMode] = useState(initialProfile?.study_mode_preference ?? '');
  const [intake, setIntake] = useState(initialProfile?.target_intake ?? '');
  const [cycleYear, setCycleYear] = useState(String(initialProfile?.application_cycle_year ?? ''));
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving your profile');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('student_profiles').upsert(
      {
        user_id: userId,
        preferred_countries: countries.length > 0 ? countries : null,
        preferred_cities: cities.length > 0 ? cities : null,
        target_subjects: subjects.length > 0 ? subjects : null,
        budget_range: budget || null,
        campus_preferences: campus || null,
        study_mode_preference: studyMode || null,
        target_intake: intake || null,
        application_cycle_year: cycleYear ? parseInt(cycleYear, 10) : null,
      },
      { onConflict: 'user_id' },
    );
    setMessage(error ? { text: error.message, ok: false } : { text: 'Saved successfully.', ok: true });
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="space-y-5">
        <TagInput
          label="Preferred countries"
          values={countries}
          onChange={setCountries}
          placeholder="e.g. United Kingdom"
          suggestions={POPULAR_COUNTRIES}
        />

        <TagInput
          label="Preferred cities (optional)"
          values={cities}
          onChange={setCities}
          placeholder="e.g. London, Manchester"
        />

        <TagInput
          label="Target subjects / fields"
          values={subjects}
          onChange={setSubjects}
          placeholder="e.g. Computer Science, Law"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Budget range</label>
            <select className={SELECT} value={budget} onChange={(e) => setBudget(e.target.value)}>
              <option value="">Select budget…</option>
              {BUDGET_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Preferred study mode</label>
            <select className={SELECT} value={studyMode} onChange={(e) => setStudyMode(e.target.value)}>
              <option value="">Select mode…</option>
              {STUDY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Target intake</label>
            <input
              className={INPUT}
              placeholder="e.g. Sep 2027"
              value={intake}
              onChange={(e) => setIntake(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Application cycle year</label>
            <input
              className={INPUT}
              type="number"
              min="2025"
              max="2035"
              placeholder="e.g. 2027"
              value={cycleYear}
              onChange={(e) => setCycleYear(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Campus preferences (optional)</label>
            <input
              className={INPUT}
              placeholder="e.g. Large city campus, close to industry hubs"
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
        {message && (
          <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-red-500'}`}>{message.text}</p>
        )}
      </div>
    </div>
  );
}
