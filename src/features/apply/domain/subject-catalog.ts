/**
 * The subjects a student can say they are interested in.
 *
 * ─── CONFIGURATION, NOT MARKUP ───────────────────────────────────────────────
 *
 * The spec asks for this to be configuration-driven rather than baked into the
 * rendering component, and the reason shows up immediately: the previous list
 * came from `subjectFamilies` in `lib/onboarding-options.ts`, which is a
 * university-discovery taxonomy that happens to be dominated by computing. A
 * student wanting Nursing or Politics had nothing to click. Adding a subject
 * should be a line here, and it is.
 *
 * ─── IDS ARE STORED, LABELS ARE SHOWN ────────────────────────────────────────
 *
 * Every subject has a stable slug. That is what goes into the profile and what
 * downstream course matching reads, so renaming "Media & Communication" is a
 * copy change rather than a data migration, and the Vietnamese UI does not
 * store Vietnamese into a column English matching later parses.
 *
 * ⚠️ Never change an existing `id`. It is persisted. Change `label` freely.
 *
 * ─── ALIASES ARE THE POINT OF THE SEARCH ─────────────────────────────────────
 *
 * A student types "CS", "AI" or "med", not "Computer Science", "Artificial
 * Intelligence" or "Medicine & Health". Only words that are not already in the
 * label are listed — search matches label and aliases together.
 */

export type SubjectGroup =
  | 'Computing & Technology'
  | 'Business'
  | 'Science'
  | 'Health'
  | 'Engineering'
  | 'Humanities & Social Sciences'
  | 'Creative'
  | 'Other areas';

export type SubjectOption = {
  /** Persisted. Never change one of these. */
  id: string;
  label: string;
  group: SubjectGroup;
  /** Key into `ICONS`; see `question-chrome.tsx`'s `questionIcon`. */
  icon: string;
  /** Extra search terms beyond the label's own words. */
  aliases: readonly string[];
};

/**
 * The `id` a custom subject is recorded under.
 *
 * Selecting it reveals a free-text field; the text is stored separately
 * (`customSubject`) rather than as a subject id, so downstream matching is
 * never handed a slug it cannot resolve.
 */
export const OTHER_SUBJECT_ID = 'other';

export const SUBJECTS: readonly SubjectOption[] = [
  // Computing & Technology
  { id: 'computer-science', label: 'Computer Science', group: 'Computing & Technology', icon: 'zap', aliases: ['CS', 'computing', 'informatics'] },
  { id: 'software-engineering', label: 'Software Engineering', group: 'Computing & Technology', icon: 'zapFast', aliases: ['SE', 'programming', 'developer', 'coding'] },
  { id: 'data-science', label: 'Data Science & Analytics', group: 'Computing & Technology', icon: 'chartBreakoutSquare', aliases: ['analytics', 'big data', 'statistics'] },
  { id: 'artificial-intelligence', label: 'Artificial Intelligence', group: 'Computing & Technology', icon: 'zapFast', aliases: ['AI', 'machine learning', 'ML'] },
  { id: 'cyber-security', label: 'Cyber Security', group: 'Computing & Technology', icon: 'checkCircle', aliases: ['infosec', 'security', 'cybersecurity'] },
  { id: 'information-technology', label: 'Information Technology', group: 'Computing & Technology', icon: 'zap', aliases: ['IT', 'systems'] },

  // Business
  { id: 'business-management', label: 'Business & Management', group: 'Business', icon: 'usersTwo', aliases: ['business', 'MBA', 'management'] },
  { id: 'finance-accounting', label: 'Finance & Accounting', group: 'Business', icon: 'chartBreakoutSquare', aliases: ['finance', 'accounting', 'ACCA', 'banking'] },
  { id: 'economics', label: 'Economics', group: 'Business', icon: 'chartBreakoutSquare', aliases: ['econ'] },
  { id: 'marketing', label: 'Marketing', group: 'Business', icon: 'send', aliases: ['advertising', 'brand'] },
  { id: 'entrepreneurship', label: 'Entrepreneurship', group: 'Business', icon: 'zapFast', aliases: ['startup', 'founder'] },

  // Science
  { id: 'mathematics', label: 'Mathematics', group: 'Science', icon: 'chartBreakoutSquare', aliases: ['maths', 'math'] },
  { id: 'physics', label: 'Physics', group: 'Science', icon: 'zap', aliases: [] },
  { id: 'chemistry', label: 'Chemistry', group: 'Science', icon: 'gift01', aliases: [] },
  { id: 'biology', label: 'Biology', group: 'Science', icon: 'heart', aliases: ['bio', 'life sciences'] },
  { id: 'environmental-science', label: 'Environmental Science', group: 'Science', icon: 'markerPin02', aliases: ['climate', 'sustainability', 'ecology'] },

  // Health
  { id: 'medicine', label: 'Medicine & Health', group: 'Health', icon: 'heart', aliases: ['med', 'medical', 'doctor', 'MBBS'] },
  { id: 'nursing', label: 'Nursing', group: 'Health', icon: 'heart', aliases: ['nurse'] },
  { id: 'pharmacy', label: 'Pharmacy', group: 'Health', icon: 'gift01', aliases: ['pharmaceutical', 'pharmacology'] },
  { id: 'biomedical-science', label: 'Biomedical Science', group: 'Health', icon: 'heart', aliases: ['biomed'] },

  // Engineering
  { id: 'engineering-general', label: 'Engineering', group: 'Engineering', icon: 'zap', aliases: ['general engineering'] },
  { id: 'mechanical-engineering', label: 'Mechanical Engineering', group: 'Engineering', icon: 'zap', aliases: ['mecheng'] },
  { id: 'electrical-engineering', label: 'Electrical Engineering', group: 'Engineering', icon: 'zapFast', aliases: ['electronics', 'EEE'] },
  { id: 'civil-engineering', label: 'Civil Engineering', group: 'Engineering', icon: 'markerPin02', aliases: ['structural'] },
  { id: 'chemical-engineering', label: 'Chemical Engineering', group: 'Engineering', icon: 'gift01', aliases: ['chemeng', 'process engineering'] },
  { id: 'aerospace-engineering', label: 'Aerospace Engineering', group: 'Engineering', icon: 'send', aliases: ['aeronautical', 'aviation'] },

  // Humanities & Social Sciences
  { id: 'psychology', label: 'Psychology', group: 'Humanities & Social Sciences', icon: 'messageSmileCircle', aliases: ['psych'] },
  { id: 'law', label: 'Law', group: 'Humanities & Social Sciences', icon: 'checkCircle', aliases: ['LLB', 'legal', 'jurisprudence'] },
  { id: 'politics', label: 'Politics', group: 'Humanities & Social Sciences', icon: 'usersTwo', aliases: ['political science', 'government', 'PPE'] },
  { id: 'international-relations', label: 'International Relations', group: 'Humanities & Social Sciences', icon: 'markerPin02', aliases: ['IR', 'diplomacy', 'global affairs'] },
  { id: 'sociology', label: 'Sociology', group: 'Humanities & Social Sciences', icon: 'usersTwo', aliases: [] },
  { id: 'history', label: 'History', group: 'Humanities & Social Sciences', icon: 'clock', aliases: [] },
  { id: 'philosophy', label: 'Philosophy', group: 'Humanities & Social Sciences', icon: 'messageChatCircle', aliases: ['ethics'] },

  // Creative
  { id: 'architecture', label: 'Architecture', group: 'Creative', icon: 'markerPin02', aliases: ['architect'] },
  { id: 'arts-design', label: 'Arts & Design', group: 'Creative', icon: 'edit02', aliases: ['art', 'graphic design', 'fine art', 'fashion'] },
  { id: 'media-communication', label: 'Media & Communication', group: 'Creative', icon: 'messageChatCircle', aliases: ['comms', 'journalism', 'PR'] },
  { id: 'film', label: 'Film', group: 'Creative', icon: 'send', aliases: ['cinema', 'filmmaking'] },
  { id: 'music', label: 'Music', group: 'Creative', icon: 'heart', aliases: ['musician', 'composition'] },

  // Other areas
  { id: 'education', label: 'Education', group: 'Other areas', icon: 'graduationCap', aliases: ['teaching', 'teacher', 'pedagogy'] },
  { id: 'social-sciences', label: 'Social Sciences', group: 'Other areas', icon: 'usersTwo', aliases: ['anthropology'] },
  { id: 'hospitality-tourism', label: 'Hospitality & Tourism', group: 'Other areas', icon: 'send', aliases: ['hotel', 'travel', 'tourism'] },
  { id: 'languages', label: 'Languages', group: 'Other areas', icon: 'messageChatCircle', aliases: ['linguistics', 'translation', 'TESOL'] },
  { id: 'agriculture', label: 'Agriculture', group: 'Other areas', icon: 'markerPin02', aliases: ['farming', 'agronomy', 'food science'] },
  { id: OTHER_SUBJECT_ID, label: 'Other', group: 'Other areas', icon: 'edit02', aliases: ['something else'] },
];

/** Every subject except the free-text escape hatch. */
export const SELECTABLE_SUBJECTS = SUBJECTS.filter((s) => s.id !== OTHER_SUBJECT_ID);

export function subjectById(id: string): SubjectOption | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

/** Lower-cased and stripped of diacritics, so "kinh te" matches too. */
export function normaliseQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filter subjects by label or alias.
 *
 * Prefix matches rank above substring ones so "eco" offers Economics before
 * Environmental Science. "Other" is deliberately kept in the results for an
 * empty query — it is how a student says the list does not cover them — but
 * is not surfaced by a search that matched nothing else, because offering
 * "Other" as the answer to "marine robotics" tells them nothing. The empty
 * state does that job instead, with the text they typed.
 */
export function searchSubjects(query: string): readonly SubjectOption[] {
  const q = normaliseQuery(query);
  if (!q) return SUBJECTS;

  const prefix: SubjectOption[] = [];
  const contains: SubjectOption[] = [];

  for (const subject of SUBJECTS) {
    if (subject.id === OTHER_SUBJECT_ID) continue;
    const haystacks = [subject.label, ...subject.aliases].map(normaliseQuery);
    if (haystacks.some((h) => h.startsWith(q))) prefix.push(subject);
    else if (haystacks.some((h) => h.includes(q))) contains.push(subject);
  }

  return [...prefix, ...contains];
}
