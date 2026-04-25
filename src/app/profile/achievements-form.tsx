'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Achievement {
  id: string;
  title: string;
  description: string;
  year: string;
}

interface Props {
  userId: string;
  initialAchievements: Achievement[];
  initialSkills: string[];
}

export function AchievementsForm({ userId, initialAchievements, initialSkills }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [achievements, setAchievements] = useState<Achievement[]>(initialAchievements);
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [skillInput, setSkillInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const addAchievement = () => {
    setAchievements((prev: Achievement[]) => [...prev, { id: crypto.randomUUID(), title: '', description: '', year: '' }]);
  };

  const updateAchievement = (id: string, field: keyof Achievement, value: string) => {
    setAchievements((prev: Achievement[]) => prev.map((a: Achievement) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const removeAchievement = (id: string) => {
    setAchievements((prev: Achievement[]) => prev.filter((a: Achievement) => a.id !== id));
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev: string[]) => [...prev, trimmed]);
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setSkills((prev: string[]) => prev.filter((s: string) => s !== skill));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from('student_profiles')
      .upsert(
        { user_id: userId, achievements, skills },
        { onConflict: 'user_id' },
      );
    setMessage(error ? error.message : 'Saved.');
    setSaving(false);
  };

  return (
    <section className="glow-card space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Achievements &amp; skills</h2>
        <p className="mt-1 text-sm text-slate-500">Showcase what makes you stand out.</p>
      </div>

      {/* ── Achievements ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Top achievements</h3>
          <button
            type="button"
            onClick={addAchievement}
            className="glow-button-secondary text-xs px-3 py-1.5"
          >
            + Add
          </button>
        </div>

        {achievements.length === 0 && (
          <p className="text-sm text-slate-400 italic">No achievements added yet.</p>
        )}

        <div className="space-y-3">
          {achievements.map((a, i) => (
            <div key={a.id} className="rounded-2xl border border-black/5 bg-slate-50/80 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">#{i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeAchievement(a.id)}
                  className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                  aria-label="Remove achievement"
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_80px]">
                <input
                  className="glow-input text-sm"
                  placeholder="Title — e.g. National Science Olympiad finalist"
                  value={a.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAchievement(a.id, 'title', e.target.value)}
                />
                <input
                  className="glow-input text-sm"
                  placeholder="Year"
                  value={a.year}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAchievement(a.id, 'year', e.target.value)}
                />
              </div>
              <textarea
                className="glow-input text-sm"
                style={{ minHeight: '4rem', resize: 'vertical' }}
                placeholder="Brief description…"
                value={a.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateAchievement(a.id, 'description', e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Skills ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Skills</h3>
        <div className="flex gap-2">
          <input
            className="glow-input text-sm flex-1"
            placeholder="e.g. Python, Public speaking, Research…"
            value={skillInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSkillInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
          />
          <button type="button" onClick={addSkill} className="glow-button-primary px-4 text-sm shrink-0">
            Add
          </button>
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {skills.map((skill) => (
              <span key={skill} className="glow-chip text-xs gap-1.5">
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="glow-chip-remove hover:text-red-400 transition-colors"
                  aria-label={`Remove ${skill}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Save ── */}
      <div className="flex items-center gap-4 pt-2">
        <button className="glow-button-primary" type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save achievements & skills'}
        </button>
        {message && <p className="text-sm text-slate-500">{message}</p>}
      </div>
    </section>
  );
}
