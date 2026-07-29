'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
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

const steps = ['Target Profile', 'Nội dung', 'Bản CV', 'Harvard & PDF'];
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-50';

async function readNdjson(response: Response, onEvent: (event: AnyStreamEvent) => void) {
  if (!response.body) throw new Error('AI không trả stream.');
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
      <span className="text-xs font-bold tracking-[0.2em] text-pink-600">{number}</span>
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{children}</h2>
    </div>
  );
}

function TargetProfile({
  profile,
  status,
}: {
  profile: CvTargetProfileV1 | null;
  status: string;
}) {
  if (!profile) {
    return (
      <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-pink-200 bg-pink-50/40 p-8 text-center">
        <div>
          <div
            className={`mx-auto h-3 w-3 rounded-full ${
              status ? 'animate-pulse bg-pink-500' : 'bg-slate-300'
            }`}
          />
          <p className="mt-4 text-sm font-semibold text-slate-700">
            {status || 'Chưa có Target Profile. Hãy nhập định hướng và bắt đầu tạo.'}
          </p>
        </div>
      </div>
    );
  }
  const insights = [
    ['Định vị trường', profile.universityDna.positioning],
    ['Triết lý giáo dục', profile.universityDna.educationalPhilosophy],
    ['Môi trường', profile.universityDna.environment],
    ['Mục tiêu chương trình', profile.programmeDna.objectives[0]],
    ['Năng lực ưu tiên', profile.programmeDna.competencies[0]],
    ['Career alignment', profile.careerAlignment[0]],
  ] as const;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {profile.keywords.map((keyword) => (
          <span
            key={keyword}
            className="rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-pink-700"
          >
            {keyword}
          </span>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {insights.map(([label, insight]) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</h3>
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
              {insight?.text ?? 'Chưa đủ dữ liệu'}
            </p>
          </article>
        ))}
      </div>
      {profile.limitations.length > 0 && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          Dữ liệu còn thiếu: {profile.limitations.join(' · ')}
        </p>
      )}
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
    <div className="space-y-8">
      <section>
        <SectionTitle number="01">Thông tin cá nhân</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ tên" value={form.personal.fullName} onChange={(v) => personal('fullName', v)} />
          <Field label="Email" type="email" value={form.personal.email} onChange={(v) => personal('email', v)} />
          <Field label="Điện thoại" value={form.personal.phone} onChange={(v) => personal('phone', v)} />
          <Field label="Địa điểm" value={form.personal.location} onChange={(v) => personal('location', v)} />
          <div className="sm:col-span-2">
            <Field
              label="Links — ngăn cách bằng dấu phẩy"
              value={form.personal.links.join(', ')}
              onChange={(v) => personal('links', v)}
              placeholder="LinkedIn, portfolio, GitHub"
            />
          </div>
        </div>
      </section>

      <section>
        <SectionTitle number="02">Education</SectionTitle>
        <div className="space-y-3">
          {form.education.map((item, index) => (
            <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
              <Field label="Trường" value={item.institution} onChange={(v) => updateEducation(index, 'institution', v)} />
              <Field label="Bằng cấp" value={item.qualification} onChange={(v) => updateEducation(index, 'qualification', v)} />
              <Field label="Ngành học" value={item.fieldOfStudy} onChange={(v) => updateEducation(index, 'fieldOfStudy', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bắt đầu" type="month" value={item.startDate} onChange={(v) => updateEducation(index, 'startDate', v)} />
                <Field label="Kết thúc" type="month" value={item.endDate} onChange={(v) => updateEducation(index, 'endDate', v)} />
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
                Xóa mục này
              </button>
            </div>
          ))}
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
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
            + Thêm education
          </button>
        </div>
      </section>

      <section>
        <SectionTitle number="03">Experience Collection</SectionTitle>
        <p className="-mt-2 mb-5 text-sm text-slate-500">
          Mỗi hoạt động tối đa 5 contributions. Hãy mô tả hành động và kết quả có thật.
        </p>
        <div className="space-y-4">
          {form.entries.map((entry, index) => (
            <div key={entry.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-slate-600">
                  Loại
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
                <Field label="Vai trò / tiêu đề" value={entry.title} onChange={(v) => updateEntry(index, 'title', v)} />
                <Field label="Tổ chức" value={entry.organization} onChange={(v) => updateEntry(index, 'organization', v)} />
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
                      aria-label="Xóa contribution"
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
                  className="text-xs font-semibold text-pink-600 disabled:text-slate-300"
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
                  Xóa hoạt động
                </button>
              </div>
            </div>
          ))}
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
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
            + Thêm trải nghiệm
          </button>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionTitle number="04">Awards</SectionTitle>
          {form.awards.map((award, index) => (
            <div key={award.id} className="mb-3 rounded-2xl border border-slate-200 p-4">
              <Field
                label="Giải thưởng"
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
                Xóa
              </button>
            </div>
          ))}
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
            onClick={() =>
              setForm((current) => ({
                ...current,
                awards: [...current.awards, { id: uid('award'), title: '' }],
              }))
            }
          >
            + Thêm award
          </button>
        </div>
        <div>
          <SectionTitle number="05">Skills</SectionTitle>
          {form.skillGroups.map((group, index) => (
            <div key={group.id} className="mb-3 rounded-2xl border border-slate-200 p-4">
              <Field
                label="Nhóm"
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
                  label="Kỹ năng — ngăn cách bằng dấu phẩy"
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
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
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
            + Thêm nhóm kỹ năng
          </button>
        </div>
      </section>
    </div>
  );
}

function CvPaper({
  form,
  cv,
  typing = false,
  onFormChange,
  onCvChange,
}: {
  form: CvBuilderFormV1;
  cv: GeneratedCvV1;
  typing?: boolean;
  onFormChange?: (form: CvBuilderFormV1) => void;
  onCvChange?: (cv: GeneratedCvV1) => void;
}) {
  const editable = Boolean(onFormChange || onCvChange);
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
      title="Nhấp để chỉnh sửa"
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
        ? 'kinh nghiệm'
        : section === 'projects'
          ? 'dự án'
          : 'hoạt động';
    return items.length ? (
      <section>
        <h2>{editSectionTitle(section, title, `Chỉnh sửa tiêu đề ${title}`)}</h2>
        {items.map((item, itemIndex) => (
          <article key={item.sourceId}>
            <h3>
              {editable
                ? inlineEditor(
                    item.title,
                    `Chỉnh sửa tiêu đề ${itemLabel} ${itemIndex + 1}`,
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
              {item.organization ? (
                <>
                  {' · '}
                  {editable
                    ? inlineEditor(
                        item.organization,
                        `Chỉnh sửa tổ chức ${itemLabel} ${itemIndex + 1}`,
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
                    : item.organization}
                </>
              ) : null}
            </h3>
            {item.dates && (
              <time>
                {editable
                  ? inlineEditor(
                      item.dates,
                      `Chỉnh sửa thời gian ${itemLabel} ${itemIndex + 1}`,
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
            <ul>
              {item.bullets.map((bullet, index) => (
                <li key={`${item.sourceId}-${index}`}>
                  {editable ? (
                    inlineEditor(
                      bullet.text,
                      `Chỉnh sửa ${item.title} — bullet ${index + 1}`,
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
      aria-label="CV Harvard"
      className="cv-paper cv-harvard"
    >
      <header>
        <h1>
          {editable
            ? inlineEditor(
                form.personal.fullName,
                'Chỉnh sửa họ tên',
                (value) =>
                  onFormChange?.({
                    ...form,
                    personal: { ...form.personal, fullName: value },
                  }),
                true,
              )
            : form.personal.fullName}
        </h1>
        <p>
          {(
            [
              ['email', form.personal.email, 'Chỉnh sửa email'],
              ['phone', form.personal.phone, 'Chỉnh sửa số điện thoại'],
              ['location', form.personal.location, 'Chỉnh sửa địa điểm'],
              ...form.personal.links.map((link, index) => [
                `link:${index}`,
                link,
                `Chỉnh sửa liên kết ${index + 1}`,
              ]),
            ] as const
          )
            .filter(([, value]) => value)
            .map(([key, value, label], index) => (
              <span key={key}>
                {index ? ' · ' : ''}
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
      <section>
        <h2>{editSectionTitle('profile', 'Profile', 'Chỉnh sửa tiêu đề Profile')}</h2>
        {editable ? (
          <p>
            {inlineEditor(cv.aboutMe, 'Chỉnh sửa phần giới thiệu', (value) =>
              onCvChange?.({ ...cv, aboutMe: value }),
            )}
          </p>
        ) : (
          <p>{typing ? <TypingText text={cv.aboutMe} /> : cv.aboutMe}</p>
        )}
      </section>
      {cv.education.length > 0 && (
        <section>
          <h2>
            {editSectionTitle('education', 'Education', 'Chỉnh sửa tiêu đề Education')}
          </h2>
          {cv.education.map((item, itemIndex) => (
            <article key={item.sourceId}>
              <h3>
                {editable
                  ? inlineEditor(
                      item.qualification,
                      `Chỉnh sửa bằng cấp ${itemIndex + 1}`,
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
                {' · '}
                {editable
                  ? inlineEditor(
                      item.institution,
                      `Chỉnh sửa trường học ${itemIndex + 1}`,
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
              {item.dates && (
                <time>
                  {editable
                    ? inlineEditor(
                        item.dates,
                        `Chỉnh sửa thời gian học ${itemIndex + 1}`,
                        (value) =>
                          onCvChange?.({
                            ...cv,
                            education: cv.education.map((entry, index) =>
                              index === itemIndex ? { ...entry, dates: value } : entry,
                            ),
                          }),
                        true,
                      )
                    : item.dates}
                </time>
              )}
              {item.fieldOfStudy && (
                <p>
                  {editable
                    ? inlineEditor(
                        item.fieldOfStudy,
                        `Chỉnh sửa ngành học ${itemIndex + 1}`,
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
                            `Chỉnh sửa chi tiết học vấn ${itemIndex + 1}.${detailIndex + 1}`,
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
      {entrySection('experience', 'Experience', cv.experience)}
      {entrySection('projects', 'Projects & Research', cv.projects)}
      {entrySection('activities', 'Activities', cv.activities)}
      {cv.awards.length > 0 && (
        <section>
          <h2>{editSectionTitle('awards', 'Awards', 'Chỉnh sửa tiêu đề Awards')}</h2>
          {cv.awards.map((award, index) => (
            <p key={award.sourceId}>
              <strong>
                {editable
                  ? inlineEditor(
                      award.title,
                      `Chỉnh sửa giải thưởng ${index + 1}`,
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
                        `Chỉnh sửa đơn vị trao giải ${index + 1}`,
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
        <section>
          <h2>{editSectionTitle('skills', 'Skills', 'Chỉnh sửa tiêu đề Skills')}</h2>
          {cv.skillGroups.map((group, index) => (
            <p key={group.sourceId}>
              <strong>
                {editable
                  ? inlineEditor(
                      group.label,
                      `Chỉnh sửa tên nhóm kỹ năng ${index + 1}`,
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
                    `Chỉnh sửa kỹ năng nhóm ${index + 1}`,
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
  const storageKey = cvBuilderDraftKey(userId, applicationId);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(prefill);
  const [careerDirection, setCareerDirection] = useState('');
  const [targetProfile, setTargetProfile] = useState<CvTargetProfileV1 | null>(null);
  const [generatedCv, setGeneratedCv] = useState<GeneratedCvV1 | null>(null);
  const [partial, setPartial] = useState<CvBuilderModelEvent[]>([]);
  const template: CvTemplateId = 'academic';
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
  }, [generatedCv]);

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
    setStatus('AI đang chuẩn bị Target Profile…');
    try {
      const response = await fetch(`/api/applications/${applicationId}/cv-builder/target-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ careerDirection }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Không thể tạo Target Profile.');
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
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không thể tạo Target Profile.');
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
  ) => {
    if (!targetProfile) return setError('Hãy tạo Target Profile trước.');
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
    setStatus('AI đang chuẩn hóa và sắp xếp CV…');
    setStep(2);
    try {
      const response = await fetch(`/api/applications/${applicationId}/cv-builder/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetProfile,
          form: validatedForm.data,
          requestedSections,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Không thể tạo CV.');
      const received: CvBuilderModelEvent[] = [];
      let receivedComplete = false;
      await readNdjson(response, (event) => {
        if (event.type === 'section') {
          const sectionEvent = { section: event.section, data: event.data } as CvBuilderModelEvent;
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
            )
          ) {
            const complete = assembleGeneratedCv(validatedForm.data, merged.values());
            setGeneratedCv(complete);
            setStatus('');
            setBusy(false);
          }
        } else if (event.type === 'complete' && 'generatedCv' in event) {
          receivedComplete = true;
          setGeneratedCv(event.generatedCv);
          setStatus('');
        } else if (event.type === 'error') {
          setError(event.message);
          if ('missingSections' in event) {
            setMissingSections(event.missingSections as CvBuilderModelEvent['section'][]);
          }
        }
      });
      if (requestedSections?.length && !receivedComplete) {
        const merged = new Map(
          [...acceptedBefore, ...received].map((event) => [event.section, event]),
        );
        const expected = cvBuilderExpectedSections(validatedForm.data);
        if (expected.every((section) => merged.has(section))) {
          const complete = assembleGeneratedCv(validatedForm.data, merged.values());
          setGeneratedCv(complete);
          setStatus('');
        }
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không thể tạo CV.');
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
    setStatus('AI đang đánh giá CV hiện tại…');
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
      if (!response.ok) throw new Error((await response.json()).error ?? 'Không thể review CV.');
      await readNdjson(response, (event) => {
        if (event.type === 'section') setReviewEvents((current) => [...current, event as CvReviewSectionEvent]);
        else if (event.type === 'complete' && 'analysis' in event) setReview(event.analysis);
        else if (event.type === 'error') setError(event.message);
      });
      setStatus('');
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không thể review CV.');
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
    setClarificationAnswers({});
    void generate(applied.sections, applied.form);
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
          text: `${data.items?.length ?? data.groups?.length ?? 0} mục đã hoàn tất`,
        };
      }),
    [partial],
  );
  const followUpQuestions = generatedCv?.assessment.followUpQuestions ?? [];
  const clarificationRequired = followUpQuestions.length > 0;
  const allClarificationsAnswered =
    clarificationRequired &&
    followUpQuestions.every(({ id }) => clarificationAnswers[id]?.trim());

  return (
    <main className="cv-builder-shell min-h-screen bg-[#f6f4f1] text-slate-950 print:bg-white">
      <style jsx global>{`
        @page { size: A4; margin: 11mm; }
        .cv-paper { width: 210mm; min-height: 297mm; background: white; padding: 17mm 18mm; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.3; box-shadow: 0 18px 55px rgba(15,23,42,.12); }
        .cv-paper header { border-bottom: 1.5px solid #111827; padding-bottom: 7px; margin-bottom: 10px; }
        .cv-paper h1 { font-size: 25pt; letter-spacing: -.035em; font-weight: 800; }
        .cv-paper header p, .cv-paper time { color: #475569; font-size: 9pt; }
        .cv-paper section { margin-top: 9px; break-inside: avoid; }
        .cv-paper h2 { margin-bottom: 4px; color: #111827; font-size: 8.5pt; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
        .cv-paper h3 { font-weight: 750; }
        .cv-paper article { margin-bottom: 6px; break-inside: avoid; }
        .cv-paper ul { margin: 2px 0 0 15px; list-style: disc; }
        .cv-paper li { margin-top: 1px; }
        .cv-inline-editor { display: block; min-width: 4rem; border-radius: 3px; outline: none; transition: background-color .15s, box-shadow .15s; }
        .cv-inline-editor--inline { display: inline-block; min-width: 1rem; }
        .cv-inline-editor:hover { background: #fff7fb; box-shadow: 0 0 0 2px #fbcfe8; }
        .cv-inline-editor:focus { background: #fff7fb; box-shadow: 0 0 0 2px #ec4899; }
        @media print {
          body * { visibility: hidden !important; }
          #cv-print-area, #cv-print-area * { visibility: visible !important; }
          #cv-print-area { position: absolute; inset: 0; width: 100%; min-height: 0; padding: 0; box-shadow: none; }
        }
      `}</style>
      <header className="border-b border-slate-200 bg-white/90 px-5 py-5 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div>
            <Link href={`/apply/${applicationId}/cv`} className="text-xs font-bold text-slate-500">← CV Workspace</Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Build My CV</h1>
            <p className="text-sm text-slate-500">{programmeName} · {universityName}</p>
          </div>
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold"
            onClick={() => {
              localStorage.removeItem(storageKey);
              setForm(prefill);
              setTargetProfile(null);
              setGeneratedCv(null);
              setPartial([]);
              setStep(0);
            }}
          >
            Xóa bản nháp trên thiết bị
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-5 py-6 lg:grid-cols-[220px_minmax(0,1fr)] print:block print:p-0">
        <nav className="rounded-3xl border border-slate-200 bg-white p-4 lg:sticky lg:top-6 lg:h-fit print:hidden">
          {steps.map((label, index) => (
            <button
              key={label}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold ${
                index === step ? 'bg-pink-50 text-pink-700' : 'text-slate-500'
              }`}
              onClick={() => setStep(index)}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${index === step ? 'bg-pink-500 text-white' : 'bg-slate-100'}`}>
                {index + 1}
              </span>
              {label}
            </button>
          ))}
        </nav>

        <div>
          {error && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 print:hidden">
              {error}
              {missingSections.length > 0 && (
                <button
                  className="ml-4 rounded-full border border-red-300 px-3 py-1.5 font-bold"
                  disabled={busy}
                  onClick={() => generate(missingSections)}
                >
                  Thử lại phần thiếu
                </button>
              )}
            </div>
          )}

          {step === 0 && (
            <section className="grid gap-5 xl:grid-cols-[370px_minmax(0,1fr)] print:hidden">
              <div className="rounded-3xl border border-pink-200 bg-white p-7 text-slate-950 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-600">Target Profile</p>
                <h2 className="mt-8 text-3xl font-semibold tracking-tight">Xác định CV cần chứng minh điều gì.</h2>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  AI chỉ dùng dữ liệu trường, chương trình và hồ sơ có trong Supabase. Phần thiếu sẽ được đánh dấu, không tự bịa.
                </p>
                <label className="mt-8 block text-xs font-semibold text-slate-600">
                  Định hướng nghề nghiệp (không bắt buộc)
                  <textarea
                    className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-slate-200 bg-[#faf8f5] p-4 text-sm text-slate-950 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-50"
                    value={careerDirection}
                    onChange={(event) => setCareerDirection(event.target.value)}
                    placeholder="Ví dụ: Software Engineer in education technology"
                  />
                </label>
                <button
                  className="mt-5 w-full rounded-full bg-pink-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={buildTarget}
                >
                  {busy ? 'AI đang làm…' : targetProfile ? 'Tạo lại Target Profile' : 'Tạo Target Profile'}
                </button>
                {targetProfile && (
                  <button className="mt-3 w-full text-sm font-semibold text-pink-600" onClick={() => setStep(1)}>
                    Tiếp tục nhập nội dung →
                  </button>
                )}
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <TargetProfile profile={targetProfile} status={status} />
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8 print:hidden">
              <FormEditor form={form} setForm={setForm} />
              <div className="mt-10 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6">
                <button className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold" onClick={() => setStep(0)}>
                  Quay lại
                </button>
                <button
                  className="rounded-full bg-pink-500 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                  disabled={busy || !targetProfile}
                  onClick={() => generate()}
                >
                  Tạo CV bằng AI
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="print:hidden">
              {!generatedCv && (
                <div className="rounded-3xl border border-slate-200 bg-white p-8">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 animate-pulse rounded-full bg-pink-500" />
                    <p className="font-semibold">{status || 'AI đang làm…'}</p>
                  </div>
                  <div className="mt-8 space-y-3">
                    {partialSummary.map((item) => (
                      <article key={item.title} className="rounded-2xl border border-slate-200 p-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-pink-600">{item.title}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-700"><TypingText text={item.text} /></p>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              {generatedCv && (
                <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <aside className="rounded-3xl border border-slate-200 bg-white p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-600">AI Assessment</p>
                    <h2 className="mt-3 text-2xl font-semibold">Ba điểm mạnh</h2>
                    <ol className="mt-5 space-y-3">
                      {generatedCv.assessment.strengths.map((strength, index) => (
                        <li key={strength} className="flex gap-3 text-sm leading-6">
                          <span className="font-bold text-pink-600">0{index + 1}</span>{strength}
                        </li>
                      ))}
                    </ol>
                    {generatedCv.assessment.missingSignals.length > 0 && (
                      <>
                        <h3 className="mt-7 font-semibold">Còn thiếu tín hiệu</h3>
                        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
                          {generatedCv.assessment.missingSignals.map((signal) => <li key={signal}>{signal}</li>)}
                        </ul>
                      </>
                    )}
                    {(generatedCv.assessment.followUpQuestions?.length ?? 0) > 0 && (
                      <section className="mt-7 border-t border-slate-200 pt-5">
                        <h3 className="font-semibold">AI cần bạn bổ sung</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Trả lời bằng dữ kiện thật. AI sẽ chỉ viết lại phần liên quan.
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
                        <button
                          type="button"
                          className="mt-4 w-full rounded-full bg-pink-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                          disabled={
                            busy ||
                            !allClarificationsAnswered
                          }
                          onClick={applyClarifications}
                        >
                          Dùng câu trả lời để cải thiện CV
                        </button>
                      </section>
                    )}
                    <p className="mt-7 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                      Nhấp vào phần giới thiệu hoặc bullet trên CV để chỉnh sửa.
                    </p>
                    <button
                      className="mt-7 w-full rounded-full border border-pink-300 px-4 py-3 text-sm font-bold text-pink-700 disabled:opacity-50"
                      disabled={busy || clarificationRequired}
                      onClick={reviewCv}
                    >
                      {busy ? 'AI đang review…' : 'Chạy CV Review'}
                    </button>
                    {clarificationRequired && (
                      <p className="mt-2 text-xs leading-5 text-amber-700">
                        Hãy trả lời đủ các câu hỏi và tạo lại CV trước khi chạy Review.
                      </p>
                    )}
                    {(status.includes('đánh giá CV') || reviewEvents.length > 0) && (
                      <p className="mt-3 rounded-xl bg-pink-50 px-3 py-2 text-xs font-semibold text-pink-700">
                        {reviewEvents.length
                          ? `Đã nhận ${reviewEvents.length} phần nhận xét — xem ngay bên dưới.`
                          : 'AI đang đọc và đánh giá CV…'}
                      </p>
                    )}
                    <button className="mt-3 w-full rounded-full border border-pink-300 bg-pink-50 px-4 py-3 text-sm font-bold text-pink-700" onClick={() => setStep(3)}>
                      Chọn layout →
                    </button>
                  </aside>
                  <div className="overflow-auto rounded-3xl border border-slate-200 bg-slate-200/70 p-4">
                    <div ref={previewRef} className="mx-auto w-fit">
                      <CvPaper
                        form={form}
                        cv={generatedCv}
                        onFormChange={editForm}
                        onCvChange={editGenerated}
                      />
                    </div>
                  </div>
                </div>
              )}
              {(status.includes('đánh giá CV') || reviewEvents.length > 0 || review) && (
                <div
                  ref={reviewRef}
                  className="mt-6 scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-5"
                >
                  <CvReviewFeedback events={reviewEvents} analysis={review} streaming={busy} />
                </div>
              )}
            </section>
          )}

          {step === 3 && generatedCv && (
            <section className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)] print:block">
              <aside className="rounded-3xl border border-slate-200 bg-white p-5 print:hidden">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-600">Layout</p>
                <div className="mt-5 rounded-2xl border border-pink-400 bg-pink-50 p-4">
                  <strong className="block">Harvard-style CV</strong>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Bố cục đen trắng, một cột, dễ đọc và thân thiện với ATS.
                  </span>
                </div>
                <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  AI đề xuất: {generatedCv.layout.rationale}
                </p>
                {tooLong && (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    CV có thể vượt hai trang. Hãy rút gọn phần giới thiệu hoặc các bullet.
                  </p>
                )}
                <button
                  className="mt-5 w-full rounded-full bg-pink-500 px-5 py-3 text-sm font-bold text-white"
                  onClick={() => window.print()}
                >
                  Tải PDF / In CV
                </button>
              </aside>
              <div className="overflow-auto rounded-3xl bg-slate-200/70 p-4 print:overflow-visible print:bg-white print:p-0">
                <div className="mx-auto w-fit print:w-full">
                  <CvPaper
                    form={form}
                    cv={generatedCv}
                    onFormChange={editForm}
                    onCvChange={editGenerated}
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
