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
  achievements?: JsonRecord[];
  activities?: JsonRecord[];
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
  const workEntries = input.workExperiences
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

  const activityEntries = (input.activities ?? [])
    .filter((act): act is Record<string, unknown> => Boolean(act))
    .map((act, index) => {
      const cat = text(act.category);
      const category: 'experience' | 'project' | 'activity' | 'research' | 'volunteering' =
        cat === 'research'
          ? 'research'
          : cat === 'volunteering' || cat === 'community_project'
            ? 'volunteering'
            : cat === 'innovation'
              ? 'project'
              : 'activity';
      return {
        id: text(act.id) || `activity-${index + 1}`,
        category,
        title: text(act.title) || 'Activity',
        ...(text(act.organisation) ? { organization: text(act.organisation) } : {}),
        ...(text(act.period) ? { startDate: text(act.period) } : {}),
        contributions: [
          {
            id: `A${String(index + 1).padStart(3, '0')}`,
            framework: /lead|founder|presid|direct/i.test(text(act.title))
              ? ('led' as const)
              : ('improved' as const),
            text:
              text(act.description) ||
              `${text(act.title) || 'Contributed'} with ${text(act.organisation) || 'the organization'}.`,
          },
        ],
      };
    });

  const entries = [...workEntries, ...activityEntries].slice(0, 20);

  const structuredAwards = (input.achievements ?? [])
    .filter((ach): ach is Record<string, unknown> => Boolean(ach))
    .map((ach, index) => ({
      id: text(ach.id) || `award-${index + 1}`,
      title: text(ach.title) || 'Award',
      ...(text(ach.organisation) || text(ach.competition)
        ? { issuer: text(ach.organisation) || text(ach.competition) }
        : {}),
      ...(text(ach.year) ? { date: text(ach.year) } : {}),
      ...(text(ach.detail) ? { description: text(ach.detail).slice(0, 500) } : {}),
    }));

  // Backward compatibility for historical profile rows or test fixtures
  const legacyAchievements = Array.isArray(profile.achievements)
    ? profile.achievements
        .map((item, index) => {
          if (typeof item === 'string' && item.trim()) {
            return { id: `award-${index + 1}`, title: item.trim() };
          }
          if (item && typeof item === 'object') {
            const row = item as Record<string, unknown>;
            const title = text(row.title);
            if (!title) return null;
            return {
              id: text(row.id) || `award-${index + 1}`,
              title,
              ...(text(row.year) ? { date: text(row.year) } : {}),
              ...(text(row.description) ? { description: text(row.description).slice(0, 500) } : {}),
            };
          }
          return null;
        })
        .filter(
          (a): a is { id: string; title: string; date?: string; description?: string } => Boolean(a),
        )
    : [];

  const awards = (structuredAwards.length > 0 ? structuredAwards : legacyAchievements).slice(0, 12);
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
      awards,
      skillGroups: skills.length
        ? [{ id: 'skills-1', label: 'Core skills', skills: skills.slice(0, 12) }]
        : [],
    },
  };
}

export function isCvBuilderEnabled() {
  return true;
}

export async function loadCvBuilderContext(
  applicationId: string,
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    user_metadata?: Record<string, unknown>;
    userMetadata?: Record<string, unknown>;
  },
): Promise<CvBuilderContextData | null> {
  const supabase = await createClient();
  const applicationPromise = Promise.resolve(
    supabase
      .from('course_applications')
      .select('id,university_id,university_name,course_id,course_name,course_url,degree_level,subject')
      .eq('id', applicationId)
      .eq('user_id', user.id)
      .maybeSingle(),
  );
  const profilePromise = Promise.resolve(
    supabase
      .from('student_profiles')
      .select(
        'phone,location,current_institution,current_qualification,target_subjects,graduation_year,academic_background,predicted_grades,goals,career_interests,skills,profile_summary,bio',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
  );
  const workExperiencesPromise = Promise.resolve(
    supabase
      .from('work_experiences')
      .select('id,company,role,start_date,end_date,is_current,description')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false }),
  );
  const achievementsPromise = Promise.resolve(
    supabase
      .from('student_achievements')
      .select('id,category,title,competition,organisation,level,year,detail')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  );
  const activitiesPromise = Promise.resolve(
    supabase
      .from('student_activities')
      .select('id,category,title,organisation,level,period,description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  );

  const { data: application, error: applicationError } = await applicationPromise;
  if (applicationError || !application) return null;

  const courseSelect =
    'id,university_id,university_name,course_name,course_url,subject,degree_level,study_mode,duration,intake,entry_requirements_summary,english_requirements_summary,application_method,search_keywords,university_metadata,entry_requirements,source_confidence,extraction_status';
  const universitySelect =
    'id,name,country,type,qs_rank,the_rank,national_rank,strengths,specific_insight,teaching_style,international_environment,industry_connections,employability,best_for,admission_difficulty,accept_rate,notes,primary_domain,official_url';
  const initialUniversityPromise = application.university_id
    ? Promise.resolve(
        supabase
          .from('universities')
          .select(universitySelect)
          .eq('id', application.university_id)
          .maybeSingle(),
      )
    : null;

  let course: JsonRecord = null;
  if (application.course_id) {
    const { data } = await supabase
      .from('courses')
      .select(courseSelect)
      .eq('id', application.course_id)
      .maybeSingle();
    course = data;
  }
  if (!course && application.course_url) {
    const { data } = await supabase
      .from('courses')
      .select(courseSelect)
      .eq('course_url', application.course_url)
      .maybeSingle();
    course = data;
  }
  if (!course) {
    let query = supabase
      .from('courses')
      .select(courseSelect)
      .order('source_confidence', { ascending: false })
      .limit(100);
    query = application.university_id
      ? query.eq('university_id', application.university_id)
      : query.ilike('university_name', application.university_name);
    const { data: candidates } = await query;
    const normalizedName = text(application.course_name)
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

  const universityId =
    application.university_id ??
    (typeof course?.university_id === 'number' ? course.university_id : undefined);
  const { data: initialUniversity } = initialUniversityPromise
    ? await initialUniversityPromise
    : universityId
      ? await supabase
          .from('universities')
          .select(universitySelect)
          .eq('id', universityId)
          .maybeSingle()
      : await supabase
          .from('universities')
          .select(universitySelect)
          .ilike('name', application.university_name)
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
  const [
    { data: profile },
    { data: workExperiences },
    { data: achievements },
    { data: activities },
  ] = await Promise.all([
    profilePromise,
    workExperiencesPromise,
    achievementsPromise,
    activitiesPromise,
  ]);

  const metadata = user.userMetadata ?? user.user_metadata ?? {};
  const email = user.email ?? '';
  const name =
    user.name || text(metadata.full_name) || text(metadata.name) || email.split('@')[0] || 'Applicant';

  return buildCvBuilderContextData({
    user: { id: user.id, email, name },
    application: {
      id: application.id,
      universityName: application.university_name,
      programmeName: application.course_name,
      ...(application.university_id ? { universityId: application.university_id } : {}),
      ...(application.course_id ? { courseId: application.course_id } : {}),
      ...(application.course_url ? { courseUrl: application.course_url } : {}),
      ...(application.degree_level ? { degreeLevel: application.degree_level } : {}),
      ...(application.subject ? { subject: application.subject } : {}),
    },
    university: university ?? null,
    course:
      course ??
      {
        course_name: application.course_name,
        course_url: application.course_url,
        subject: application.subject,
        degree_level: application.degree_level,
      },
    profile: profile ?? null,
    workExperiences: (workExperiences ?? []) as JsonRecord[],
    achievements: (achievements ?? []) as JsonRecord[],
    activities: (activities ?? []) as JsonRecord[],
  });
}
