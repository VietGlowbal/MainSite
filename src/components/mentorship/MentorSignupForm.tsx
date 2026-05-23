'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Currency, DegreeLevel } from '@/types/mentorship';
import { currencySymbol, formatMoney, toSmallestUnits } from '@/lib/currency';
import { CheckIcon, CloseIcon } from './mentor-icons';

const DEGREE_LEVELS: { value: DegreeLevel; label: string }[] = [
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'masters', label: 'Master\u2019s' },
  { value: 'phd', label: 'PhD' },
  { value: 'alumni', label: 'Alumni' },
];

const SUGGESTED_TOPICS = [
  'Personal statement',
  'SOP review',
  'Interview prep',
  'Course choice',
  'Visa & relocation',
  'Scholarships',
  'Life on campus',
  'Career planning',
  'Internships',
  'Research applications',
];

const SUGGESTED_STRENGTHS = [
  'Empathetic listener',
  'Strong writer',
  'Tech-savvy',
  'Multilingual',
  'STEM Olympiad veteran',
  'Startup experience',
  'Public speaking',
  'Mock interviews',
];

const SUGGESTED_LANGUAGES = [
  'English',
  'Vietnamese',
  'Mandarin',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Korean',
  'Hindi',
  'Arabic',
];

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'VND', label: 'VND (₫)' },
];

const STORAGE_BUCKET = 'mentor-documents';

type DocumentSlot = 'cv' | 'acceptance_letter' | 'transcript' | 'student_card';

const DOCUMENT_LABELS: Record<DocumentSlot, { title: string; hint: string; accept: string }> = {
  cv: {
    title: 'CV / Resume',
    hint: 'PDF preferred. Helps us verify your background.',
    accept: '.pdf,.doc,.docx',
  },
  acceptance_letter: {
    title: 'University acceptance letter',
    hint: 'Official letter or PDF showing you were accepted.',
    accept: '.pdf,.png,.jpg,.jpeg',
  },
  transcript: {
    title: 'Latest transcript',
    hint: 'Most recent academic transcript or grade summary.',
    accept: '.pdf,.png,.jpg,.jpeg',
  },
  student_card: {
    title: 'Student card / ID',
    hint: 'Photo of your university student card (alumni: a graduation cert is fine).',
    accept: '.pdf,.png,.jpg,.jpeg',
  },
};

type Props = {
  userId: string;
  defaultDisplayName: string;
  universities: { id: number; name: string; country: string }[];
};

type StepKey = 'basics' | 'profile' | 'review';

export function MentorSignupForm({ userId, defaultDisplayName, universities }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // ── Step 1: identity ───────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [legalName, setLegalName] = useState('');
  const [dob, setDob] = useState('');
  const [universityId, setUniversityId] = useState<number | null>(null);
  const [universitySearch, setUniversitySearch] = useState('');

  // ── Step 2: documents (storage keys) ───────────────────────────────────
  const [docKeys, setDocKeys] = useState<Record<DocumentSlot, string | null>>({
    cv: null,
    acceptance_letter: null,
    transcript: null,
    student_card: null,
  });
  const [docNames, setDocNames] = useState<Record<DocumentSlot, string | null>>({
    cv: null,
    acceptance_letter: null,
    transcript: null,
    student_card: null,
  });
  const [docUploading, setDocUploading] = useState<DocumentSlot | null>(null);

  // ── Step 3: profile content ────────────────────────────────────────────
  const [degreeLevel, setDegreeLevel] = useState<DegreeLevel>('undergraduate');
  const [subject, setSubject] = useState('');
  const [studyStartYear, setStudyStartYear] = useState<number | ''>('');
  const [graduationYear, setGraduationYear] = useState<number | ''>('');
  const [currentlyEnrolled, setCurrentlyEnrolled] = useState(true);
  const [bio, setBio] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [topicDraft, setTopicDraft] = useState('');
  const [strengthDraft, setStrengthDraft] = useState('');
  const [languageDraft, setLanguageDraft] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // ── Step 4: pricing ────────────────────────────────────────────────────
  const [currency, setCurrency] = useState<Currency>('USD');
  const [hourlyRateMajor, setHourlyRateMajor] = useState<string>('25'); // major units (25.00)

  // ── Submission ─────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<StepKey>('basics');

  const filteredUniversities = useMemo(() => {
    if (!universitySearch) return universities.slice(0, 30);
    const q = universitySearch.toLowerCase();
    return universities
      .filter((u) => u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q))
      .slice(0, 30);
  }, [universities, universitySearch]);

  const selectedUni = useMemo(
    () => universities.find((u) => u.id === universityId),
    [universities, universityId],
  );

  // ── Helpers ────────────────────────────────────────────────────────────

  async function uploadDocument(slot: DocumentSlot, file: File) {
    setDocUploading(slot);
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError('Files must be 10 MB or smaller.');
      setDocUploading(null);
      return;
    }
    const ext = file.name.split('.').pop() ?? 'bin';
    // eslint-disable-next-line react-hooks/purity -- random suffix in user event; not render-time
    const path = `${userId}/${slot}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true });
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setDocUploading(null);
      return;
    }
    setDocKeys((prev) => ({ ...prev, [slot]: path }));
    setDocNames((prev) => ({ ...prev, [slot]: file.name }));
    setDocUploading(null);
  }

  async function uploadAvatar(file: File) {
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photo must be 5 MB or smaller.');
      return;
    }
    const ext = file.name.split('.').pop() ?? 'jpg';
    // Avatars go to the public 'avatars' bucket so the mentor profile page
    // can render them without signing each URL.
    const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'avatars';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });
    if (upErr) {
      setError(`Avatar upload failed: ${upErr.message}`);
      return;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    setAvatarFile(file);
    setAvatarUrl(data.publicUrl);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function toggleFromList(value: string, list: string[], setList: (l: string[]) => void) {
    if (list.includes(value)) setList(list.filter((x) => x !== value));
    else setList([...list, value]);
  }

  function addCustomTag(value: string, list: string[], setList: (l: string[]) => void, reset: (s: string) => void) {
    const v = value.trim();
    if (!v) return;
    if (list.includes(v)) { reset(''); return; }
    setList([...list, v]);
    reset('');
  }

  // ── Step validation gates ──────────────────────────────────────────────

  // Step 1 ("basics") covers identity + at least one verification document.
  // We only require ONE doc up front so signup feels light; admins can ask
  // for more during manual review.
  const identityComplete =
    displayName.trim().length >= 2 &&
    legalName.trim().length >= 2 &&
    dob.length === 10 &&
    universityId !== null;

  const documentsComplete =
    !!docKeys.cv ||
    !!docKeys.acceptance_letter ||
    !!docKeys.transcript ||
    !!docKeys.student_card;

  const basicsComplete = identityComplete && documentsComplete;

  // Step 2 ("profile") covers profile content + pricing in one screen.
  const profileContentComplete =
    subject.trim().length >= 2 &&
    bio.trim().length >= 20 &&
    topics.length >= 1 &&
    strengths.length >= 1 &&
    languages.length >= 1;

  const pricingComplete = (() => {
    const n = Number(hourlyRateMajor);
    return Number.isFinite(n) && n > 0;
  })();

  const profileComplete = profileContentComplete && pricingComplete;

  const allValid = basicsComplete && profileComplete;

  // ── Submit ────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!allValid) {
      setError('Please complete all required steps.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload = {
      display_name: displayName.trim(),
      legal_name: legalName.trim(),
      date_of_birth: dob,
      university_id: universityId!,
      avatar_url: avatarUrl,
      degree_level: degreeLevel,
      subject: subject.trim(),
      graduation_year: graduationYear === '' ? null : Number(graduationYear),
      study_start_year: studyStartYear === '' ? null : Number(studyStartYear),
      currently_enrolled: currentlyEnrolled,
      bio: bio.trim(),
      help_topics: topics,
      strengths,
      languages,
      cv_storage_key: docKeys.cv ?? null,
      acceptance_letter_storage_key: docKeys.acceptance_letter ?? null,
      transcript_storage_key: docKeys.transcript ?? null,
      student_card_storage_key: docKeys.student_card ?? null,
      hourly_rate_amount: toSmallestUnits(Number(hourlyRateMajor), currency),
      hourly_rate_currency: currency,
    };

    const res = await fetch('/api/mentorship/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not submit your application.');
      setSubmitting(false);
      return;
    }

    // Mentors set their availability slots from the dashboard once
    // approved — no need to collect them at signup time.

    setSubmitting(false);
    router.push('/mentors/apply/success');
  }

  // ── Render helpers ─────────────────────────────────────────────────────

  const stepOrder: StepKey[] = ['basics', 'profile', 'review'];
  const stepLabels: Record<StepKey, string> = {
    basics: 'Basics',
    profile: 'Profile & pricing',
    review: 'Review',
  };
  const stepDone: Record<StepKey, boolean> = {
    basics: basicsComplete,
    profile: profileComplete,
    review: false,
  };

  return (
    <div className="space-y-6">
      {/* Step nav */}
      <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-black/5 bg-white/95 p-2 shadow-[0_12px_32px_rgba(22,33,62,0.04)]">
        {stepOrder.map((key, i) => {
          const active = step === key;
          const done = stepDone[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStep(key)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-[0_6px_16px_rgba(255,77,140,0.20)]'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem] font-bold ${
                  active ? 'bg-white/20' : done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {done && !active ? <CheckIcon size={10} /> : i + 1}
              </span>
              {stepLabels[key]}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Basics: identity + at least one verification document */}
      {step === 'basics' && (
        <Section
          title="Tell us who you are"
          description="A few quick details for verification. Only your display name and university show up publicly."
        >
          <Field label="Display name (shown publicly)" required>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={120}
              placeholder="e.g. Linh N."
              className="field"
            />
          </Field>
          <Field label="Full legal name (private)" required>
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              maxLength={160}
              placeholder="As it appears on your official documents"
              className="field"
            />
          </Field>
          <Field label="Date of birth (private)" required>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="field"
            />
          </Field>
          <Field label="University" required>
            <input
              type="text"
              placeholder="Search by name or country"
              value={universitySearch}
              onChange={(e) => setUniversitySearch(e.target.value)}
              className="field"
            />
            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-100">
              {filteredUniversities.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => setUniversityId(u.id)}
                  className={`flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 transition ${
                    universityId === u.id ? 'bg-pink-50/70 text-pink-700' : 'hover:bg-slate-50'
                  }`}
                >
                  <span>{u.name}</span>
                  <span className="text-xs text-slate-400">{u.country}</span>
                </button>
              ))}
              {filteredUniversities.length === 0 && (
                <p className="px-3 py-3 text-sm text-slate-400">No universities match.</p>
              )}
            </div>
            {selectedUni && (
              <p className="mt-2 text-xs text-emerald-600">
                Selected: <strong>{selectedUni.name}</strong> ({selectedUni.country})
              </p>
            )}
          </Field>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-sm font-semibold text-slate-900">Verification document <span className="text-pink-500">*</span></p>
            <p className="mt-1 text-xs text-slate-500">
              Upload at least one document so our team can verify you. Any of the four below works — we&rsquo;ll ask for more later if needed. Max 10&nbsp;MB each.
            </p>
            <div className="mt-3 grid gap-3">
              {(['cv', 'acceptance_letter', 'transcript', 'student_card'] as DocumentSlot[]).map((slot) => (
                <DocumentField
                  key={slot}
                  slot={slot}
                  fileName={docNames[slot]}
                  uploading={docUploading === slot}
                  onChange={(file) => uploadDocument(slot, file)}
                  onClear={() => {
                    setDocKeys((p) => ({ ...p, [slot]: null }));
                    setDocNames((p) => ({ ...p, [slot]: null }));
                  }}
                />
              ))}
            </div>
          </div>

          <FooterNav onNext={() => setStep('profile')} disabled={!basicsComplete} />
        </Section>
      )}

      {/* Profile + pricing on one screen */}
      {step === 'profile' && (
        <Section
          title="Build your mentor profile"
          description="This is what mentees see. Be specific about what you can help with — vague profiles get fewer bookings."
        >
          {/* Avatar */}
          <Field label="Profile photo (optional but recommended)">
            <div className="flex items-center gap-4">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full"
                style={{
                  background: avatarPreview ? 'transparent' : 'linear-gradient(135deg,#ff4d8c,#00b4d8)',
                  padding: avatarPreview ? 0 : 3,
                }}
              >
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-xl">
                    📷
                  </div>
                )}
              </div>
              <div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-pink-200">
                  {avatarFile ? 'Change photo' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAvatar(f);
                    }}
                  />
                </label>
              </div>
            </div>
          </Field>

          <Field label="Degree level" required>
            <div className="flex flex-wrap gap-2">
              {DEGREE_LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setDegreeLevel(l.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    degreeLevel === l.value
                      ? 'border-pink-300 bg-pink-50 text-pink-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Subject / programme" required>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Computer Science, MEng"
              className="field"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Study start year">
              <input
                type="number"
                min={1900}
                max={2100}
                value={studyStartYear}
                onChange={(e) => setStudyStartYear(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 2021"
                className="field"
              />
            </Field>
            <Field label={currentlyEnrolled ? 'Expected graduation year' : 'Graduation year'}>
              <input
                type="number"
                min={1900}
                max={2100}
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 2025"
                className="field"
              />
            </Field>
          </div>

          <Field label="Status">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentlyEnrolled(true)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  currentlyEnrolled ? 'border-pink-300 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Currently studying
              </button>
              <button
                type="button"
                onClick={() => setCurrentlyEnrolled(false)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  !currentlyEnrolled ? 'border-pink-300 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Alumni
              </button>
            </div>
          </Field>

          <Field label="Bio" required hint={`${bio.length}/800`}>
            <textarea
              rows={5}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={800}
              placeholder="Share your story, what makes your perspective unique, and how you can help applicants."
              className="field min-h-[120px]"
            />
          </Field>

          <Field
            label="Topics you can help with"
            required
            hint={`${topics.length} selected · pick at least one`}
          >
            <ChipPicker
              options={SUGGESTED_TOPICS}
              selected={topics}
              onToggle={(v) => toggleFromList(v, topics, setTopics)}
            />
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTag(topicDraft, topics, setTopics, setTopicDraft);
                  }
                }}
                placeholder="Add another"
                maxLength={60}
                className="field flex-1"
              />
              <button
                type="button"
                onClick={() => addCustomTag(topicDraft, topics, setTopics, setTopicDraft)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-pink-200"
              >
                Add
              </button>
            </div>
          </Field>

          <Field
            label="Special skills / strengths"
            required
            hint="What makes you stand out?"
          >
            <ChipPicker
              options={SUGGESTED_STRENGTHS}
              selected={strengths}
              onToggle={(v) => toggleFromList(v, strengths, setStrengths)}
            />
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={strengthDraft}
                onChange={(e) => setStrengthDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTag(strengthDraft, strengths, setStrengths, setStrengthDraft);
                  }
                }}
                placeholder="Add another"
                maxLength={60}
                className="field flex-1"
              />
              <button
                type="button"
                onClick={() => addCustomTag(strengthDraft, strengths, setStrengths, setStrengthDraft)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-pink-200"
              >
                Add
              </button>
            </div>
          </Field>

          <Field label="Languages you can mentor in" required>
            <ChipPicker
              options={SUGGESTED_LANGUAGES}
              selected={languages}
              onToggle={(v) => toggleFromList(v, languages, setLanguages)}
            />
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={languageDraft}
                onChange={(e) => setLanguageDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTag(languageDraft, languages, setLanguages, setLanguageDraft);
                  }
                }}
                placeholder="Add another language"
                maxLength={40}
                className="field flex-1"
              />
              <button
                type="button"
                onClick={() => addCustomTag(languageDraft, languages, setLanguages, setLanguageDraft)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-pink-200"
              >
                Add
              </button>
            </div>
          </Field>
        </Section>
      )}

      {/* Pricing is rendered as a second card under the profile content so
          everything that mentees care about lives on one step. */}
      {step === 'profile' && (
        <Section
          title="Set your hourly rate"
          description="You keep 90% of your hourly rate. Glowbal adds a 10% service fee on top, charged to the mentee."
        >
          <Field label="Currency" required>
            <div className="flex gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCurrency(c.value)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    currency === c.value
                      ? 'border-pink-300 bg-pink-50 text-pink-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Hourly rate" required>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold text-slate-900">
                {currencySymbol(currency)}
              </span>
              <input
                type="number"
                min={0}
                step={currency === 'VND' ? 1000 : 1}
                value={hourlyRateMajor}
                onChange={(e) => setHourlyRateMajor(e.target.value)}
                className="field max-w-[200px] text-2xl font-semibold"
              />
              <span className="text-sm text-slate-500">/ hour</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              You receive <strong>{formatMoney(toSmallestUnits(Number(hourlyRateMajor || 0), currency), currency)}</strong> per session.
              The mentee pays{' '}
              <strong>
                {formatMoney(
                  Math.round(toSmallestUnits(Number(hourlyRateMajor || 0), currency) * 1.1),
                  currency,
                )}
              </strong>
              {' '}including the service fee.
            </p>
          </Field>

          <p className="text-xs text-slate-500">
            You can add availability slots from your mentor dashboard once you&rsquo;re approved.
          </p>

          <FooterNav
            onPrev={() => setStep('basics')}
            onNext={() => setStep('review')}
            disabled={!profileComplete}
          />
        </Section>
      )}

      {/* Review & submit */}
      {step === 'review' && (
        <Section
          title="Review &amp; submit"
          description="Double-check everything below. Your application goes to Glowbal admins for verification."
        >
          <ReviewPanel
            displayName={displayName}
            legalName={legalName}
            dob={dob}
            university={selectedUni?.name ?? '—'}
            degreeLevel={degreeLevel}
            subject={subject}
            documentsCount={Object.values(docKeys).filter(Boolean).length}
            topics={topics}
            strengths={strengths}
            languages={languages}
            currency={currency}
            hourlyMajor={Number(hourlyRateMajor)}
          />

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-xs text-slate-500">
            By submitting, you confirm that all documents are genuine and that you&rsquo;ll respect mentee privacy.
            Glowbal will email you within 48 hours with the outcome.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('profile')}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-pink-200"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allValid || submitting}
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Sub-components (kept in same file to avoid dozens of new files) ──────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-black/5 bg-white/95 p-6 shadow-[0_12px_32px_rgba(22,33,62,0.06)]">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="text-pink-500"> *</span>}
        {hint && <span className="ml-2 text-xs font-normal text-slate-400">{hint}</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function ChipPicker({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from(new Set([...options, ...selected])).map((v) => {
        const active = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              active
                ? 'border-pink-300 bg-pink-50 text-pink-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200'
            }`}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

function FooterNav({ onPrev, onNext, disabled }: { onPrev?: () => void; onNext: () => void; disabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      {onPrev ? (
        <button
          type="button"
          onClick={onPrev}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-pink-200"
        >
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(255,77,140,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}

function DocumentField({
  slot,
  fileName,
  uploading,
  onChange,
  onClear,
}: {
  slot: DocumentSlot;
  fileName: string | null;
  uploading: boolean;
  onChange: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = DOCUMENT_LABELS[slot];

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition ${
        fileName
          ? 'border-emerald-200 bg-emerald-50/60'
          : 'border-slate-200 bg-white hover:border-pink-200'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{meta.title}</p>
        <p className="text-xs text-slate-500">{meta.hint}</p>
        {fileName && (
          <p className="mt-1 truncate text-xs text-emerald-700">
            <CheckIcon size={12} className="inline align-middle" /> {fileName}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {fileName && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Remove ${meta.title}`}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500"
          >
            <CloseIcon size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-pink-200 disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : fileName ? 'Replace' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={meta.accept}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onChange(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

// ── Review summary ──────────────────────────────────────────────────────────

function ReviewPanel(props: {
  displayName: string;
  legalName: string;
  dob: string;
  university: string;
  degreeLevel: DegreeLevel;
  subject: string;
  documentsCount: number;
  topics: string[];
  strengths: string[];
  languages: string[];
  currency: Currency;
  hourlyMajor: number;
}) {
  const total = toSmallestUnits(props.hourlyMajor, props.currency);
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-700 sm:grid-cols-2">
      <Row label="Display name" value={props.displayName} />
      <Row label="Legal name" value={props.legalName} muted />
      <Row label="DOB" value={props.dob} muted />
      <Row label="University" value={props.university} />
      <Row label="Programme" value={`${props.degreeLevel} · ${props.subject}`} />
      <Row label="Documents" value={`${props.documentsCount} of 4 uploaded`} />
      <Row label="Topics" value={props.topics.join(', ') || '—'} />
      <Row label="Strengths" value={props.strengths.join(', ') || '—'} />
      <Row label="Languages" value={props.languages.join(', ') || '—'} />
      <Row label="Hourly rate" value={formatMoney(total, props.currency)} />
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 ${muted ? 'text-slate-500' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
