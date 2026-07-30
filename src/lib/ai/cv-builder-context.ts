import type { User } from '@supabase/supabase-js';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { createClient } from '@/lib/supabase/server';
import type { CvBuilderFormV1 } from './cv-builder';

type JsonRecord = Record<string, unknown> | null;

type ContextInput = {
  user: { id: string; email: string; name: string };
  application: {
    id: string;
    universityName: string;
    programmeName: string;
    universityId?: number;
    courseId?: string;
    courseUrl?: string;
    degreeLevel?: string;
    subject?: string;
  };
  university: JsonRecord;
  course: JsonRecord;
  profile: JsonRecord;
  workExperiences: JsonRecord[];
};

export type CvBuilderSourceEntry = { ref: string; value: string };

export type CvBuilderContextData = {
  userId: string;
  applicationId: string;
  universityName: string;
  programmeName: string;
  sourceEntries: CvBuilderSourceEntry[];
  validSourceRefs: Set<string>;
  confidence: 'high' | 'medium' | 'low';
  limitations: string[];
  prefill: CvBuilderFormV1;
};

const SOURCE_FIELDS = {
  university: [
    'name',
    'country',
    'type',
    'qs_rank',
    'the_rank',
    'national_rank',
    'strengths',
    'specific_insight',
    'teaching_style',
    'international_environment',
    'industry_connections',
    'employability',
    'best_for',
    'admission_difficulty',
    'accept_rate',
    'notes',
  ],
  course: [
    'course_name',
    'course_url',
    'subject',
    'degree_level',
    'study_mode',
    'duration',
    'intake',
    'entry_requirements_summary',
    'english_requirements_summary',
    'application_method',
    'search_keywords',
    'university_metadata',
    'entry_requirements',
  ],
  profile: [
    'goals',
    'career_interests',
    'skills',
    'achievements',
    'academic_background',
    'profile_summary',
    'bio',
  ],
} as const;

function text(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (value && typeof value === 'object' && Object.keys(value).length) {
    return JSON.stringify(value);
  }
  return '';
}

function sources(namespace: keyof typeof SOURCE_FIELDS, value: JsonRecord) {
  if (!value) return [];
  return SOURCE_FIELDS[namespace].flatMap((field) => {
    const content = text(value[field]);
    return content ? [{ ref: `${namespace}:${field}`, value: content }] : [];
  });
}

function array(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item.trim())
    : [];
}

function hasProgrammeDepth(course: JsonRecord) {
  const metadata = text(course?.university_metadata);
  return /module|curriculum|learning.outcome|objective/i.test(metadata);
}

export function buildCvBuilderContextData(input: ContextInput): CvBuilderContextData {
  const sourceEntries = [
    ...sources('university', input.university),
    ...sources('course', input.course),
    ...sources('profile', input.profile),
  ];
  const courseSourceCount = sourceEntries.filter(({ ref }) => ref.startsWith('course:')).length;
  const courseStatus = text(input.course?.extraction_status).toLowerCase();
  const courseReviewed = !courseStatus || courseStatus === 'extracted';
  const hasCourseRecord = Boolean(text(input.course?.id));
  const confidence = courseReviewed && hasProgrammeDepth(input.course)
    ? 'high'
    : courseReviewed && hasCourseRecord && courseSourceCount >= 2
      ? 'medium'
      : 'low';
  const limitations = [
    ...(hasProgrammeDepth(input.course)
      ? []
      : ['Core module and learning-outcome data is unavailable in Supabase.']),
    ...(courseSourceCount
      ? []
      : ['Programme-specific data is limited to the application name and subject.']),
    ...(courseStatus === 'needs_review'
      ? ['The programme record is awaiting review; only explicit fields are used.']
      : []),
  ];
  const profile = input.profile ?? {};
  const education =
    text(profile.current_institution) && text(profile.current_qualification)
      ? [
          {
            id: 'education-1',
            institution: text(profile.current_institution),
            qualification: text(profile.current_qualification),
            ...(text(profile.target_subjects)
              ? { fieldOfStudy: text(profile.target_subjects) }
              : {}),
            ...(text(profile.graduation_year)
              ? { endDate: text(profile.graduation_year) }
              : {}),
            ...(text(profile.location) ? { location: text(profile.location) } : {}),
            details: [text(profile.academic_background), text(profile.predicted_grades)].filter(
              Boolean,
            ),
          },
        ]
      : [];
  const entries = input.workExperiences
    .filter((work): work is Record<string, unknown> => Boolean(work))
    .map((work, index) => ({
    id: text(work.id) || `work-${index + 1}`,
    category: 'experience' as const,
    title: text(work.role) || 'Experience',
    ...(text(work.company) ? { organization: text(work.company) } : {}),
    ...(text(work.start_date) ? { startDate: text(work.start_date) } : {}),
    ...(work.is_current
      ? { endDate: 'Present' }
      : text(work.end_date)
        ? { endDate: text(work.end_date) }
        : {}),
    contributions: [
      {
        id: `K${String(index + 1).padStart(3, '0')}`,
        framework: /lead|manager|mentor/i.test(text(work.role))
          ? ('led' as const)
          : ('improved' as const),
        text:
          text(work.description) ||
          `${text(work.role) || 'Contributed'} at ${text(work.company) || 'the organization'}.`,
      },
    ],
    }));
  const achievements = array(profile.achievements);
  const skills = array(profile.skills);

  return {
    userId: input.user.id,
    applicationId: input.application.id,
    universityName: input.application.universityName,
    programmeName: input.application.programmeName,
    sourceEntries,
    validSourceRefs: new Set(sourceEntries.map(({ ref }) => ref)),
    confidence,
    limitations,
    prefill: {
      personal: {
        fullName: input.user.name,
        email: input.user.email,
        ...(text(profile.phone) ? { phone: text(profile.phone) } : {}),
        ...(text(profile.location) ? { location: text(profile.location) } : {}),
        links: [],
      },
      education,
      entries,
      awards: achievements.map((title, index) => ({
        id: `award-${index + 1}`,
        title,
      })),
      skillGroups: skills.length
        ? [{ id: 'skills-1', label: 'Core skills', skills: skills.slice(0, 12) }]
        : [],
    },
  };
}

export function isCvBuilderEnabled() {
  return process.env.CV_BUILDER_MVP_ENABLED === 'true' || process.env.NODE_ENV === 'development';
}

export async function loadCvBuilderContext(
  applicationId: string,
  user: User,
): Promise<CvBuilderContextData | null> {
  const workspace = await fetchApplicationWorkspace(applicationId, user.id);
  if (!workspace) return null;
  const supabase = await createClient();
  const { application } = workspace;

  const profilePromise = supabase
    .from('student_profiles')
    .select(
      'phone,location,current_institution,current_qualification,target_subjects,graduation_year,academic_background,predicted_grades,goals,career_interests,achievements,skills,profile_summary,bio',
    )
    .eq('user_id', user.id)
    .maybeSingle();
  const workExperiencesPromise = supabase
    .from('work_experiences')
    .select('id,company,role,start_date,end_date,is_current,description')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false });
  const courseSelect =
    'id,university_id,university_name,course_name,course_url,subject,degree_level,study_mode,duration,intake,entry_requirements_summary,english_requirements_summary,application_method,search_keywords,university_metadata,entry_requirements,source_confidence,extraction_status';

  let course: JsonRecord = null;
  if (application.courseId) {
    const { data } = await supabase
      .from('courses')
      .select(courseSelect)
      .eq('id', application.courseId)
      .maybeSingle();
    course = data;
  }
  if (!course && application.courseUrl) {
    const { data } = await supabase
      .from('courses')
      .select(courseSelect)
      .eq('course_url', application.courseUrl)
      .maybeSingle();
    course = data;
  }
  if (!course) {
    let query = supabase
      .from('courses')
      .select(courseSelect)
      .order('source_confidence', { ascending: false })
      .limit(100);
    query = application.universityId
      ? query.eq('university_id', application.universityId)
      : query.ilike('university_name', application.universityName);
    const { data: candidates } = await query;
    const normalizedName = text(application.courseName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    course =
      candidates?.find(
        (candidate) =>
          text(candidate.course_name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ===
          normalizedName,
      ) ?? null;
  }

  const universitySelect =
    'id,name,country,type,qs_rank,the_rank,national_rank,strengths,specific_insight,teaching_style,international_environment,industry_connections,employability,best_for,admission_difficulty,accept_rate,notes,primary_domain,official_url';
  const universityId =
    application.universityId ??
    (typeof course?.university_id === 'number' ? course.university_id : undefined);
  const { data: initialUniversity } = universityId
    ? await supabase
        .from('universities')
        .select(universitySelect)
        .eq('id', universityId)
        .maybeSingle()
    : await supabase
        .from('universities')
        .select(universitySelect)
        .ilike('name', application.universityName)
        .limit(1)
        .maybeSingle();
  let university: JsonRecord = initialUniversity;
  if (initialUniversity?.primary_domain) {
    const { data: sameDomain } = await supabase
      .from('universities')
      .select(universitySelect)
      .eq('primary_domain', initialUniversity.primary_domain);
    university =
      sameDomain?.sort(
        (a, b) =>
          sources('university', b).length - sources('university', a).length,
      )[0] ?? initialUniversity;
  }
  const [{ data: profile }, { data: workExperiences }] = await Promise.all([
    profilePromise,
    workExperiencesPromise,
  ]);

  const metadata = user.user_metadata ?? {};
  const email = user.email ?? '';
  const name =
    text(metadata.full_name) || text(metadata.name) || email.split('@')[0] || 'Applicant';

  return buildCvBuilderContextData({
    user: { id: user.id, email, name },
    application: {
      id: application.id,
      universityName: application.universityName,
      programmeName: application.courseName,
      ...(application.universityId ? { universityId: application.universityId } : {}),
      ...(application.courseId ? { courseId: application.courseId } : {}),
      ...(application.courseUrl ? { courseUrl: application.courseUrl } : {}),
      ...(application.degreeLevel ? { degreeLevel: application.degreeLevel } : {}),
      ...(application.subject ? { subject: application.subject } : {}),
    },
    university: university ?? null,
    course:
      course ??
      {
        course_name: application.courseName,
        course_url: application.courseUrl,
        subject: application.subject,
        degree_level: application.degreeLevel,
      },
    profile: profile ?? null,
    workExperiences: (workExperiences ?? []) as JsonRecord[],
  });
}
