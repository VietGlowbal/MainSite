/**
 * The Home consultation form (`#contact`) — its options, its validation, and
 * how a submission is written down.
 *
 * Pure on purpose: the same `validateConsultation` runs in the browser before
 * submit (instant inline errors) and again inside the server action (the only
 * check that counts). One rule set, so the two can never disagree about what a
 * valid request is.
 *
 * ─── WHERE THE FIELDS GO ────────────────────────────────────────────────────
 *
 * `waitlist_signups` (measured 2026-09-27 on `kvwsugncsvwvdukdmjij`) has
 * columns for name, email, phone and date of birth.
 * sql/supabase-waitlist-consultation-fields.sql adds destination, budget and
 * package; the repository writes them there when the columns exist and retries
 * without them when they do not. `consultationNotes` writes the same three as
 * one labelled line in `notes` either way — it is what a person reads in the
 * dashboard, and it is what keeps the answers before that migration has run.
 */
import { z } from 'zod';

/** Package ids, in the order the form's radio cards list them. */
export const CONSULTATION_PACKAGES = ['starter', 'yearly', 'premium'] as const;
export type ConsultationPackage = (typeof CONSULTATION_PACKAGES)[number];

export function isConsultationPackage(value: string): value is ConsultationPackage {
  return (CONSULTATION_PACKAGES as readonly string[]).includes(value);
}

/**
 * Package names and prices as the owner's PDF prints them. English is the
 * source; the Vietnamese unit comes from the dictionary ("/year" → "/năm").
 *
 * ⚠️ These are NOT the prices `src/lib/plus.ts` charges at checkout (Monthly /
 * Yearly with 3 sessions / Premium with 5). The Home form only records which
 * package a student is interested in — nothing here takes payment — so the
 * mismatch does not break a purchase, but the two must be reconciled before
 * any "Get plan" button is pointed at checkout. See the design brief's
 * [CONFIRM] #6.
 */
export const CONSULTATION_PACKAGE_OPTIONS: ReadonlyArray<{
  readonly id: ConsultationPackage;
  readonly name: string;
  /** Short price for the radio card. `null` renders the localized "Free". */
  readonly price: string | null;
}> = [
  { id: 'starter', name: 'GlowBal Starter', price: null },
  { id: 'yearly', name: 'GlowBal Yearly', price: '2.49M ₫' },
  { id: 'premium', name: 'GlowBal Yearly Premium', price: '4.49M ₫' },
];

/** Budget bands, in the order the select lists them. */
export const CONSULTATION_BUDGETS = ['under-300m', '300-500m', '500-800m', 'over-800m'] as const;
export type ConsultationBudget = (typeof CONSULTATION_BUDGETS)[number];

/** English labels, which double as the dictionary keys for Vietnamese. */
export const CONSULTATION_BUDGET_LABELS: Readonly<Record<ConsultationBudget, string>> = {
  'under-300m': 'Under 300 million VND (< 300 triệu VND)',
  '300-500m': '300–500 million VND',
  '500-800m': '500–800 million VND',
  'over-800m': 'Over 800 million VND (> 800 triệu VND)',
};

/** Vietnam first: it is the default and nearly every student's number. */
export const CONSULTATION_DIAL_CODES = [
  { value: 'VN', code: '+84', label: 'VN +84' },
  { value: 'US', code: '+1', label: 'US +1' },
  { value: 'GB', code: '+44', label: 'UK +44' },
  { value: 'AU', code: '+61', label: 'AU +61' },
] as const;
export type ConsultationDialCode = (typeof CONSULTATION_DIAL_CODES)[number]['value'];

const DIAL_VALUES = CONSULTATION_DIAL_CODES.map((entry) => entry.value) as [
  ConsultationDialCode,
  ...ConsultationDialCode[],
];

/** The design's own email rule — deliberately loose; the mailbox is the real test. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOB_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export type ConsultationField = 'name' | 'dob' | 'email' | 'phone' | 'destination' | 'consent';

/**
 * Error codes, not sentences: the UI owns the wording (and its translation),
 * the rules only say what went wrong.
 */
export type ConsultationErrorCode = 'required' | 'email' | 'dob' | 'phone' | 'consent';

export type ConsultationFieldErrors = Partial<Record<ConsultationField, ConsultationErrorCode>>;

export type ConsultationInput = {
  readonly name: string;
  /** `dd/mm/yyyy`, exactly as the student typed it. */
  readonly dob: string;
  readonly email: string;
  readonly dialCode: string;
  readonly phone: string;
  readonly destination: string;
  readonly budget: string;
  readonly package: string;
  readonly consent: boolean;
};

export type ConsultationRequest = {
  readonly name: string;
  /** ISO `YYYY-MM-DD`, ready for the `date_of_birth` date column. */
  readonly dateOfBirth: string;
  readonly email: string;
  readonly dialCode: ConsultationDialCode;
  readonly phone: string;
  readonly destination: string;
  readonly budget: ConsultationBudget | null;
  readonly package: ConsultationPackage | null;
};

/**
 * `dd/mm/yyyy` → ISO date, or `null` when it is not a real calendar date a
 * living applicant could have. Round-tripping through `Date.UTC` rejects
 * 31/02 and friends without a lookup table.
 */
export function parseDateOfBirth(value: string, now: Date = new Date()): string | null {
  const match = DOB_PATTERN.exec(value.trim());
  if (match === null) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (year < 1900 || year > now.getUTCFullYear()) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getTime() > now.getTime()
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Keep only digits and re-insert the slashes, so the field reads `dd/mm/yyyy`
 * however it was typed or pasted. Typing a slash yourself is simply ignored.
 */
export function formatDateOfBirthInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

const requestSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120),
  dob: z.string().trim().min(1, 'required'),
  email: z.string().trim().min(1, 'required').max(190).regex(EMAIL_PATTERN, 'email'),
  dialCode: z.enum(DIAL_VALUES).catch('VN'),
  phone: z
    .string()
    .trim()
    .min(1, 'required')
    .max(32)
    .refine((value) => value.replace(/\D/g, '').length >= 6, 'phone'),
  destination: z.string().trim().min(1, 'required').max(160),
  budget: z.enum(CONSULTATION_BUDGETS).nullable().catch(null),
  package: z.enum(CONSULTATION_PACKAGES).nullable().catch(null),
  consent: z.literal(true, 'consent'),
});

const FIELD_ORDER: readonly ConsultationField[] = ['name', 'dob', 'email', 'phone', 'destination', 'consent'];

function isField(key: PropertyKey | undefined): key is ConsultationField {
  return typeof key === 'string' && (FIELD_ORDER as readonly string[]).includes(key);
}

function isErrorCode(value: string): value is ConsultationErrorCode {
  return ['required', 'email', 'dob', 'phone', 'consent'].includes(value);
}

export type ConsultationValidation =
  | { readonly ok: true; readonly request: ConsultationRequest }
  | { readonly ok: false; readonly errors: ConsultationFieldErrors };

export function validateConsultation(
  input: ConsultationInput,
  now: Date = new Date(),
): ConsultationValidation {
  const parsed = requestSchema.safeParse({
    ...input,
    budget: input.budget === '' ? null : input.budget,
    package: input.package === '' ? null : input.package,
  });

  const errors: ConsultationFieldErrors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      // First problem per field wins — "required" before "bad format".
      if (!isField(field) || errors[field] !== undefined) continue;
      errors[field] = isErrorCode(issue.message) ? issue.message : 'required';
    }
  }

  const dateOfBirth = parseDateOfBirth(input.dob, now);
  if (errors.dob === undefined && dateOfBirth === null) errors.dob = 'dob';

  if (!parsed.success || dateOfBirth === null || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const data = parsed.data;
  return {
    ok: true,
    request: {
      name: data.name,
      dateOfBirth,
      email: data.email.toLowerCase(),
      dialCode: data.dialCode,
      phone: data.phone,
      destination: data.destination,
      budget: data.budget,
      package: data.package,
    },
  };
}

/** The field to move focus to after a failed submit: the first one on screen. */
export function firstInvalidField(errors: ConsultationFieldErrors): ConsultationField | null {
  return FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}

export function dialCodeFor(value: ConsultationDialCode): string {
  return CONSULTATION_DIAL_CODES.find((entry) => entry.value === value)?.code ?? '';
}

/**
 * The one line written to `waitlist_signups.notes` for destination, budget and
 * package — duplicated into their own columns once the follow-up migration has
 * run (see this file's header). English labels on purpose: this is read by the
 * sales team in the dashboard, not by the student.
 */
export function consultationNotes(request: ConsultationRequest): string {
  const packageName =
    CONSULTATION_PACKAGE_OPTIONS.find((option) => option.id === request.package)?.name ?? 'Not chosen';
  const budget = request.budget === null ? 'Not given' : CONSULTATION_BUDGET_LABELS[request.budget];
  return [
    `Destination: ${request.destination}`,
    `Budget: ${budget}`,
    `Package: ${packageName}`,
    'Source: Home consultation form',
  ].join(' · ');
}
