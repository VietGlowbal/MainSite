'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import type { DegreeLevel } from '@/types/achievers';

const HELP_TOPICS = [
  'SOP Writing',
  'Interview Prep',
  'Visa Process',
  'Scholarship Applications',
  'Course Selection',
  'Life Abroad',
  'Language Prep',
  'Career Planning',
];

const LANGUAGES = ['Vietnamese', 'English', 'French', 'German', 'Japanese', 'Korean', 'Chinese'];

type FormValues = {
  display_name: string;
  university_id: string;
  degree_level: DegreeLevel;
  subject: string;
  graduation_year: string;
  currently_enrolled: boolean;
  bio: string;
  session_price_vnd: string;
  session_duration_mins: string;
};

type Props = {
  userId: string;
  defaultDisplayName: string;
  universities: { id: number; name: string; country: string }[];
  studentProfile: Record<string, unknown> | null;
};

export function AchieverApplyForm({ userId, defaultDisplayName, universities, studentProfile }: Props) {
  const router = useRouter();
  const [helpTopics, setHelpTopics] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['Vietnamese', 'English']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      display_name: defaultDisplayName,
      university_id: '',
      degree_level: 'undergraduate',
      subject: '',
      graduation_year: '',
      currently_enrolled: true,
      bio: '',
      session_price_vnd: '300000',
      session_duration_mins: '60',
    },
  });

  const degreeLevel = watch('degree_level');
  const bio = watch('bio');

  function toggleTopic(topic: string) {
    setHelpTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  }

  function toggleLanguage(lang: string) {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  async function onSubmit(values: FormValues) {
    if (helpTopics.length === 0) {
      setError('Please select at least one topic you can help with.');
      return;
    }
    if (languages.length === 0) {
      setError('Please select at least one language.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    const price = Number(values.session_price_vnd);
    if (price < 100000) {
      setError('Minimum session price is 100,000 ₫');
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from('achiever_profiles').insert({
      id: userId,
      display_name: values.display_name,
      university_id: Number(values.university_id),
      degree_level: values.degree_level,
      subject: values.subject,
      graduation_year: values.graduation_year ? Number(values.graduation_year) : null,
      currently_enrolled: values.currently_enrolled,
      bio: values.bio,
      help_topics: helpTopics,
      languages,
      session_price_vnd: price,
      session_duration_mins: Number(values.session_duration_mins),
      status: 'pending',
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="glow-card text-center space-y-4 py-12">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Application submitted!</h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Your application is under review. We will contact you via email within 48 hours.
        </p>
        <button
          type="button"
          onClick={() => router.push('/achievers')}
          className="glow-button-secondary text-sm px-5 py-2.5"
        >
          Browse Achievers
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glow-card space-y-6">
      {/* Display name */}
      <div>
        <label className="glow-label font-medium">Display name *</label>
        <input
          type="text"
          className="glow-input"
          {...register('display_name', { required: 'Display name is required' })}
        />
        {errors.display_name && (
          <p className="text-xs text-red-500 mt-1">{errors.display_name.message}</p>
        )}
      </div>

      {/* University */}
      <div>
        <label className="glow-label font-medium">University *</label>
        <select
          className="glow-input"
          {...register('university_id', { required: 'Please select a university' })}
        >
          <option value="">Select a university...</option>
          {universities.map((uni) => (
            <option key={uni.id} value={uni.id}>
              {uni.name} ({uni.country})
            </option>
          ))}
        </select>
        {errors.university_id && (
          <p className="text-xs text-red-500 mt-1">{errors.university_id.message}</p>
        )}
      </div>

      {/* Degree level */}
      <div>
        <label className="glow-label font-medium">Degree level *</label>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['undergraduate', 'masters', 'phd', 'alumni'] as DegreeLevel[]).map((level) => (
            <label
              key={level}
              className={`glow-chip text-xs px-3 py-2 cursor-pointer text-center ${
                degreeLevel === level ? 'glow-chip-selected' : ''
              }`}
            >
              <input
                type="radio"
                value={level}
                className="sr-only"
                {...register('degree_level')}
              />
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </label>
          ))}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="glow-label font-medium">Subject *</label>
        <input
          type="text"
          className="glow-input"
          placeholder="e.g. Computer Science, Finance"
          {...register('subject', { required: 'Subject is required' })}
        />
        {errors.subject && (
          <p className="text-xs text-red-500 mt-1">{errors.subject.message}</p>
        )}
      </div>

      {/* Graduation year (conditional) */}
      {degreeLevel === 'alumni' && (
        <div>
          <label className="glow-label font-medium">Graduation year</label>
          <input
            type="number"
            className="glow-input"
            placeholder="e.g. 2023"
            {...register('graduation_year')}
          />
        </div>
      )}

      {/* Currently enrolled */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="currently_enrolled"
          className="w-4 h-4 rounded border-slate-300"
          {...register('currently_enrolled')}
        />
        <label htmlFor="currently_enrolled" className="text-sm text-slate-700">
          I am currently enrolled at this university
        </label>
      </div>

      {/* Bio */}
      <div>
        <label className="glow-label font-medium">Bio *</label>
        <textarea
          className="glow-input glow-textarea"
          placeholder="Tell students about your experience and how you can help them..."
          maxLength={400}
          {...register('bio', { required: 'Bio is required', maxLength: 400 })}
        />
        <p className="text-xs text-slate-400 mt-1">{(bio ?? '').length}/400</p>
        {errors.bio && (
          <p className="text-xs text-red-500 mt-1">{errors.bio.message}</p>
        )}
      </div>

      {/* Help topics */}
      <div>
        <label className="glow-label font-medium">What can you help with? *</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {HELP_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => toggleTopic(topic)}
              className={`glow-chip text-xs px-3 py-1.5 ${
                helpTopics.includes(topic) ? 'glow-chip-selected' : ''
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div>
        <label className="glow-label font-medium">Languages *</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => toggleLanguage(lang)}
              className={`glow-chip text-xs px-3 py-1.5 ${
                languages.includes(lang) ? 'glow-chip-selected' : ''
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Session price */}
      <div>
        <label className="glow-label font-medium">Session price (VND) *</label>
        <input
          type="number"
          className="glow-input"
          min={100000}
          step={50000}
          {...register('session_price_vnd', {
            required: 'Price is required',
            min: { value: 100000, message: 'Minimum 100,000 ₫' },
          })}
        />
        <p className="text-xs text-slate-400 mt-1">
          Most Achievers charge 200,000–600,000 ₫. Minimum: 100,000 ₫.
        </p>
        {errors.session_price_vnd && (
          <p className="text-xs text-red-500 mt-1">{errors.session_price_vnd.message}</p>
        )}
      </div>

      {/* Session duration */}
      <div>
        <label className="glow-label font-medium">Session duration *</label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[
            { value: '30', label: '30 min' },
            { value: '45', label: '45 min' },
            { value: '60', label: '60 min' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`glow-chip text-xs px-3 py-2 cursor-pointer text-center ${
                watch('session_duration_mins') === opt.value ? 'glow-chip-selected' : ''
              }`}
            >
              <input
                type="radio"
                value={opt.value}
                className="sr-only"
                {...register('session_duration_mins')}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="glow-button-primary w-full py-3"
      >
        {submitting ? 'Submitting...' : 'Submit application'}
      </button>
    </form>
  );
}
