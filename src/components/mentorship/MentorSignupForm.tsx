'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage, useT } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import type { Currency, DegreeLevel } from '@/types/mentorship';
import { currencySymbol, formatMoney, toSmallestUnits } from '@/lib/currency';
import { CloseIcon } from './mentor-icons';
import {
  Avatar,
  Button,
  DocumentRow,
  FileDropzone,
  FormField,
  ICONS,
  Input,
  KitIcon,
  Panel,
  PanelHeader,
  Stepper,
  Textarea,
  controlClasses,
  type StepperStep,
} from '@/shared/ui';
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
  const t = useT();
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
  const [hourlyRateMajor, setHourlyRateMajor] = useState<string>('');

  // ── Step 5: availability slots (ISO strings) ──────────────────────────
  const [availabilitySlots, setAvailabilitySlots] = useState<string[]>([]); // ISO of starts_at

  // ── Submission ─────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  useLoadingIndicator(submitting, t('Submitting your application'));
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
      setError(t('Files must be 10 MB or smaller.'));
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
      setError(t('Upload failed: {message}', { message: upErr.message }));
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
      setError(t('Profile photo must be 5 MB or smaller.'));
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
      setError(t('Avatar upload failed: {message}', { message: upErr.message }));
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
    return hourlyRateMajor.trim() !== '' && Number.isFinite(n) && n > 0;
  })();

  const availabilityComplete = availabilitySlots.length > 0;

  const allValid = identityComplete && documentsComplete && profileComplete && pricingComplete;

  // ── Submit ────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!allValid) {
      setError(t('Please complete all required steps.'));
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
      setError(t(body.error ?? 'Could not submit your application.'));
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
    router.push('/advisors/apply/success');
  }

  // ── Render helpers ─────────────────────────────────────────────────────

  const stepOrder: StepKey[] = quickSignup
    ? ['identity', 'profile', 'pricing', 'availability', 'review']
    : ['identity', 'documents', 'profile', 'pricing', 'availability', 'review'];
  const stepLabels: Record<StepKey, string> = {
    identity: t('Identity'),
    documents: t('Documents'),
    profile: t('Profile'),
    pricing: t('Pricing'),
    availability: t('Availability'),
    review: t('Review'),
  };
  const stepDone: Record<StepKey, boolean> = {
    identity: identityComplete,
    documents: documentsComplete,
    profile: profileComplete,
    pricing: pricingComplete,
    availability: availabilityComplete,
    review: false,
  };

  const currentStepIndex = stepOrder.indexOf(step);
  const stepperSteps: StepperStep[] = stepOrder.map((key) => ({
    key,
    label: stepLabels[key],
    complete: stepDone[key],
    ...(key === 'availability' && !availabilityComplete ? { meta: t('Optional') } : {}),
  }));

  return (
    <div className="flex flex-col gap-gb-3xl">
      <Panel padding="sm" elevation="flat">
        <Stepper
          steps={stepperSteps}
          currentIndex={currentStepIndex}
          label={t('Advisor application progress')}
          onStepSelect={(key) => setStep(key as StepKey)}
        />
      </Panel>

      {error && (
        <div
          role="alert"
          className="rounded-gb-xl border border-line-error bg-surface-error p-gb-xl text-gb-sm text-fg-error"
        >
          {error}
        </div>
      )}

      {/* Identity */}
      {step === 'identity' && (
        <Section
          title={t('Tell us who you are')}
          description={t('These four fields are required for verification. Only your display name and university show up publicly.')}
        >
          <Input
            name="advisor-display-name"
            label={t('Display name (shown publicly)')}
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
            placeholder={t('e.g. Linh N.')}
            required
          />
          <Input
            name="advisor-legal-name"
            label={t('Full legal name (private)')}
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            maxLength={160}
            placeholder={t('As it appears on your official documents')}
            required
          />
          <Input
            name="advisor-date-of-birth"
            label={t('Date of birth (private)')}
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            required
          />
          <Field label={t('University')} required>
            {!addingCustomUni ? (
              <div className="flex flex-col gap-gb-md">
                <input
                  id="advisor-university-search"
                  type="text"
                  placeholder={t('Search by name or country')}
                  value={universitySearch}
                  onChange={(e) => setUniversitySearch(e.target.value)}
                  className={controlClasses(false)}
                />
                <div className="max-h-64 overflow-y-auto rounded-gb-md border border-line bg-surface shadow-gb-xs">
                  {filteredUniversities.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => setUniversityId(u.id)}
                      aria-pressed={universityId === u.id}
                      className={`flex w-full items-center justify-between gap-gb-lg border-b border-line px-gb-xl py-gb-lg text-left text-gb-sm transition-colors last:border-b-0 ${
                        universityId === u.id
                          ? 'bg-brand-subtle text-fg-brand'
                          : 'text-fg-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <span className="font-medium">{u.name}</span>
                      <span className="shrink-0 text-gb-xs text-fg-muted">{t(u.country)}</span>
                    </button>
                  ))}
                  {filteredUniversities.length === 0 && (
                    <p className="px-gb-xl py-gb-2xl text-gb-sm text-fg-muted">{t('No universities match.')}</p>
                  )}
                </div>
                {selectedUni && (
                  <div className="flex items-start gap-gb-sm rounded-gb-lg bg-tier-safe p-gb-lg text-gb-sm text-on-tier-safe">
                    <KitIcon art={ICONS.checkCircle} frame={16} className="mt-gb-xxs shrink-0" />
                    <p>{t('Selected:')} <strong>{selectedUni.name}</strong> ({t(selectedUni.country)})</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAddingCustomUni(true);
                    setUniversityId(null);
                    // Pre-fill the name with whatever they were searching for.
                    setCustomUniName(universitySearch.trim());
                  }}
                  className="w-fit rounded-gb-sm text-gb-sm font-semibold text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {t('Can’t find your university? Add it manually')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-gb-lg">
                <p className="text-gb-sm leading-relaxed text-fg-tertiary">
                  {t('Tell us your university and country — we’ll add it to GlowBal so other students can find you. (It’s reviewed by our team alongside your application.)')}
                </p>
                <div className="grid gap-gb-lg sm:grid-cols-2">
                  <Input
                    name="advisor-custom-university"
                    label={t('University name')}
                    type="text"
                    placeholder={t('University name')}
                    value={customUniName}
                    onChange={(e) => setCustomUniName(e.target.value)}
                    maxLength={160}
                  />
                  <Input
                    name="advisor-custom-country"
                    label={t('Country')}
                    type="text"
                    placeholder={t('Country')}
                    value={customUniCountry}
                    onChange={(e) => setCustomUniCountry(e.target.value)}
                    maxLength={120}
                  />
                </div>
                {customUniValid && (
                  <div className="flex items-start gap-gb-sm rounded-gb-lg bg-tier-safe p-gb-lg text-gb-sm text-on-tier-safe">
                    <KitIcon art={ICONS.checkCircle} frame={16} className="mt-gb-xxs shrink-0" />
                    <p>{t('Adding:')} <strong>{customUniName.trim()}</strong> ({t(customUniCountry.trim())})</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAddingCustomUni(false);
                    setCustomUniName('');
                    setCustomUniCountry('');
                  }}
                  className="w-fit rounded-gb-sm text-gb-sm font-semibold text-fg-secondary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {t('← Back to the university list')}
                </button>
              </div>
            )}
          </Field>

          <FooterNav onNext={() => setStep(quickSignup ? 'profile' : 'documents')} disabled={!identityComplete} />
        </Section>
      )}

      {/* Documents */}
      {step === 'documents' && (
        <Section
          title={t('Verification documents')}
          description={t('We review every advisor manually. These four documents are stored privately and only seen by GlowBal admins.')}
        >
          <div className="grid gap-gb-xl lg:grid-cols-2">
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
          title={t('Build your advisor profile')}
          description={t('This is what mentees see. Be specific about what you can help with — vague profiles get fewer bookings.')}
        >
          {/* Avatar */}
          <Field label={t('Profile photo (optional but recommended)')}>
            <div className="grid gap-gb-xl rounded-gb-xl border border-line bg-surface-muted p-gb-xl sm:grid-cols-[auto_1fr] sm:items-center">
              <Avatar
                name={displayName || legalName || t('Advisor')}
                src={avatarPreview}
                size="lg"
              />
              <FileDropzone
                onFiles={(files) => {
                  const file = files[0];
                  if (file) void uploadAvatar(file);
                }}
                accept="image/*"
                label={t(avatarFile ? 'Change photo' : 'Upload photo')}
                secondaryLabel={t('or drag and drop')}
                hint={t('PNG, JPG or WebP up to 5 MB')}
                className="min-w-0"
              />
            </div>
          </Field>

          <Field label={t('Degree level')} required>
            <div className="grid gap-gb-sm sm:grid-cols-2 lg:grid-cols-4">
              {DEGREE_LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setDegreeLevel(l.value)}
                  aria-pressed={degreeLevel === l.value}
                  className={`rounded-gb-md border px-gb-xl py-gb-lg text-gb-sm font-semibold shadow-gb-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    degreeLevel === l.value
                      ? 'border-brand bg-brand-subtle text-fg-brand'
                      : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
                  }`}
                >
                  {t(l.label)}
                </button>
              ))}
            </div>
          </Field>

          <Input
            name="advisor-subject"
            label={t('Subject / programme')}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('e.g. Computer Science, MEng')}
            required
          />

          <div className="grid gap-gb-lg sm:grid-cols-2">
            <Input
              name="advisor-study-start-year"
              label={t('Study start year')}
              type="number"
              min={1980}
              max={2050}
              value={studyStartYear}
              onChange={(e) => setStudyStartYear(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={t('e.g. 2021')}
            />
            <Input
              name="advisor-graduation-year"
              label={t(currentlyEnrolled ? 'Expected graduation year' : 'Graduation year')}
              type="number"
              min={1980}
              max={2050}
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={t('e.g. 2025')}
            />
          </div>

          <Field label={t('Status')}>
            <div className="grid gap-gb-sm sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setCurrentlyEnrolled(true)}
                aria-pressed={currentlyEnrolled}
                className={`rounded-gb-md border px-gb-xl py-gb-lg text-gb-sm font-semibold shadow-gb-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  currentlyEnrolled
                    ? 'border-brand bg-brand-subtle text-fg-brand'
                    : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
                }`}
              >
                {t('Currently studying')}
              </button>
              <button
                type="button"
                onClick={() => setCurrentlyEnrolled(false)}
                aria-pressed={!currentlyEnrolled}
                className={`rounded-gb-md border px-gb-xl py-gb-lg text-gb-sm font-semibold shadow-gb-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  !currentlyEnrolled
                    ? 'border-brand bg-brand-subtle text-fg-brand'
                    : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
                }`}
              >
                {t('Alumni')}
              </button>
            </div>
          </Field>

          <Textarea
            name="advisor-bio"
            label={t('Bio')}
            hint={t('{count}/800 characters', { count: bio.length })}
            rows={6}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={800}
            placeholder={t('Share your story, what makes your perspective unique, and how you can help applicants.')}
            required
          />

          <Field
            label={t('Topics you can help with')}
            required
            hint={t('{count} selected · pick at least one', { count: topics.length })}
          >
            <ChipPicker
              options={SUGGESTED_TOPICS}
              selected={topics}
              onToggle={(v) => toggleFromList(v, topics, setTopics)}
            />
            <div className="flex gap-gb-sm">
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
                placeholder={t('Add another')}
                maxLength={60}
                className={controlClasses(false, 'min-w-0 flex-1')}
              />
              <Button
                onClick={() => addCustomTag(topicDraft, topics, setTopics, setTopicDraft)}
                variant="secondary"
                size="lg"
              >
                {t('Add')}
              </Button>
            </div>
          </Field>

          <Field
            label={t('Special skills / strengths')}
            required
            hint={t('What makes you stand out?')}
          >
            <ChipPicker
              options={SUGGESTED_STRENGTHS}
              selected={strengths}
              onToggle={(v) => toggleFromList(v, strengths, setStrengths)}
            />
            <div className="flex gap-gb-sm">
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
                placeholder={t('Add another')}
                maxLength={60}
                className={controlClasses(false, 'min-w-0 flex-1')}
              />
              <Button
                onClick={() => addCustomTag(strengthDraft, strengths, setStrengths, setStrengthDraft)}
                variant="secondary"
                size="lg"
              >
                {t('Add')}
              </Button>
            </div>
          </Field>

          <Field label={t('Languages you can advise in')} required>
            <ChipPicker
              options={SUGGESTED_LANGUAGES}
              selected={languages}
              onToggle={(v) => toggleFromList(v, languages, setLanguages)}
            />
            <div className="flex gap-gb-sm">
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
                placeholder={t('Add another language')}
                maxLength={40}
                className={controlClasses(false, 'min-w-0 flex-1')}
              />
              <Button
                onClick={() => addCustomTag(languageDraft, languages, setLanguages, setLanguageDraft)}
                variant="secondary"
                size="lg"
              >
                {t('Add')}
              </Button>
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
          title={t('Set your hourly rate')}
          description={t('You keep 90% of your hourly rate. GlowBal adds a 10% service fee on top, charged to the mentee.')}
        >
          <Field label={t('Currency')} required>
            <div className="grid gap-gb-md sm:grid-cols-3">
              {CURRENCIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCurrency(c.value)}
                  aria-pressed={currency === c.value}
                  className={`rounded-gb-md border px-gb-xl py-gb-lg text-gb-sm font-semibold shadow-gb-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    currency === c.value
                      ? 'border-brand bg-brand-subtle text-fg-brand'
                      : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
                  }`}
                >
                  {t(c.label)}
                </button>
              ))}
            </div>
          </Field>

          <FormField
            id="advisor-hourly-rate"
            label={t('Hourly rate')}
            hint={t('Enter the amount you want to receive for each one-hour session.')}
            required
          >
            <div className="relative max-w-sm">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-gb-lg flex items-center font-semibold text-fg-tertiary"
              >
                {currencySymbol(currency)}
              </span>
              <input
                id="advisor-hourly-rate"
                type="number"
                min={1}
                step={currency === 'VND' ? 1000 : 1}
                value={hourlyRateMajor}
                onChange={(e) => setHourlyRateMajor(e.target.value)}
                placeholder={t('Enter your rate')}
                className={controlClasses(false, 'pl-gb-5xl pr-gb-7xl text-gb-lg font-semibold')}
              />
              <span className="pointer-events-none absolute inset-y-0 right-gb-lg flex items-center text-gb-sm text-fg-muted">
                {t('/ hour')}
              </span>
            </div>
          </FormField>

          <div className="grid gap-gb-lg rounded-gb-xl border border-brand-surface bg-brand-subtle p-gb-xl sm:grid-cols-2">
            <div className="flex flex-col gap-gb-xxs">
              <span className="text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
                {t('You receive')}
              </span>
              <strong className="text-gb-xl font-semibold text-fg">
                {pricingComplete
                  ? formatMoney(toSmallestUnits(Number(hourlyRateMajor), currency), currency)
                  : '—'}
              </strong>
              <span className="text-gb-sm text-fg-tertiary">{t('Per one-hour session')}</span>
            </div>
            <div className="flex flex-col gap-gb-xxs sm:border-l sm:border-brand-surface sm:pl-gb-xl">
              <span className="text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
                {t('Student pays')}
              </span>
              <strong className="text-gb-xl font-semibold text-fg">
                {pricingComplete
                  ? formatMoney(
                      Math.round(toSmallestUnits(Number(hourlyRateMajor), currency) * 1.1),
                      currency,
                    )
                  : '—'}
              </strong>
              <span className="text-gb-sm text-fg-tertiary">{t('Includes the 10% service fee')}</span>
            </div>
          </div>

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
          title={t('Pick your free times')}
          description={t('Click any future date to add 1-hour slots. You can change these any time from your dashboard.')}
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
          title={t('Review & submit')}
          description={t('Double-check everything below. Your application goes to GlowBal admins for verification.')}
        >
          <ReviewPanel
            displayName={displayName}
            legalName={legalName}
            dob={dob}
            university={
              selectedUni?.name ??
              (customUniValid ? `${customUniName.trim()} ${t('(new — pending review)')}` : '—')
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

          <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-xl text-gb-sm text-fg-tertiary">
            {quickSignup
              ? t('By submitting, you confirm the details above are accurate and that you’ll respect mentee privacy.')
              : t('By submitting, you confirm that all documents are genuine and that you’ll respect mentee privacy.')}{' '}
            {t('GlowBal will email you within 48 hours with the outcome.')}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-gb-lg border-t border-line pt-gb-2xl">
            <Button type="button" onClick={() => setStep('availability')} variant="secondary" size="lg">
              {t('Back')}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!allValid || submitting}
              size="lg"
            >
              {t(submitting ? 'Submitting…' : 'Submit application')}
              <KitIcon art={ICONS.send} frame={18} />
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Sub-components (kept in same file to avoid dozens of new files) ──────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Panel as="section" className="flex flex-col gap-gb-3xl md:p-gb-4xl">
      <PanelHeader title={title} description={description} />
      <div className="flex flex-col gap-gb-3xl">{children}</div>
    </Panel>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-gb-sm">
      <legend className="text-gb-sm font-medium text-fg-secondary">
        {label}
        {required && <span className="text-fg-error"> *</span>}
      </legend>
      {children}
      {hint ? <p className="text-gb-sm text-fg-muted">{hint}</p> : null}
    </fieldset>
  );
}

function ChipPicker({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  const t = useT();

  return (
    <div className="flex flex-wrap gap-gb-sm">
      {Array.from(new Set([...options, ...selected])).map((v) => {
        const active = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            aria-pressed={active}
            className={`rounded-gb-md border px-gb-lg py-gb-md text-gb-sm font-medium shadow-gb-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              active
                ? 'border-brand bg-brand-subtle text-fg-brand'
                : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
            }`}
          >
            {t(v)}
          </button>
        );
      })}
    </div>
  );
}

function FooterNav({ onPrev, onNext, disabled }: { onPrev?: () => void; onNext: () => void; disabled: boolean }) {
  const t = useT();

  return (
    <div className="flex items-center justify-between gap-gb-lg border-t border-line pt-gb-2xl">
      {onPrev ? (
        <Button
          onClick={onPrev}
          variant="secondary"
          size="lg"
        >
          {t('Back')}
        </Button>
      ) : (
        <span />
      )}
      <Button
        onClick={onNext}
        disabled={disabled}
        size="lg"
      >
        {t('Continue')}
        <KitIcon art={ICONS.arrowRight} frame={20} />
      </Button>
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
  const t = useT();
  const meta = DOCUMENT_LABELS[slot];

  return (
    <Panel elevation="flat" padding="sm" className="flex flex-col gap-gb-xl">
      <PanelHeader title={t(meta.title)} description={t(meta.hint)} as="h3" />

      {fileName ? (
        <ul>
          <DocumentRow
            fileName={fileName}
            status="complete"
            onRemove={onClear}
            removeLabel={t('Remove {document}', { document: t(meta.title) })}
            completeLabel={t('Complete')}
            uploadingLabel={t('Uploading…')}
          />
        </ul>
      ) : null}

      <FileDropzone
        onFiles={(files) => {
          const file = files[0];
          if (file) onChange(file);
        }}
        accept={meta.accept}
        label={t(uploading ? 'Uploading…' : fileName ? 'Replace document' : 'Upload document')}
        secondaryLabel={t('or drag and drop')}
        hint={t('PDF, DOC, DOCX, PNG or JPG up to 10 MB')}
        disabled={uploading}
      />
    </Panel>
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
  const { lang, t } = useLanguage();
  const locale = lang === 'vi' ? 'vi-VN' : 'en-GB';
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
    <div className="flex flex-col gap-gb-xl">
      <div className="flex items-center justify-between rounded-gb-xl border border-line bg-surface p-gb-lg shadow-gb-xs">
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="flex size-gb-5xl items-center justify-center rounded-gb-md text-fg-tertiary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          aria-label={t('Previous month')}
        >
          <KitIcon art={ICONS.arrowLeft} frame={18} />
        </button>
        <p className="text-gb-md font-semibold capitalize text-fg">
          {viewMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="flex size-gb-5xl items-center justify-center rounded-gb-md text-fg-tertiary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          aria-label={t('Next month')}
        >
          <KitIcon art={ICONS.arrowRight} frame={18} />
        </button>
      </div>

      <p className="rounded-gb-lg bg-info-subtle px-gb-lg py-gb-md text-gb-sm text-fg-info">
        {t('Tap one or more days, then add the times you’re free below. Selected days turn pink; days with saved times show a count.')}
      </p>

      <div className="grid grid-cols-7 gap-gb-xs text-center text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{t(d)}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-gb-xs">
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
              className={`relative flex h-gb-5xl items-center justify-center rounded-gb-md border text-gb-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                isPast
                  ? 'cursor-not-allowed border-transparent text-fg-muted opacity-40'
                  : selected
                  ? 'border-brand bg-brand text-on-brand'
                  : count > 0
                  ? 'border-tier-safe bg-tier-safe/10 text-on-tier-safe'
                  : 'border-line bg-surface text-fg-secondary hover:border-brand hover:bg-brand-subtle'
              }`}
            >
              {cell.getDate()}
              {count > 0 && (
                <span className="absolute bottom-gb-xxs right-gb-xs text-[0.625rem]">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Apply times to whichever days are selected */}
      <Panel elevation="flat" padding="sm" className="flex flex-col gap-gb-lg">
        {selectedDates.length === 0 ? (
          <div className="flex items-center gap-gb-sm text-gb-sm text-fg-tertiary">
            <KitIcon art={ICONS.calendar} frame={18} className="shrink-0 text-brand" />
            <p>{t('Select one or more days above to add times.')}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-gb-md">
              <p className="text-gb-sm font-semibold text-fg">
                {t(selectedDates.length === 1
                  ? 'Add times to {count} selected day'
                  : 'Add times to {count} selected days', { count: selectedDates.length })}
              </p>
              <button
                type="button"
                onClick={() => setSelectedDates([])}
                className="rounded-gb-sm text-gb-sm font-semibold text-fg-tertiary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {t('Clear selection')}
              </button>
            </div>
            <div className="flex flex-wrap gap-gb-sm">
              {TIME_SLOTS.map((t) => {
                const active = allSelectedHave(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => applyTimeToSelected(t)}
                    aria-pressed={active}
                    className={`rounded-gb-md border px-gb-lg py-gb-md text-gb-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      active
                        ? 'border-tier-safe bg-tier-safe/10 text-on-tier-safe'
                        : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-gb-sm">
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                aria-label={t('Custom time')}
                className={controlClasses(false, 'max-w-[160px]')}
              />
              <Button type="button" onClick={() => applyTimeToSelected(customTime)} variant="secondary" size="lg">
                <KitIcon art={ICONS.plus} frame={16} />
                {t('Add custom time')}
              </Button>
            </div>
          </>
        )}
      </Panel>

      {/* Summary of everything chosen, grouped by day */}
      {grouped.length > 0 && (
        <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-xl">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
            {t('Your availability')} —{' '}
            {t(slots.length === 1 ? '{count} slot' : '{count} slots', { count: slots.length })}{' '}
            {t('across')}{' '}
            {t(grouped.length === 1 ? '{count} day' : '{count} days', { count: grouped.length })}
          </p>
          <div className="mt-gb-lg flex flex-col gap-gb-md">
            {grouped.map(({ key, isos }) => (
              <div key={key} className="rounded-gb-lg border border-line bg-surface p-gb-lg">
                <p className="text-gb-sm font-semibold text-fg">
                  {new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}
                </p>
                <div className="mt-gb-sm flex flex-wrap gap-gb-sm">
                  {isos.map((iso) => (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => removeSlot(iso)}
                      className="inline-flex items-center gap-gb-xs rounded-gb-md border border-tier-safe bg-tier-safe/10 px-gb-md py-gb-sm text-gb-xs font-semibold text-on-tier-safe transition-colors hover:border-line-error hover:bg-surface-error hover:text-fg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      title={t('Remove this time')}
                    >
                      {new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      <CloseIcon size={11} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-gb-sm text-fg-muted">
        {t('You can change all of this any time from your advisor dashboard.')}
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
  const t = useT();
  const total = toSmallestUnits(props.hourlyMajor, props.currency);
  const degreeLabel = DEGREE_LEVELS.find((level) => level.value === props.degreeLevel)?.label ?? props.degreeLevel;
  return (
    <dl className="grid gap-px overflow-hidden rounded-gb-xl border border-line bg-line sm:grid-cols-2">
      <Row label={t('Display name')} value={props.displayName} />
      <Row label={t('Legal name')} value={props.legalName} muted />
      <Row label={t('Date of birth')} value={props.dob} muted />
      <Row label={t('University')} value={props.university} />
      <Row label={t('Programme')} value={`${t(degreeLabel)} · ${props.subject}`} />
      <Row
        label={t('Documents')}
        value={props.quickSignup
          ? t('Fast-track — not required')
          : t('{count} / 4 uploaded', { count: props.documentsCount })}
      />
      <Row label={t('Topics')} value={props.topics.map((topic) => t(topic)).join(', ') || '—'} />
      <Row label={t('Strengths')} value={props.strengths.map((strength) => t(strength)).join(', ') || '—'} />
      <Row label={t('Languages')} value={props.languages.map((language) => t(language)).join(', ') || '—'} />
      <Row label={t('Hourly rate')} value={formatMoney(total, props.currency)} />
      <Row label={t('Initial slots')} value={t('{count} added', { count: props.slotCount })} />
    </dl>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-gb-xs bg-surface p-gb-xl">
      <dt className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</dt>
      <dd className={`break-words text-gb-sm ${muted ? 'text-fg-tertiary' : 'font-medium text-fg'}`}>
        {value}
      </dd>
    </div>
  );
}
