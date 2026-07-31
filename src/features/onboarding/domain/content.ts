import {
  ONBOARDING_FLOW_ID,
  ONBOARDING_FLOW_VERSION,
  type OnboardingFlowStep,
} from './types';

export const ONBOARDING_FLOW_STEPS: readonly OnboardingFlowStep[] = [
  {
    id: 'preferred_countries',
    number: 1,
    title: 'Which countries are you interested in?',
    body: 'Choose one or more destinations you would like GLOWBAL to consider.',
  },
  {
    id: 'current_education',
    number: 2,
    title: 'What is your highest level of education?',
    body: 'Tell us where you are academically and add your average grade.',
  },
  {
    id: 'target_majors',
    number: 3,
    title: 'Select a Major',
    body: 'Choose the subjects you are considering. You can add another major below.',
  },
  {
    id: 'intended_level',
    number: 4,
    title: 'What is your intended level of study?',
    body: 'Choose the qualification you are planning to pursue.',
  },
  {
    id: 'nationality',
    number: 5,
    title: 'What is your nationality?',
    body: 'This helps us apply the right country and admissions context.',
  },
  {
    id: 'academic_grades',
    number: 6,
    title: 'School Grades',
    body: 'Choose your grading system and enter your current result.',
  },
  {
    id: 'test_scores',
    number: 7,
    title: 'School Grades & Test Scores',
    body: 'Add any English, admissions or language test scores you already have.',
  },
  {
    id: 'academic_awards',
    number: 8,
    title: 'Do you have academic awards?',
    body: 'Add awards, roles and achievements that strengthen your application.',
  },
  {
    id: 'budget',
    number: 9,
    title: 'What budget feels realistic?',
    body: 'Choose the annual budget range that feels comfortable for your study plans.',
  },
];

export const ONBOARDING_FLOW = {
  id: ONBOARDING_FLOW_ID,
  version: ONBOARDING_FLOW_VERSION,
  steps: ONBOARDING_FLOW_STEPS,
} as const;

export const COUNTRY_OPTIONS = ['Canada', 'UK', 'USA', 'Australia', 'Germany', 'Japan'];

export const CURRENT_EDUCATION_OPTIONS = [
  'Secondary / High school',
  'Foundation',
  'College Diploma / Certificate',
  'Associate Degree',
  "Bachelor's Degree",
  "Master's Degree",
  'Doctorate / PhD',
  'Other',
];

export const MAJOR_OPTIONS = ['Engineering', 'Design', 'Product', 'Marketing', 'Sales'];

export const INTENDED_LEVEL_OPTIONS = [
  'Master or Post-Graduate Certificate',
  "Bachelor's Degree",
  'College Diploma / Certificate',
];

export const GRADING_SYSTEM_OPTIONS = [
  '10-point scale (Vietnamese National Curriculum / Dual Degree)',
  '4.0 GPA scale (US Curriculum / International GPA)',
  '7-point scale (International Baccalaureate - IB)',
  'Letter grading system (A-level / British Curriculum)',
  'Other',
];

export const TEST_SCORE_OPTIONS = [
  'IELTS (9.0)',
  'TOEFL iBT (120)',
  'TOEIC (1390)',
  'SAT (1600)',
  'ACT (36)',
  'HSK (Chinese) (300)',
  'TOPIK (Korean)',
  'Other',
];

export const BUDGET_OPTIONS = ['Under $15k', 'Up to $25k', 'Up to $50k', '$50k+'];

export const AWARD_LEVEL_OPTIONS = [
  'International level',
  'Regional level',
  'National level',
  'Provincial level',
  'School level',
  'Club level',
  'Personal level',
];

export const AWARD_ROLE_OPTIONS = [
  'Founder / Co-Founder',
  'President / Vice President',
  'Head of Department / Team Leader',
  'Volunteer',
  'Participant / Attendee',
  'Champion / Grand Prize',
  'Gold Medal / 1st Prize',
  'Silver Medal / 2nd Prize',
];
