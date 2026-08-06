'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from 'react';
import { useT } from '@/lib/i18n';
import type {
  CvReviewAnalysis,
  CvReviewSectionEvent,
  CvReviewStreamEvent,
} from '@/lib/ai/cv-review';
import {
  applyCvClarificationAnswers,
  CV_BUILDER_SCHEMA_VERSION,
  CvBuilderFormSchema,
  assembleGeneratedCv,
  cvBuilderFormErrorMessage,
  cvBuilderExpectedSections,
  cvBuilderDraftKey,
  generatedCvEvents,
  renderGeneratedCvText,
  restoreCvBuilderDraft,
  type CvBuilderFormV1,
  type CvBuilderModelEvent,
  type CvBuilderStreamEvent,
  type CvDisplaySectionKey,
  type CvSectionTitleKey,
  type CvTargetProfileV1,
  type CvTemplateId,
  type GeneratedCvV1,
} from '@/lib/ai/cv-builder';
import { CvReviewFeedback } from './CvReviewFeedback';

type AnyStreamEvent =
  | CvBuilderStreamEvent
  | CvReviewStreamEvent
  | {
      type: 'status';
      stage: string;
      message: string;
    }
  | {
      type: 'complete';
      targetProfile: CvTargetProfileV1;
      timing: { totalMs: number };
    };

const steps = ['Target Profile', 'Content', 'CV Draft', 'Layout & PDF'];
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-50';
const cvSectionOrder: CvDisplaySectionKey[] = [
  'profile',
  'ability',
  'aspiration',
  'creativity',
  'commitment',
  'education',
  'experience',
  'projects',
  'activities',
  'awards',
  'skills',
];

async function readNdjson(response: Response, onEvent: (event: AnyStreamEvent) => void) {
  if (!response.body) throw new Error('The AI did not return a stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
    if (done) break;
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer));
}

function TypingText({ text }: { text: string }) {
  const [length, setLength] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setLength((current) => Math.min(text.length, current + 4)),
      28,
    );
    return () => clearInterval(timer);
  }, [text]);
  return (
    <>
      <span className="motion-reduce:hidden">{text.slice(0, length)}</span>
      <span className="hidden motion-reduce:inline">{text}</span>
    </>
  );
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input
        className={`${inputClass} mt-1.5`}
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SectionTitle({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="text-xs font-bold tracking-[0.2em] text-rose-600">{number}</span>
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">{children}</h2>
    </div>
  );
}

function WorkflowProgress({
  step,
  cvReady,
  onChange,
}: {
  step: number;
  cvReady: boolean;
  onChange: (step: number) => void;
}) {
  const t = useT();
  return (
    <nav aria-label={t('CV creation progress')} className="mx-auto w-full max-w-4xl print:hidden">
      <ol className="grid grid-cols-4">
        {steps.map((label, index) => (
          <li key={label} className="relative">
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={[
                  'absolute left-1/2 top-4 h-0.5 w-full',
                  index < step ? 'bg-rose-500' : 'bg-slate-200',
                ].join(' ')}
              />
            )}
            <button
              type="button"
              aria-current={index === step ? 'step' : undefined}
              disabled={index > 1 && !cvReady}
              className="relative z-10 flex w-full flex-col items-center gap-2 text-center disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onChange(index)}
            >
              <span
                className={[
                  'grid h-8 w-8 place-items-center rounded-full border text-xs font-bold transition',
                  index <= step
                    ? 'border-rose-600 bg-rose-600 text-white'
                    : 'border-slate-300 bg-white text-slate-500',
                ].join(' ')}
              >
                {index < step ? '✓' : index + 1}
              </span>
              <span
                className={[
                  'hidden text-xs font-semibold sm:block',
                  index === step ? 'text-rose-700' : 'text-slate-500',
                ].join(' ')}
              >
                {t(label)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function TargetProfile({
  profile,
  status,
}: {
  profile: CvTargetProfileV1 | null;
  status: string;
}) {
  const t = useT();
  if (!profile) {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-rose-200 bg-rose-50/30 p-8 text-center">
        <div>
          <div
            className={`mx-auto h-3 w-3 rounded-full ${
              status ? 'animate-pulse bg-rose-500' : 'bg-slate-300'
            }`}
          />
          <p className="mt-4 text-sm font-semibold text-slate-700">
            {status
              ? t(status)
              : t('No Target Profile yet. Enter a career direction and start generating.')}
          </p>
        </div>
      </div>
    );
  }
  const insights = [
    ['University positioning', profile.universityDna.positioning],
    ['Educational philosophy', profile.universityDna.educationalPhilosophy],
    ['Environment', profile.universityDna.environment],
    ['Programme objectives', profile.programmeDna.objectives[0]],
    ['Priority competencies', profile.programmeDna.competencies[0]],
    ['Career alignment', profile.careerAlignment[0]],
  ] as const;
  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2">
        {profile.keywords.map((keyword) => (
          <span
            key={keyword}
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-rose-700"
          >
            {keyword}
          </span>
        ))}
      </div>
      <h2 className="mt-8 text-sm font-semibold text-slate-950">{t('Information used to position the CV')}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {insights.map(([label, insight]) => (
          <article key={label} className="min-h-44 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t(label)}</h3>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                  insight?.status === 'unavailable'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {insight?.status ?? 'unavailable'}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {insight?.text ?? t('Not enough data')}
            </p>
          </article>
        ))}
      </div>
      {profile.limitations.length > 0 && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          {t('Missing data: {items}', { items: profile.limitations.join(' · ') })}
        </p>
      )}
      <section className="mt-6 rounded-xl border border-rose-200 bg-rose-50/40 p-5">
        <h2 className="text-lg font-semibold text-slate-950">{t('What the CV needs to prove')}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {t('This is the target for the CV, not a score of the current profile.')}
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {profile.evidenceSignals.map((signal, index) => (
            <li key={signal.id} className="rounded-xl border border-rose-100 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-rose-600 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">{signal.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{signal.description}</p>
                  <p className="mt-2 text-[11px] leading-4 text-rose-700">
                    {t('Suggested evidence: {items}', { items: signal.evidenceExamples.join(' · ') })}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function FormEditor({
  form,
  setForm,
}: {
  form: CvBuilderFormV1;
  setForm: Dispatch<SetStateAction<CvBuilderFormV1>>;
}) {
  const t = useT();
  const personal = (key: keyof CvBuilderFormV1['personal'], value: string) =>
    setForm((current) => ({
      ...current,
      personal: {
        ...current.personal,
        [key]: key === 'links' ? value.split(',').map((item) => item.trim()).filter(Boolean) : value,
      },
    }));
  const updateEducation = (
    index: number,
    key: keyof CvBuilderFormV1['education'][number],
    value: string,
  ) =>
    setForm((current) => ({
      ...current,
      education: current.education.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  const updateEntry = (
    index: number,
    key: keyof CvBuilderFormV1['entries'][number],
    value: string,
  ) =>
    setForm((current) => ({
      ...current,
      entries: current.entries.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
        <SectionTitle number="01">{t('Personal information')}</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Full name')} value={form.personal.fullName} onChange={(v) => personal('fullName', v)} />
          <Field label="Email" type="email" value={form.personal.email} onChange={(v) => personal('email', v)} />
          <Field label={t('Phone')} value={form.personal.phone} onChange={(v) => personal('phone', v)} />
          <Field label={t('Location')} value={form.personal.location} onChange={(v) => personal('location', v)} />
          <div className="sm:col-span-2">
            <Field
              label={t('Links — comma separated')}
              value={form.personal.links.join(', ')}
              onChange={(v) => personal('links', v)}
              placeholder="LinkedIn, portfolio, GitHub"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
        <SectionTitle number="02">Education</SectionTitle>
        <div className="space-y-3">
          {form.education.map((item, index) => (
            <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
              <Field label={t('Institution')} value={item.institution} onChange={(v) => updateEducation(index, 'institution', v)} />
              <Field label={t('Qualification')} value={item.qualification} onChange={(v) => updateEducation(index, 'qualification', v)} />
              <Field label={t('Field of study')} value={item.fieldOfStudy} onChange={(v) => updateEducation(index, 'fieldOfStudy', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('Start')} type="month" value={item.startDate} onChange={(v) => updateEducation(index, 'startDate', v)} />
                <Field label={t('End')} type="month" value={item.endDate} onChange={(v) => updateEducation(index, 'endDate', v)} />
              </div>
              <button
                className="text-left text-xs font-semibold text-red-600"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    education: current.education.filter(({ id }) => id !== item.id),
                  }))
                }
              >
                {t('Remove this entry')}
              </button>
            </div>
          ))}
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold transition hover:border-rose-300"
            onClick={() =>
              setForm((current) => ({
                ...current,
                education: [
                  ...current.education,
                  {
                    id: uid('education'),
                    institution: '',
                    qualification: '',
                    details: [],
                  },
                ],
              }))
            }
          >
            {t('+ Add education')}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
        <SectionTitle number="03">Experience Collection</SectionTitle>
        <p className="-mt-2 mb-5 text-sm text-slate-500">
          {t('Each entry allows up to 5 contributions. Describe real actions and results.')}
        </p>
        <div className="space-y-4">
          {form.entries.map((entry, index) => (
            <div key={entry.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-slate-600">
                  {t('Type')}
                  <select
                    className={`${inputClass} mt-1.5`}
                    value={entry.category}
                    onChange={(event) => updateEntry(index, 'category', event.target.value)}
                  >
                    <option value="experience">Experience</option>
                    <option value="project">Project</option>
                    <option value="activity">Activity</option>
                    <option value="research">Research</option>
                    <option value="volunteering">Volunteering</option>
                  </select>
                </label>
                <Field label={t('Role / title')} value={entry.title} onChange={(v) => updateEntry(index, 'title', v)} />
                <Field label={t('Organization')} value={entry.organization} onChange={(v) => updateEntry(index, 'organization', v)} />
              </div>
              <div className="mt-4 space-y-3">
                {entry.contributions.map((contribution, contributionIndex) => (
                  <div key={contribution.id} className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                    <select
                      aria-label="Contribution framework"
                      className={inputClass}
                      value={contribution.framework}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          entries: current.entries.map((candidate) =>
                            candidate.id === entry.id
                              ? {
                                  ...candidate,
                                  contributions: candidate.contributions.map((item) =>
                                    item.id === contribution.id
                                      ? { ...item, framework: event.target.value as typeof item.framework }
                                      : item,
                                  ),
                                }
                              : candidate,
                          ),
                        }))
                      }
                    >
                      <option value="built">Built</option>
                      <option value="led">Led</option>
                      <option value="improved">Improved</option>
                      <option value="partnered">Partnered</option>
                    </select>
                    <textarea
                      aria-label={`Contribution ${contributionIndex + 1}`}
                      className={`${inputClass} min-h-20 resize-y`}
                      value={contribution.text}
                      placeholder="Built [what] for [who], resulting in [impact]."
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          entries: current.entries.map((candidate) =>
                            candidate.id === entry.id
                              ? {
                                  ...candidate,
                                  contributions: candidate.contributions.map((item) =>
                                    item.id === contribution.id
                                      ? { ...item, text: event.target.value }
                                      : item,
                                  ),
                                }
                              : candidate,
                          ),
                        }))
                      }
                    />
                    <button
                      aria-label={t('Remove contribution')}
                      className="px-2 text-red-500"
                      disabled={entry.contributions.length === 1}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          entries: current.entries.map((candidate) =>
                            candidate.id === entry.id
                              ? {
                                  ...candidate,
                                  contributions: candidate.contributions.filter(
                                    ({ id }) => id !== contribution.id,
                                  ),
                                }
                              : candidate,
                          ),
                        }))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-2">
                <button
                  className="text-xs font-semibold text-rose-600 disabled:text-slate-300"
                  disabled={entry.contributions.length >= 5}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      entries: current.entries.map((candidate) =>
                        candidate.id === entry.id
                          ? {
                              ...candidate,
                              contributions: [
                                ...candidate.contributions,
                                { id: uid('K'), framework: 'built', text: '' },
                              ],
                            }
                          : candidate,
                      ),
                    }))
                  }
                >
                  + Contribution ({entry.contributions.length}/5)
                </button>
                <button
                  className="text-xs font-semibold text-red-600"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      entries: current.entries.filter(({ id }) => id !== entry.id),
                    }))
                  }
                >
                  {t('Remove entry')}
                </button>
              </div>
            </div>
          ))}
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold transition hover:border-rose-300"
            onClick={() =>
              setForm((current) => ({
                ...current,
                entries: [
                  ...current.entries,
                  {
                    id: uid('entry'),
                    category: 'experience',
                    title: '',
                    contributions: [{ id: uid('K'), framework: 'built', text: '' }],
                  },
                ],
              }))
            }
          >
            {t('+ Add entry')}
          </button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <SectionTitle number="04">Awards</SectionTitle>
          {form.awards.map((award, index) => (
            <div key={award.id} className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
              <Field
                label={t('Award')}
                value={award.title}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    awards: current.awards.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, title: value } : item,
                    ),
                  }))
                }
              />
              <button
                className="mt-3 text-xs font-semibold text-red-600"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    awards: current.awards.filter(({ id }) => id !== award.id),
                  }))
                }
              >
                {t('Remove')}
              </button>
            </div>
          ))}
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold transition hover:border-rose-300"
            onClick={() =>
              setForm((current) => ({
                ...current,
                awards: [...current.awards, { id: uid('award'), title: '' }],
              }))
            }
          >
            {t('+ Add award')}
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <SectionTitle number="05">Skills</SectionTitle>
          {form.skillGroups.map((group, index) => (
            <div key={group.id} className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  aria-label={t('Remove skill group {index}', { index: index + 1 })}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      skillGroups: current.skillGroups.filter(
                        (item) => item.id !== group.id,
                      ),
                    }))
                  }
                >
                  {t('Remove group')}
                </button>
              </div>
              <Field
                label={t('Group')}
                value={group.label}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    skillGroups: current.skillGroups.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, label: value } : item,
                    ),
                  }))
                }
              />
              <div className="mt-3">
                <Field
                  label={t('Skills — comma separated')}
                  value={group.skills.join(', ')}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      skillGroups: current.skillGroups.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              skills: value.split(',').map((skill) => skill.trim()).filter(Boolean),
                            }
                          : item,
                      ),
                    }))
                  }
                />
              </div>
            </div>
          ))}
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold transition hover:border-rose-300"
            onClick={() =>
              setForm((current) => ({
                ...current,
                skillGroups: [
                  ...current.skillGroups,
                  { id: uid('skills'), label: 'Core skills', skills: [''] },
                ],
              }))
            }
          >
            {t('+ Add skill group')}
          </button>
        </div>
      </section>
    </div>
  );
}

function CvPaper({
  form,
  cv,
  template,
  typing = false,
  onFormChange,
  onCvChange,
}: {
  form: CvBuilderFormV1;
  cv: GeneratedCvV1;
  template: CvTemplateId;
  typing?: boolean;
  onFormChange?: (form: CvBuilderFormV1) => void;
  onCvChange?: (cv: GeneratedCvV1) => void;
}) {
  const t = useT();
  const editable = Boolean(onFormChange || onCvChange);
  const draggedSection = useRef<CvDisplaySectionKey | null>(null);
  const [draggingSection, setDraggingSection] = useState<CvDisplaySectionKey | null>(null);
  const [dropTarget, setDropTarget] = useState<CvDisplaySectionKey | null>(null);
  const hiddenSections = cv.hiddenSections ?? [];
  const availableSections = cvSectionOrder.filter((section) => {
    if (hiddenSections.includes(section)) return false;
    if (['ability', 'aspiration', 'creativity', 'commitment'].includes(section))
      return template === 'technical';
    if (section === 'education') return cv.education.length > 0;
    if (section === 'experience') return cv.experience.length > 0;
    if (section === 'projects') return cv.projects.length > 0;
    if (section === 'activities') return cv.activities.length > 0;
    if (section === 'awards') return cv.awards.length > 0;
    if (section === 'skills') return cv.skillGroups.length > 0;
    return true;
  });
  const visibleSectionOrder = [
    ...new Set([...(cv.sectionOrder ?? []), ...availableSections]),
  ].filter((section) => availableSections.includes(section));
  const moveSection = (section: CvDisplaySectionKey, targetIndex: number) => {
    const next = [...visibleSectionOrder];
    const sourceIndex = next.indexOf(section);
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= next.length) return;
    next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, section);
    onCvChange?.({ ...cv, sectionOrder: next });
  };
  const sectionProps = (section: CvDisplaySectionKey, label: string) => ({
    'aria-label': t('Section {label}', { label }),
    className: onCvChange
      ? [
          'cv-section-editable',
          draggingSection === section && 'cv-section-dragging',
          dropTarget === section && 'cv-section-drop-target',
        ]
          .filter(Boolean)
          .join(' ')
      : undefined,
    hidden: !availableSections.includes(section),
    style: {
      order: visibleSectionOrder.indexOf(section),
      backgroundColor:
        dropTarget === section
          ? '#ffe4e6'
          : draggingSection === section
            ? '#fff1f2'
            : undefined,
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (draggedSection.current && draggedSection.current !== section)
        setDropTarget(section);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      const dragged = draggedSection.current;
      if (dragged && dragged !== section)
        moveSection(dragged, visibleSectionOrder.indexOf(section));
      draggedSection.current = null;
      setDraggingSection(null);
      setDropTarget(null);
    },
  });
  const sectionToolbar = (section: CvDisplaySectionKey, label: string) => {
    if (!onCvChange) return null;
    const index = visibleSectionOrder.indexOf(section);
    return (
      <div
        className="cv-section-toolbar print:hidden"
        role="toolbar"
        aria-label={t('Reorder {label}', { label })}
      >
        <button
          type="button"
          aria-label={t('Drag {label}', { label })}
          className="cv-section-drag"
          draggable
          title={t('Drag to reorder')}
          onDragStart={() => {
            draggedSection.current = section;
            setDraggingSection(section);
          }}
          onDragEnd={() => {
            draggedSection.current = null;
            setDraggingSection(null);
            setDropTarget(null);
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 2v20M2 12h20M12 2 9 5m3-3 3 3m-3 17-3-3m3 3 3-3M2 12l3-3m-3 3 3 3m17-3-3-3m3 3-3 3" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={t('Move {label} up', { label })}
          disabled={index <= 0}
          title={t('Move up')}
          onClick={() => moveSection(section, index - 1)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 20V4m0 0-6 6m6-6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={t('Move {label} down', { label })}
          disabled={index === visibleSectionOrder.length - 1}
          title={t('Move down')}
          onClick={() => moveSection(section, index + 1)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 4v16m0 0-6-6m6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          className="cv-section-delete"
          aria-label={t('Remove {label}', { label })}
          title={t('Remove section')}
          onClick={() => {
            if (!window.confirm(t('Remove the {label} section from the CV?', { label }))) return;
            onCvChange({
              ...cv,
              sectionOrder: visibleSectionOrder.filter((item) => item !== section),
              hiddenSections: [...new Set([...hiddenSections, section])],
            });
          }}
        >
          {t('Remove')}
        </button>
      </div>
    );
  };
  const inlineEditor = (
    text: string,
    label: string,
    commit: (value: string) => void,
    inline = false,
  ) => (
    <span
      aria-label={label}
      className={`cv-inline-editor ${inline ? 'cv-inline-editor--inline' : ''}`}
      contentEditable
      role="textbox"
      suppressContentEditableWarning
      tabIndex={0}
      title={t('Click to edit')}
      onKeyDown={(event) => {
        if (inline && event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onBlur={(event) => {
        const value = event.currentTarget.textContent?.trim() ?? '';
        if (value) commit(value);
        else event.currentTarget.textContent = text;
      }}
    >
      {text}
    </span>
  );
  const sectionTitle = (key: CvSectionTitleKey, fallback: string) =>
    cv.sectionTitles?.[key] ?? fallback;
  const editSectionTitle = (
    key: CvSectionTitleKey,
    fallback: string,
    label: string,
  ) =>
    editable
      ? inlineEditor(sectionTitle(key, fallback), label, (value) =>
          onCvChange?.({
            ...cv,
            sectionTitles: { ...cv.sectionTitles, [key]: value },
          }),
        true)
      : sectionTitle(key, fallback);
  const entrySection = (
    section: 'experience' | 'projects' | 'activities',
    title: string,
    items: GeneratedCvV1['experience'],
  ) => {
    const itemLabel =
      section === 'experience'
        ? t('experience')
        : section === 'projects'
          ? t('project')
          : t('activity');
    return items.length ? (
      <section {...sectionProps(section, title)}>
        {sectionToolbar(section, title)}
        <h2>{editSectionTitle(section, title, t('Edit {title} heading', { title }))}</h2>
        {items.map((item, itemIndex) => (
          <article key={item.sourceId}>
            <div className="cv-harvard-entry-row cv-harvard-entry-row--primary">
              <h3>
                {item.organization
                  ? editable
                    ? inlineEditor(
                        item.organization,
                        t('Edit {itemLabel} {index} organization', { itemLabel, index: itemIndex + 1 }),
                        (value) =>
                          onCvChange?.({
                            ...cv,
                            [section]: cv[section].map((entry, index) =>
                              index === itemIndex
                                ? { ...entry, organization: value }
                                : entry,
                            ),
                          }),
                        true,
                      )
                    : item.organization
                  : editable
                    ? inlineEditor(
                        item.title,
                        t('Edit {itemLabel} {index} title', { itemLabel, index: itemIndex + 1 }),
                        (value) =>
                          onCvChange?.({
                            ...cv,
                            [section]: cv[section].map((entry, index) =>
                              index === itemIndex ? { ...entry, title: value } : entry,
                            ),
                          }),
                        true,
                      )
                    : item.title}
              </h3>
            </div>
            <div className="cv-harvard-entry-row cv-harvard-entry-row--secondary">
              {item.organization ? (
                <em>
                  {editable
                    ? inlineEditor(
                        item.title,
                        t('Edit {itemLabel} {index} title', { itemLabel, index: itemIndex + 1 }),
                        (value) =>
                          onCvChange?.({
                            ...cv,
                            [section]: cv[section].map((entry, index) =>
                              index === itemIndex ? { ...entry, title: value } : entry,
                            ),
                          }),
                        true,
                      )
                    : item.title}
                </em>
              ) : (
                <span />
              )}
              {item.dates && (
              <time>
                {editable
                  ? inlineEditor(
                      item.dates,
                      t('Edit {itemLabel} {index} dates', { itemLabel, index: itemIndex + 1 }),
                      (value) =>
                        onCvChange?.({
                          ...cv,
                          [section]: cv[section].map((entry, index) =>
                            index === itemIndex ? { ...entry, dates: value } : entry,
                          ),
                        }),
                      true,
                    )
                  : item.dates}
              </time>
              )}
            </div>
            <ul>
              {item.bullets.map((bullet, index) => (
                <li key={`${item.sourceId}-${index}`}>
                  {editable ? (
                    inlineEditor(
                      bullet.text,
                      t('Edit {title} — bullet {index}', { title: item.title, index: index + 1 }),
                      (value) =>
                        onCvChange?.({
                          ...cv,
                          [section]: cv[section].map((entry, entryIndex) =>
                            entryIndex === itemIndex
                              ? {
                                  ...entry,
                                  bullets: entry.bullets.map((current, bulletIndex) =>
                                    bulletIndex === index
                                      ? { ...current, text: value }
                                      : current,
                                  ),
                                }
                              : entry,
                          ),
                        }),
                    )
                  ) : typing ? (
                    <TypingText text={bullet.text} />
                  ) : (
                    bullet.text
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    ) : null;
  };

  return (
    <article
      id="cv-print-area"
      aria-label={template === 'academic' ? 'CV Harvard' : 'CV AACC'}
      className={`cv-paper cv-harvard${template === 'technical' ? ' cv-aacc' : ''}`}
    >
      <header className="cv-harvard-header">
        <h1>
          {editable
            ? inlineEditor(
                form.personal.fullName,
                t('Edit full name'),
                (value) =>
                  onFormChange?.({
                    ...form,
                    personal: { ...form.personal, fullName: value },
                  }),
                true,
              )
            : form.personal.fullName}
        </h1>
        <p className="cv-harvard-contact">
          {(
            [
              ['email', form.personal.email, t('Edit email')],
              ['phone', form.personal.phone, t('Edit phone number')],
              ['location', form.personal.location, t('Edit location')],
              ...form.personal.links.map((link, index) => [
                `link:${index}`,
                link,
                t('Edit link {index}', { index: index + 1 }),
              ]),
            ] as const
          )
            .filter(([, value]) => value)
            .map(([key, value, label], index) => (
              <span key={key}>
                {index ? ' | ' : ''}
                {editable
                  ? inlineEditor(
                      value ?? '',
                      label,
                      (next) =>
                        onFormChange?.({
                          ...form,
                          personal: key.startsWith('link:')
                            ? {
                                ...form.personal,
                                links: form.personal.links.map((link, linkIndex) =>
                                  linkIndex === Number(key.split(':')[1])
                                    ? next
                                    : link,
                                ),
                              }
                            : { ...form.personal, [key]: next },
                        }),
                      true,
                    )
                  : value}
              </span>
            ))}
        </p>
      </header>
      <section {...sectionProps('profile', 'Profile')}>
        {sectionToolbar('profile', 'Profile')}
        <h2>{editSectionTitle('profile', 'Profile', t('Edit Profile heading'))}</h2>
        {editable ? (
          <p>
            {inlineEditor(cv.aboutMe, t('Edit the introduction'), (value) =>
              onCvChange?.({ ...cv, aboutMe: value }),
            )}
          </p>
        ) : (
          <p>{typing ? <TypingText text={cv.aboutMe} /> : cv.aboutMe}</p>
        )}
      </section>
      {template === 'technical' &&
        (
          [
            ['ability', 'Ability'],
            ['aspiration', 'Aspiration'],
            ['creativity', 'Creativity'],
            ['commitment', 'Commitment'],
          ] as const
        ).map(([section, title]) => (
          <section key={section} {...sectionProps(section, title)}>
            {sectionToolbar(section, title)}
            <h2>{title}</h2>
          </section>
        ))}
      {cv.education.length > 0 && (
        <section {...sectionProps('education', 'Education')}>
          {sectionToolbar('education', 'Education')}
          <h2>
            {editSectionTitle('education', 'Education', t('Edit Education heading'))}
          </h2>
          {cv.education.map((item, itemIndex) => (
            <article key={item.sourceId}>
              <div className="cv-harvard-entry-row cv-harvard-entry-row--primary">
                <h3>
                {editable
                  ? inlineEditor(
                      item.institution,
                      t('Edit school {index}', { index: itemIndex + 1 }),
                      (value) =>
                        onCvChange?.({
                          ...cv,
                          education: cv.education.map((entry, index) =>
                            index === itemIndex
                              ? { ...entry, institution: value }
                              : entry,
                          ),
                        }),
                      true,
                    )
                  : item.institution}
                </h3>
              </div>
              <div className="cv-harvard-entry-row cv-harvard-entry-row--secondary">
                <em>
                  {editable
                    ? inlineEditor(
                        item.qualification,
                        t('Edit qualification {index}', { index: itemIndex + 1 }),
                        (value) =>
                          onCvChange?.({
                            ...cv,
                            education: cv.education.map((entry, index) =>
                              index === itemIndex
                                ? { ...entry, qualification: value }
                                : entry,
                            ),
                          }),
                        true,
                      )
                    : item.qualification}
                </em>
                {item.dates && (
                  <time>
                    {editable
                      ? inlineEditor(
                          item.dates,
                          t('Edit study dates {index}', { index: itemIndex + 1 }),
                          (value) =>
                            onCvChange?.({
                              ...cv,
                              education: cv.education.map((entry, index) =>
                                index === itemIndex
                                  ? { ...entry, dates: value }
                                  : entry,
                              ),
                            }),
                          true,
                        )
                      : item.dates}
                  </time>
                )}
              </div>
              {item.fieldOfStudy && (
                <p>
                  {editable
                    ? inlineEditor(
                        item.fieldOfStudy,
                        t('Edit field of study {index}', { index: itemIndex + 1 }),
                        (value) =>
                          onCvChange?.({
                            ...cv,
                            education: cv.education.map((entry, index) =>
                              index === itemIndex
                                ? { ...entry, fieldOfStudy: value }
                                : entry,
                            ),
                          }),
                      )
                    : item.fieldOfStudy}
                </p>
              )}
              {item.details.length > 0 && (
                <ul>
                  {item.details.map((detail, detailIndex) => (
                    <li key={`${item.sourceId}-${detailIndex}`}>
                      {editable
                        ? inlineEditor(
                            detail,
                            t('Edit education detail {index}', { index: `${itemIndex + 1}.${detailIndex + 1}` }),
                            (value) =>
                              onCvChange?.({
                                ...cv,
                                education: cv.education.map((entry, index) =>
                                  index === itemIndex
                                    ? {
                                        ...entry,
                                        details: entry.details.map((current, index) =>
                                          index === detailIndex ? value : current,
                                        ),
                                      }
                                    : entry,
                                ),
                              }),
                          )
                        : detail}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>
      )}
      {entrySection('experience', 'Work Experience', cv.experience)}
      {entrySection('projects', 'University Projects', cv.projects)}
      {entrySection('activities', 'Activities', cv.activities)}
      {cv.awards.length > 0 && (
        <section {...sectionProps('awards', 'Awards')}>
          {sectionToolbar('awards', 'Awards')}
          <h2>{editSectionTitle('awards', 'Awards', t('Edit Awards heading'))}</h2>
          {cv.awards.map((award, index) => (
            <p key={award.sourceId}>
              <strong>
                {editable
                  ? inlineEditor(
                      award.title,
                      t('Edit award {index}', { index: index + 1 }),
                      (value) =>
                        onCvChange?.({
                          ...cv,
                          awards: cv.awards.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, title: value } : item,
                          ),
                        }),
                      true,
                    )
                  : award.title}
              </strong>
              {award.issuer ? (
                <>
                  {' · '}
                  {editable
                    ? inlineEditor(
                        award.issuer,
                        t('Edit award issuer {index}', { index: index + 1 }),
                        (value) =>
                          onCvChange?.({
                            ...cv,
                            awards: cv.awards.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, issuer: value } : item,
                            ),
                          }),
                        true,
                      )
                    : award.issuer}
                </>
              ) : null}
            </p>
          ))}
        </section>
      )}
      {cv.skillGroups.length > 0 && (
        <section {...sectionProps('skills', 'Skills')}>
          {sectionToolbar('skills', 'Skills')}
          <h2>{editSectionTitle('skills', 'Skills', t('Edit Skills heading'))}</h2>
          {cv.skillGroups.map((group, index) => (
            <p key={group.sourceId}>
              <strong>
                {editable
                  ? inlineEditor(
                      group.label,
                      t('Edit skill group name {index}', { index: index + 1 }),
                      (value) =>
                        onCvChange?.({
                          ...cv,
                          skillGroups: cv.skillGroups.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, label: value } : item,
                          ),
                        }),
                      true,
                    )
                  : group.label}
                :
              </strong>{' '}
              {editable
                ? inlineEditor(
                    group.skills.join(', '),
                    t('Edit skills in group {index}', { index: index + 1 }),
                    (value) =>
                      onCvChange?.({
                        ...cv,
                        skillGroups: cv.skillGroups.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                skills: value
                                  .split(',')
                                  .map((skill) => skill.trim())
                                  .filter(Boolean),
                              }
                            : item,
                        ),
                      }),
                    true,
                  )
                : group.skills.join(', ')}
            </p>
          ))}
        </section>
      )}
    </article>
  );
}

export function CvBuilderWorkspace({
  applicationId,
  userId,
  universityName,
  programmeName,
  prefill,
}: {
  applicationId: string;
  userId: string;
  universityName: string;
  programmeName: string;
  prefill: CvBuilderFormV1;
}) {
  const t = useT();
  const storageKey = cvBuilderDraftKey(userId, applicationId);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(prefill);
  const [careerDirection, setCareerDirection] = useState('');
  const [targetProfile, setTargetProfile] = useState<CvTargetProfileV1 | null>(null);
  const [generatedCv, setGeneratedCv] = useState<GeneratedCvV1 | null>(null);
  const [partial, setPartial] = useState<CvBuilderModelEvent[]>([]);
  const [template, setTemplate] = useState<CvTemplateId>('academic');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [missingSections, setMissingSections] = useState<CvBuilderModelEvent['section'][]>([]);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [reviewEvents, setReviewEvents] = useState<CvReviewSectionEvent[]>([]);
  const [review, setReview] = useState<CvReviewAnalysis | null>(null);
  const [clarificationAnswers, setClarificationAnswers] = useState<
    Record<string, string>
  >({});
  const controllers = useRef<AbortController[]>([]);
  const retryClarification = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const [tooLong, setTooLong] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    let value: unknown = null;
    try {
      value = saved ? JSON.parse(saved) : null;
    } catch {}
    const restored = restoreCvBuilderDraft(value, applicationId);
    if (restored) {
      setForm(restored.form);
      setTargetProfile(restored.targetProfile ?? null);
      setGeneratedCv(restored.generatedCv ?? null);
      setTemplate(restored.selectedTemplate === 'technical' ? 'technical' : 'academic');
    }
    setHydrated(true);
    return () => controllers.current.forEach((controller) => controller.abort());
  }, [applicationId, prefill, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(
      () =>
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            schemaVersion: CV_BUILDER_SCHEMA_VERSION,
            applicationId,
            targetProfile: targetProfile ?? undefined,
            form,
            generatedCv: generatedCv ?? undefined,
            selectedTemplate: template,
          }),
        ),
      350,
    );
    return () => clearTimeout(timer);
  }, [applicationId, form, generatedCv, hydrated, storageKey, targetProfile, template]);

  useEffect(() => {
    if (!generatedCv || !previewRef.current) return;
    setTooLong(previewRef.current.scrollHeight > 2246);
  }, [generatedCv, template]);

  const startRequest = () => {
    controllers.current.forEach((controller) => controller.abort());
    const controller = new AbortController();
    controllers.current = [controller];
    setBusy(true);
    setError('');
    return controller;
  };

  const buildTarget = async () => {
    const controller = startRequest();
    setStatus('AI is preparing the Target Profile…');
    try {
      const response = await fetch(`/api/applications/${applicationId}/cv-builder/target-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ careerDirection }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Could not create the Target Profile.');
      await readNdjson(response, (event) => {
        if (event.type === 'status') setStatus(event.message);
        else if (event.type === 'complete' && 'targetProfile' in event) {
          setTargetProfile(event.targetProfile);
          setStatus('');
        } else if (event.type === 'error') {
          setStatus('');
          setError(event.message);
        }
      });
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not create the Target Profile.');
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        setStatus('');
      }
    }
  };

  const generate = async (
    requestedSections?: CvBuilderModelEvent['section'][],
    formOverride = form,
    clarificationRound = false,
  ) => {
    if (!targetProfile) return setError('Create a Target Profile first.');
    const validatedForm = CvBuilderFormSchema.safeParse(formOverride);
    if (!validatedForm.success) {
      setStatus('');
      setError(cvBuilderFormErrorMessage(validatedForm.error));
      setStep(1);
      return;
    }
    const controller = startRequest();
    const acceptedBefore = requestedSections?.length
      ? partial.length
        ? partial
        : generatedCv
          ? generatedCvEvents(generatedCv)
          : []
      : [];
    if (!requestedSections?.length) {
      setGeneratedCv(null);
      setPartial([]);
      setClarificationAnswers({});
    }
    setMissingSections([]);
    setReview(null);
    setReviewEvents([]);
    setStatus('AI is normalizing and arranging the CV…');
    setStep(2);
    try {
      const response = await fetch(`/api/applications/${applicationId}/cv-builder/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetProfile,
          form: validatedForm.data,
          requestedSections,
          mode: clarificationRound ? 'clarification' : undefined,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Could not create the CV.');
      const received: CvBuilderModelEvent[] = [];
      let receivedComplete = false;
      let rebuiltComplete = false;
      await readNdjson(response, (event) => {
        if (event.type === 'section') {
          const sectionEvent = {
            section: event.section,
            data:
              clarificationRound && event.section === 'assessment'
                ? { ...event.data, followUpQuestions: [] }
                : event.data,
          } as CvBuilderModelEvent;
          received.push(sectionEvent);
          setPartial((current) => [
            ...current.filter((item) => item.section !== sectionEvent.section),
            sectionEvent,
          ]);
          const merged = new Map(
            [...acceptedBefore, ...received].map((item) => [item.section, item]),
          );
          if (
            cvBuilderExpectedSections(validatedForm.data).every((section) =>
              merged.has(section),
            ) &&
            (!requestedSections?.length ||
              requestedSections.every((section) =>
                received.some((item) => item.section === section),
              ))
          ) {
            const complete = assembleGeneratedCv(validatedForm.data, merged.values());
            setGeneratedCv(complete);
            rebuiltComplete = true;
            setStatus('');
            setBusy(false);
          }
        } else if (event.type === 'complete' && 'generatedCv' in event) {
          receivedComplete = true;
          setGeneratedCv(
            clarificationRound
              ? {
                  ...event.generatedCv,
                  assessment: {
                    ...event.generatedCv.assessment,
                    followUpQuestions: [],
                  },
                }
              : event.generatedCv,
          );
          rebuiltComplete = true;
          setStatus('');
        } else if (event.type === 'error') {
          setError(event.message);
          if ('missingSections' in event) {
            setMissingSections(event.missingSections as CvBuilderModelEvent['section'][]);
            retryClarification.current = clarificationRound;
          }
        }
      });
      if (requestedSections?.length && !receivedComplete) {
        const merged = new Map(
          [...acceptedBefore, ...received].map((event) => [event.section, event]),
        );
        const expected = cvBuilderExpectedSections(validatedForm.data);
        if (
          expected.every((section) => merged.has(section)) &&
          requestedSections.every((section) =>
            received.some((item) => item.section === section),
          )
        ) {
          const complete = assembleGeneratedCv(validatedForm.data, merged.values());
          setGeneratedCv(complete);
          rebuiltComplete = true;
          setStatus('');
        }
      }
      if (rebuiltComplete) {
        retryClarification.current = false;
        if (clarificationRound) setClarificationAnswers({});
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not create the CV.');
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        setStatus('');
      }
    }
  };

  const reviewCv = async () => {
    if (!generatedCv || generatedCv.assessment.followUpQuestions?.length) return;
    const controller = startRequest();
    setReview(null);
    setReviewEvents([]);
    setStatus('AI is evaluating the current CV…');
    window.setTimeout(
      () => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      100,
    );
    try {
      const text = renderGeneratedCvText(form.personal, generatedCv);
      const response = await fetch(`/api/applications/${applicationId}/cv-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Could not review the CV.');
      await readNdjson(response, (event) => {
        if (event.type === 'section') setReviewEvents((current) => [...current, event as CvReviewSectionEvent]);
        else if (event.type === 'complete' && 'analysis' in event) setReview(event.analysis);
        else if (event.type === 'error') setError(event.message);
      });
      setStatus('');
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not review the CV.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const editForm = (next: CvBuilderFormV1) => {
    setReview(null);
    setReviewEvents([]);
    setForm(next);
    setGeneratedCv((current) =>
      current
        ? {
            ...current,
            plainText: renderGeneratedCvText(next.personal, current),
          }
        : current,
    );
  };

  const editGenerated = (next: GeneratedCvV1) => {
    setReview(null);
    setReviewEvents([]);
    setGeneratedCv({
      ...next,
      plainText: renderGeneratedCvText(form.personal, next),
    });
  };

  const applyClarifications = () => {
    if (!generatedCv) return;
    const questions = generatedCv.assessment.followUpQuestions ?? [];
    if (!questions.every(({ id }) => clarificationAnswers[id]?.trim())) return;
    const applied = applyCvClarificationAnswers(
      form,
      questions,
      clarificationAnswers,
    );
    setForm(applied.form);
    void generate(applied.sections, applied.form, true);
  };

  const partialSummary = useMemo(
    () =>
      partial.map((event) => {
        if (event.section === 'about_me') return { title: 'About Me', text: event.data.text };
        if (event.section === 'assessment') return { title: 'Assessment', text: event.data.strengths.join(' · ') };
        if (event.section === 'layout') return { title: 'Layout', text: event.data.rationale };
        const data = event.data as { items?: unknown[]; groups?: unknown[] };
        return {
          title: event.section.replace('_', ' '),
          text: t('{count} items completed', { count: data.items?.length ?? data.groups?.length ?? 0 }),
        };
      }),
    [partial, t],
  );
  const followUpQuestions = generatedCv?.assessment.followUpQuestions ?? [];
  const clarificationRequired = followUpQuestions.length > 0;
  const answeredClarificationCount = followUpQuestions.filter(({ id }) =>
    clarificationAnswers[id]?.trim(),
  ).length;
  const allClarificationsAnswered =
    clarificationRequired &&
    answeredClarificationCount === followUpQuestions.length;
  const improvingCv = busy && status.includes('normalizing and arranging the CV');
  const reviewingCv = busy && status.includes('evaluating the current CV');

  return (
    <main className="cv-builder-shell min-h-screen bg-white text-slate-950 print:bg-white">
      <style jsx global>{`
        @page { size: A4; margin: 11mm; }
        .cv-paper { display: flex; width: 210mm; min-height: 297mm; flex-direction: column; background: white; padding: 13mm 17mm; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 9.4pt; line-height: 1.18; box-shadow: 0 18px 55px rgba(15,23,42,.12); }
        .cv-harvard-header { margin-bottom: 7px; text-align: center; }
        .cv-paper h1 { font-size: 17pt; line-height: 1; font-weight: 800; text-transform: uppercase; }
        .cv-harvard-contact { margin-top: 3px; color: #111; font-size: 8.3pt; white-space: nowrap; }
        .cv-paper section { margin-top: 12px; }
        .cv-paper h2 { margin-bottom: 5px; border-bottom: 1px solid #111; color: #111; font-size: 9pt; line-height: 1.15; font-weight: 400; letter-spacing: 0; text-transform: uppercase; }
        .cv-paper h3 { font-size: 9.4pt; font-weight: 400; text-transform: uppercase; }
        .cv-paper article { margin-bottom: 8px; break-inside: avoid; }
        .cv-paper p { margin: 0; }
        .cv-harvard-entry-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
        .cv-harvard-entry-row > :first-child { min-width: 0; }
        .cv-harvard-entry-row > :last-child { flex: none; text-align: right; }
        .cv-harvard-entry-row--secondary { font-style: italic; }
        .cv-paper time { color: #111; font-size: 9pt; font-weight: 600; white-space: nowrap; }
        .cv-paper ul { margin: 0 0 0 14px; list-style: disc; }
        .cv-paper li { margin: 0; padding-left: 1px; }
        .cv-paper section.cv-section-editable { --cv-drag-source: #fff1f2; --cv-drop-target: #ffe4e6; --cv-drop-outline: #fb7185; position: relative; outline: 1px dashed transparent; outline-offset: 5px; transition: background-color .15s, box-shadow .15s, opacity .15s, outline-color .15s; }
        .cv-paper section.cv-section-editable:hover, .cv-paper section.cv-section-editable:focus-within { outline-color: #94a3b8; }
        .cv-paper section.cv-section-dragging { box-shadow: 0 0 0 5px var(--cv-drag-source); opacity: .72; }
        .cv-paper section.cv-section-drop-target { box-shadow: 0 0 0 6px var(--cv-drop-target); outline-color: var(--cv-drop-outline); }
        .cv-section-toolbar { --cv-control: #8493a3; --cv-control-hover: #6f7f90; --cv-delete: #e54b3b; --cv-delete-hover: #ca382b; position: absolute; top: -37px; left: -1px; display: flex; gap: 6px; opacity: 0; transition: opacity .15s; }
        .cv-section-editable:hover > .cv-section-toolbar, .cv-section-editable:focus-within > .cv-section-toolbar { opacity: 1; }
        .cv-section-toolbar button { display: grid; width: 32px; height: 32px; place-items: center; border: 0; border-radius: 7px; background: var(--cv-control); color: #fff; box-shadow: 0 2px 5px rgba(15,23,42,.18); font: 700 14px/1 Arial, sans-serif; cursor: pointer; transition: background-color .15s, transform .15s; }
        .cv-section-toolbar button:hover:not(:disabled) { background: var(--cv-control-hover); transform: translateY(-1px); }
        .cv-section-toolbar button:focus-visible { outline: 3px solid #f9a8d4; outline-offset: 2px; }
        .cv-section-toolbar button:disabled { opacity: .42; cursor: not-allowed; }
        .cv-section-toolbar button svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
        .cv-section-toolbar .cv-section-drag { cursor: grab; }
        .cv-section-toolbar .cv-section-drag:active { cursor: grabbing; }
        .cv-section-toolbar .cv-section-delete { width: auto; padding: 0 10px; background: var(--cv-delete); }
        .cv-section-toolbar .cv-section-delete:hover:not(:disabled) { background: var(--cv-delete-hover); }
        .cv-inline-editor { display: block; min-width: 4rem; border-radius: 3px; outline: none; transition: background-color .15s, box-shadow .15s; }
        .cv-inline-editor--inline { display: inline-block; min-width: 1rem; }
        .cv-inline-editor:hover { background: #fff7fb; box-shadow: 0 0 0 2px #fbcfe8; }
        .cv-inline-editor:focus { background: #fff7fb; box-shadow: 0 0 0 2px #ec4899; }
        @media print {
          body * { visibility: hidden !important; }
          .cv-section-toolbar { display: none !important; }
          #cv-print-area, #cv-print-area * { visibility: visible !important; }
          #cv-print-area { position: absolute; inset: 0; width: 100%; min-height: 0; padding: 0; box-shadow: none; }
        }
        @media (hover: none) { .cv-section-toolbar { opacity: 1; } }
      `}</style>
      <header className="border-b border-slate-200 bg-white px-5 py-4 print:hidden">
        <div className="mx-auto flex max-w-[1216px] flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={`/apply/${applicationId}/cv`}
              className="text-xs font-bold text-slate-500 transition hover:text-rose-600"
            >
              ← CV Workspace
            </Link>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Build My CV</h1>
            <p className="text-sm text-slate-500">{programmeName} · {universityName}</p>
          </div>
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold transition hover:border-rose-300 hover:text-rose-700"
            onClick={() => {
              localStorage.removeItem(storageKey);
              setForm(prefill);
              setTargetProfile(null);
              setGeneratedCv(null);
              setPartial([]);
              setStep(0);
            }}
          >
            {t('Clear the draft on this device')}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1216px] px-5 py-8 print:max-w-none print:p-0">
        <WorkflowProgress step={step} cvReady={Boolean(generatedCv)} onChange={setStep} />
        <div className="mt-10">
          {error && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 print:hidden">
              {t(error)}
              {missingSections.length > 0 && (
                <button
                  className="ml-4 rounded-full border border-red-300 px-3 py-1.5 font-bold"
                  disabled={busy}
                  onClick={() =>
                    generate(missingSections, form, retryClarification.current)
                  }
                >
                  {t('Retry the missing sections')}
                </button>
              )}
            </div>
          )}

          {step === 0 && (
            <section className="print:hidden">
              <div className="mx-auto max-w-4xl text-center">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-rose-600">Target Profile</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t('Decide what the CV needs to prove.')}</h2>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                  {t('The AI only uses university, programme and profile data stored in Supabase. Missing pieces are flagged, never invented.')}
                </p>
                <label className="mt-8 block text-left text-xs font-semibold text-slate-600">
                  {t('Career direction (optional)')}
                  <textarea
                    className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-950 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-50"
                    value={careerDirection}
                    onChange={(event) => setCareerDirection(event.target.value)}
                    placeholder={t('e.g. Software Engineer in education technology')}
                  />
                </label>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    className="rounded-lg bg-rose-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                    disabled={busy}
                    onClick={buildTarget}
                  >
                    {busy
                      ? t('AI is working…')
                      : targetProfile
                        ? t('Regenerate Target Profile')
                        : t('Create Target Profile')}
                  </button>
                  {targetProfile && (
                    <button
                      className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
                      onClick={() => setStep(1)}
                    >
                      {t('Continue to content →')}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                <TargetProfile profile={targetProfile} status={status} />
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="print:hidden">
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-rose-600">{t('Content')}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">{t('Enter your CV data')}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {t('Review the existing information and add your experience, awards and skills.')}
                </p>
              </div>
              <FormEditor form={form} setForm={setForm} />
              <div className="mt-10 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6">
                <button className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold" onClick={() => setStep(0)}>
                  {t('Back')}
                </button>
                <button
                  className="rounded-lg bg-rose-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                  disabled={busy || !targetProfile}
                  onClick={() => generate()}
                >
                  {t('Generate CV with AI')}
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="print:hidden">
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-rose-600">{t('CV Draft')}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  {generatedCv ? t('Your CV is ready. Review and edit it.') : t('AI is building your CV.')}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {t('Click directly on the CV content to edit it before running a review.')}
                </p>
              </div>
              {!generatedCv && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 animate-pulse rounded-full bg-rose-500" />
                    <p className="font-semibold">{status ? t(status) : t('AI is working…')}</p>
                  </div>
                  <div className="mt-8 space-y-3">
                    {partialSummary.map((item) => (
                      <article key={item.title} className="rounded-xl border border-slate-200 p-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-rose-600">{item.title}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-700"><TypingText text={item.text} /></p>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              {generatedCv && (
                <div className="grid items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <aside className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 xl:sticky xl:top-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">{t('Evidence coverage')}</p>
                    <h2 className="mt-3 text-xl font-semibold">{t('3 strengths')}</h2>
                    <ol className="mt-5 space-y-3">
                      {generatedCv.assessment.strengths.map((strength, index) => (
                        <li key={strength} className="flex gap-3 text-sm leading-6">
                          <span className="font-bold text-rose-600">0{index + 1}</span>{strength}
                        </li>
                      ))}
                    </ol>
                    {generatedCv.assessment.missingSignals.length > 0 && (
                      <>
                        <h3 className="mt-7 font-semibold">{t('Needs more evidence')}</h3>
                        <ul className="mt-3 space-y-2 text-sm text-slate-600">
                          {generatedCv.assessment.missingSignals.map((signal) => <li key={signal}>{signal}</li>)}
                        </ul>
                      </>
                    )}
                    {(generatedCv.assessment.followUpQuestions?.length ?? 0) > 0 && (
                      <section className="mt-7 border-t border-slate-200 pt-5">
                        <h3 className="font-semibold">{t('AI needs more from you')}</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {t('Answer with real facts. The AI will only rewrite the affected sections.')}
                        </p>
                        <div className="mt-4 space-y-4">
                          {generatedCv.assessment.followUpQuestions?.map((question) => (
                            <label
                              key={question.id}
                              className="block text-xs font-semibold text-slate-700"
                            >
                              {question.question}
                              <span className="mt-1 block font-normal text-amber-700">
                                {question.reason}
                              </span>
                              <textarea
                                aria-label={question.question}
                                className={`${inputClass} mt-2 min-h-24 resize-y`}
                                maxLength={300}
                                value={clarificationAnswers[question.id] ?? ''}
                                onChange={(event) =>
                                  setClarificationAnswers((current) => ({
                                    ...current,
                                    [question.id]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                        <p className="mt-3 text-xs font-semibold text-slate-500">
                          {t('Answered {count}/{total} questions', {
                            count: answeredClarificationCount,
                            total: followUpQuestions.length,
                          })}
                        </p>
                        <button
                          type="button"
                          className="mt-4 w-full rounded-lg bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                          aria-busy={improvingCv}
                          disabled={
                            busy ||
                            !allClarificationsAnswered
                          }
                          onClick={applyClarifications}
                        >
                          {improvingCv
                            ? t('AI is improving the CV…')
                            : t('Use these answers to improve the CV')}
                        </button>
                      </section>
                    )}
                    <p className="mt-7 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                      {t('Click the introduction or any bullet on the CV to edit it.')}
                    </p>
                    <button
                      className="mt-7 w-full rounded-lg border border-rose-300 bg-white px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                      disabled={busy || clarificationRequired}
                      onClick={reviewCv}
                    >
                      {reviewingCv ? t('AI is reviewing…') : t('Run CV Review')}
                    </button>
                    {clarificationRequired && (
                      <p className="mt-2 text-xs leading-5 text-amber-700">
                        {t('Answer every question and regenerate the CV before running Review.')}
                      </p>
                    )}
                    <button className="mt-3 w-full rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100" onClick={() => setStep(3)}>
                      {t('Choose layout →')}
                    </button>
                  </aside>
                  <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4 sm:p-6">
                    <div ref={previewRef} className="mx-auto w-fit">
                      <CvPaper
                        form={form}
                        cv={generatedCv}
                        template={template}
                        onFormChange={editForm}
                        onCvChange={editGenerated}
                      />
                    </div>
                  </div>
                </div>
              )}
              {(status.includes('evaluating the current CV') || reviewEvents.length > 0 || review) && (
                <div
                  ref={reviewRef}
                  className="mt-8 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
                >
                  <CvReviewFeedback events={reviewEvents} analysis={review} streaming={busy} />
                </div>
              )}
            </section>
          )}

          {step === 3 && generatedCv && (
            <section className="print:block">
              <div className="mb-8 print:hidden">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-rose-600">Layout & PDF</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">{t('Choose how the CV is presented')}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {t('Both layouts use the same content; you can switch templates before downloading the PDF.')}
                </p>
              </div>
              <div className="grid items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)] print:block">
              <aside className="rounded-2xl border border-slate-200 bg-white p-5 xl:sticky xl:top-6 print:hidden">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">Select layout</p>
                <div className="mt-5 space-y-3">
                  {(
                    [
                      ['academic', 'Harvard', 'Black and white, single column, ATS-optimized.'],
                      ['technical', 'AACC', 'Light rose–slate, emphasizes personal character.'],
                    ] as const
                  ).map(([id, name, description]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={template === id}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        template === id
                          ? 'border-rose-400 bg-rose-50'
                          : 'border-slate-200 bg-white hover:border-rose-200'
                      }`}
                      onClick={() => setTemplate(id)}
                    >
                      <strong className="block">{name}</strong>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {t(description)}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  {t('AI suggests: {rationale}', { rationale: generatedCv.layout.rationale })}
                </p>
                {tooLong && (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    {t('The CV may run past two pages. Shorten the introduction or the bullets.')}
                  </p>
                )}
                <button
                  className="mt-5 w-full rounded-lg bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-700"
                  onClick={() => window.print()}
                >
                  {t('Download PDF / Print CV')}
                </button>
              </aside>
              <div className="overflow-auto rounded-2xl bg-slate-100 p-4 sm:p-6 print:overflow-visible print:bg-white print:p-0">
                <div className="mx-auto w-fit print:w-full">
                  <CvPaper
                    form={form}
                    cv={generatedCv}
                    template={template}
                    onFormChange={editForm}
                    onCvChange={editGenerated}
                  />
                </div>
              </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
