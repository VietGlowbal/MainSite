'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Currency, DegreeLevel } from '@/types/mentorship';
import { currencySymbol, formatMoney, toSmallestUnits } from '@/lib/currency';
import { CheckIcon, CloseIcon } from './mentor-icons';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

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
  /** Fast-track flow: hide the document step (validated server-side). */
  quickSignup?: boolean;
  /** Secret token forwarded to the signup API to authorise the fast-track. */
  quickSignupToken?: string | null;
};

type StepKey = 'identity' | 'documents' | 'profile' | 'pricing' | 'availability' | 'review';

export function MentorSignupForm({
  userId,
  defaultDisplayName,
  universities,
  quickSignup = false,
  quickSignupToken = null,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // ── Step 1: identity ───────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [legalName, setLegalName] = useState('');
  const [dob, setDob] = useState('');
  const [universityId, setUniversityId] = useState<number | null>(null);
  const [universitySearch, setUniversitySearch] = useState('');
  // "My university isn't listed" path — the applicant types a name + country
  // and we create (or match) the university server-side on submit.
  const [addingCustomUni, setAddingCustomUni] = useState(false);
  const [customUniName, setCustomUniName] = useState('');
  const [customUniCountry, setCustomUniCountry] = useState('');

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

  // ── Step 5: availability slots (ISO strings) ──────────────────────────
  const [availabilitySlots, setAvailabilitySlots] = useState<string[]>([]); // ISO of starts_at

  // ── Submission ─────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  useLoadingIndicator(submitting, 'Submitting your application');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<StepKey>('identity');

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

  // A typed-in university counts once both its name and country are filled.
  const customUniValid =
    addingCustomUni &&
    customUniName.trim().length >= 2 &&
    customUniCountry.trim().length >= 2;

  const identityComplete =
    displayName.trim().length >= 2 &&
    legalName.trim().length >= 2 &&
    dob.length === 10 &&
    (universityId !== null || customUniValid);

  const documentsComplete =
    quickSignup ||
    (!!docKeys.cv &&
      !!docKeys.acceptance_letter &&
      !!docKeys.transcript &&
      !!docKeys.student_card);

  const profileComplete =
    subject.trim().length >= 2 &&
    bio.trim().length >= 20 &&
    topics.length >= 1 &&
    strengths.length >= 1 &&
    languages.length >= 1;

  const pricingComplete = (() => {
    const n = Number(hourlyRateMajor);
    return Number.isFinite(n) && n > 0;
  })();

  const allValid = identityComplete && documentsComplete && profileComplete && pricingComplete;

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
      // Either an existing university id, or a typed-in name + country that the
      // server will match-or-create. Exactly one of these is populated.
      university_id: universityId,
      custom_university_name:
        universityId === null && customUniValid ? customUniName.trim() : null,
      custom_university_country:
        universityId === null && customUniValid ? customUniCountry.trim() : null,
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
      cv_storage_key: docKeys.cv,
      acceptance_letter_storage_key: docKeys.acceptance_letter,
      transcript_storage_key: docKeys.transcript,
      student_card_storage_key: docKeys.student_card,
      hourly_rate_amount: toSmallestUnits(Number(hourlyRateMajor), currency),
      hourly_rate_currency: currency,
      quick_signup_token: quickSignupToken,
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

    // After the profile exists, push the availability slots in one batch.
    if (availabilitySlots.length > 0) {
      try {
        await fetch('/api/mentorship/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slots: availabilitySlots.map((iso) => ({ starts_at: iso, duration_mins: 60 })),
          }),
        });
      } catch (err) {
        console.warn('Could not save initial availability', err);
      }
    }

    setSubmitting(false);
    router.push('/mentors/apply/success');
  }

  // ── Render helpers ─────────────────────────────────────────────────────

  const stepOrder: StepKey[] = quickSignup
    ? ['identity', 'profile', 'pricing', 'availability', 'review']
    : ['identity', 'documents', 'profile', 'pricing', 'availability', 'review'];
  const stepLabels: Record<StepKey, string> = {
    identity: 'Identity',
    documents: 'Documents',
    profile: 'Profile',
    pricing: 'Pricing',
    availability: 'Availability',
    review: 'Review',
  };
  const stepDone: Record<StepKey, boolean> = {
    identity: identityComplete,
    documents: documentsComplete,
    profile: profileComplete,
    pricing: pricingComplete,
    availability: true, // optional
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

      {/* Identity */}
      {step === 'identity' && (
        <Section
          title="Tell us who you are"
          description="These four fields are required for verification. Only your display name and university show up publicly."
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
            {!addingCustomUni ? (
              <>
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
                <button
                  type="button"
                  onClick={() => {
                    setAddingCustomUni(true);
                    setUniversityId(null);
                    // Pre-fill the name with whatever they were searching for.
                    setCustomUniName(universitySearch.trim());
                  }}
                  className="mt-2 text-xs font-semibold text-pink-600 hover:text-pink-700"
                >
                  Can&rsquo;t find your university? Add it manually
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Tell us your university and country — we&rsquo;ll add it to GlowBal so other
                  students can find you. (It&rsquo;s reviewed by our team alongside your application.)
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="University name"
                    value={customUniName}
                    onChange={(e) => setCustomUniName(e.target.value)}
                    maxLength={160}
                    className="field"
                  />
                  <input
                    type="text"
                    placeholder="Country"
                    value={customUniCountry}
                    onChange={(e) => setCustomUniCountry(e.target.value)}
                    maxLength={120}
                    className="field"
                  />
                </div>
                {customUniValid && (
                  <p className="mt-2 text-xs text-emerald-600">
                    Adding: <strong>{customUniName.trim()}</strong> ({customUniCountry.trim()})
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAddingCustomUni(false);
                    setCustomUniName('');
                    setCustomUniCountry('');
                  }}
                  className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  ← Back to the university list
                </button>
              </>
            )}
          </Field>

          <FooterNav onNext={() => setStep(quickSignup ? 'profile' : 'documents')} disabled={!identityComplete} />
        </Section>
      )}

      {/* Documents */}
      {step === 'documents' && (
        <Section
          title="Verification documents"
          description="We review every mentor manually. These four documents are stored privately and only seen by Glowbal admins."
        >
          <div className="grid gap-3">
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

          <FooterNav
            onPrev={() => setStep('identity')}
            onNext={() => setStep('profile')}
            disabled={!documentsComplete}
          />
        </Section>
      )}

      {/* Profile */}
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
                min={1980}
                max={2050}
                value={studyStartYear}
                onChange={(e) => setStudyStartYear(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 2021"
                className="field"
              />
            </Field>
            <Field label={currentlyEnrolled ? 'Expected graduation year' : 'Graduation year'}>
              <input
                type="number"
                min={1980}
                max={2050}
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

          <FooterNav
            onPrev={() => setStep(quickSignup ? 'identity' : 'documents')}
            onNext={() => setStep('pricing')}
            disabled={!profileComplete}
          />
        </Section>
      )}

      {/* Pricing */}
      {step === 'pricing' && (
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

          <FooterNav
            onPrev={() => setStep('profile')}
            onNext={() => setStep('availability')}
            disabled={!pricingComplete}
          />
        </Section>
      )}

      {/* Availability */}
      {step === 'availability' && (
        <Section
          title="Pick your free times"
          description="Click any future date to add 1-hour slots. You can change these any time from your dashboard."
        >
          <MonthlyAvailabilityPicker
            slots={availabilitySlots}
            onSlotsChange={setAvailabilitySlots}
          />

          <FooterNav
            onPrev={() => setStep('pricing')}
            onNext={() => setStep('review')}
            disabled={false}
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
            university={
              selectedUni?.name ??
              (customUniValid ? `${customUniName.trim()} (new — pending review)` : '—')
            }
            degreeLevel={degreeLevel}
            subject={subject}
            quickSignup={quickSignup}
            documentsCount={Object.values(docKeys).filter(Boolean).length}
            topics={topics}
            strengths={strengths}
            languages={languages}
            currency={currency}
            hourlyMajor={Number(hourlyRateMajor)}
            slotCount={availabilitySlots.length}
          />

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-xs text-slate-500">
            {quickSignup
              ? 'By submitting, you confirm the details above are accurate and that you’ll respect mentee privacy. '
              : 'By submitting, you confirm that all documents are genuine and that you’ll respect mentee privacy. '}
            Glowbal will email you within 48 hours with the outcome.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('pricing')}
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

// ── Monthly availability picker ─────────────────────────────────────────────

const TIME_SLOTS = ['09:00', '11:00', '14:00', '16:00', '18:00', '20:00'];

// Local YYYY-MM-DD key. We deliberately use the browser's local date parts
// (not toISOString, which is UTC) so the calendar matches what the mentor
// sees — critical for Vietnam (UTC+7), where a UTC key is a day behind.
function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function MonthlyAvailabilityPicker({
  slots,
  onSlotsChange,
}: {
  slots: string[];
  onSlotsChange: (s: string[]) => void;
}) {
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  // Multi-select: the mentor can mark several days, then apply times to all of
  // them at once (Calendly-style), rather than editing one day at a time.
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [customTime, setCustomTime] = useState<string>('10:00');

  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const cells: (Date | null)[] = [];
  const lead = (monthStart.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = localDateKey(new Date());

  function countOnDate(key: string): number {
    return slots.filter((iso) => localDateKey(new Date(iso)) === key).length;
  }

  function toggleDay(key: string) {
    setSelectedDates((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function isoFor(date: string, time: string) {
    return new Date(`${date}T${time}:00`).toISOString();
  }

  // Whether every currently-selected day already has this time.
  function allSelectedHave(time: string) {
    return selectedDates.length > 0 && selectedDates.every((date) => slots.includes(isoFor(date, time)));
  }

  // Toggle a time across all selected days: if they all already have it, clear
  // it from each; otherwise add it wherever it's missing.
  function applyTimeToSelected(time: string) {
    if (selectedDates.length === 0) return;
    const targets = selectedDates.map((date) => isoFor(date, time));
    if (targets.every((iso) => slots.includes(iso))) {
      const drop = new Set(targets);
      onSlotsChange(slots.filter((iso) => !drop.has(iso)));
    } else {
      const next = new Set(slots);
      for (const iso of targets) next.add(iso);
      onSlotsChange([...next]);
    }
  }

  function removeSlot(iso: string) {
    onSlotsChange(slots.filter((s) => s !== iso));
  }

  // All chosen availability, grouped by day for the summary list.
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const iso of slots) {
      const key = localDateKey(new Date(iso));
      const arr = map.get(key) ?? [];
      arr.push(iso);
      map.set(key, arr);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, isos]) => ({
        key,
        isos: isos.sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
      }));
  }, [slots]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3">
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="text-sm font-semibold text-slate-900">
          {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Tap one or more days, then add the times you&rsquo;re free below. Selected days turn pink; days with saved times show a count.
      </p>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} className="h-10" />;
          const key = localDateKey(cell);
          const isPast = key < todayKey;
          const count = countOnDate(key);
          const selected = selectedDates.includes(key);
          return (
            <button
              key={key}
              type="button"
              disabled={isPast}
              onClick={() => toggleDay(key)}
              aria-pressed={selected}
              className={`relative flex h-10 items-center justify-center rounded-xl border text-xs font-semibold transition ${
                isPast
                  ? 'border-transparent text-slate-300'
                  : selected
                  ? 'border-pink-300 bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white'
                  : count > 0
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200'
              }`}
            >
              {cell.getDate()}
              {count > 0 && (
                <span className="absolute bottom-1 right-1 text-[0.6rem]">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Apply times to whichever days are selected */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4">
        {selectedDates.length === 0 ? (
          <p className="text-xs text-slate-500">Select one or more days above to add times.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Add times to {selectedDates.length} selected day{selectedDates.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                onClick={() => setSelectedDates([])}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Clear selection
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TIME_SLOTS.map((t) => {
                const active = allSelectedHave(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => applyTimeToSelected(t)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      active
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="field max-w-[140px]"
              />
              <button
                type="button"
                onClick={() => applyTimeToSelected(customTime)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-pink-200"
              >
                Add custom time
              </button>
            </div>
          </>
        )}
      </div>

      {/* Summary of everything chosen, grouped by day */}
      {grouped.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Your availability — {slots.length} slot{slots.length === 1 ? '' : 's'} across {grouped.length} day{grouped.length === 1 ? '' : 's'}
          </p>
          <div className="mt-3 space-y-2.5">
            {grouped.map(({ key, isos }) => (
              <div key={key} className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-sm font-semibold text-slate-800">
                  {new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {isos.map((iso) => (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => removeSlot(iso)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      title="Remove this time"
                    >
                      {new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      <CloseIcon size={11} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        You can change all of this any time from your mentor dashboard.
      </p>
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
  quickSignup: boolean;
  documentsCount: number;
  topics: string[];
  strengths: string[];
  languages: string[];
  currency: Currency;
  hourlyMajor: number;
  slotCount: number;
}) {
  const total = toSmallestUnits(props.hourlyMajor, props.currency);
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-700 sm:grid-cols-2">
      <Row label="Display name" value={props.displayName} />
      <Row label="Legal name" value={props.legalName} muted />
      <Row label="DOB" value={props.dob} muted />
      <Row label="University" value={props.university} />
      <Row label="Programme" value={`${props.degreeLevel} · ${props.subject}`} />
      <Row
        label="Documents"
        value={props.quickSignup ? 'Fast-track — not required' : `${props.documentsCount} / 4 uploaded`}
      />
      <Row label="Topics" value={props.topics.join(', ') || '—'} />
      <Row label="Strengths" value={props.strengths.join(', ') || '—'} />
      <Row label="Languages" value={props.languages.join(', ') || '—'} />
      <Row label="Hourly rate" value={formatMoney(total, props.currency)} />
      <Row label="Initial slots" value={`${props.slotCount} added`} />
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
