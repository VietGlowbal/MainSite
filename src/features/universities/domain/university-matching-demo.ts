import type { StudentProfile } from '@/lib/types';
import {
  rankUniversityRecommendations,
  type RecommendationProgramme,
  type RecommendationUniversity,
} from './university-recommendation';

const demoProfile: StudentProfile = {
  study_level: 'postgraduate',
  target_subjects: ['Technology'],
  preferred_countries: ['Canada'],
  budget_range: '$25k / year',
  campus_preferences: 'Big city',
  support_needs: 'Parents / family alignment',
};

const demoUniversities: RecommendationUniversity[] = [
  {
    id: 9101,
    name: 'Northstar Institute of Technology',
    country: 'Canada',
    strengths: 'Computer Science, Artificial Intelligence, Robotics',
    best_for: 'Postgraduate technology students',
    tuition_usd: '$20,000',
    international_environment: 'Big city campus with an international community',
  },
  {
    id: 9102,
    name: 'Cedar Business University',
    country: 'Canada',
    strengths: 'Business, Management, Economics',
    best_for: 'Postgraduate study',
    tuition_usd: '$15,000',
    international_environment: 'Suburban campus',
  },
  {
    id: 9103,
    name: 'Westbridge Arts University',
    country: 'United Kingdom',
    strengths: 'Arts, Design, Media Studies',
    best_for: 'Creative undergraduate study',
    tuition_usd: '$50,000',
    international_environment: 'Historic campus town',
  },
];

const demoProgrammes: RecommendationProgramme[] = [
  {
    id: 'demo-northstar-cs',
    universityId: 9101,
    name: 'MSc Computer Science',
    degreeLevel: 'master',
    normalizedSubject: 'Computer Science',
    officialUrl: 'https://example.com/northstar/computer-science',
    verificationStatus: 'RULE_VALIDATED',
    retrievedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'demo-northstar-ai',
    universityId: 9101,
    name: 'MSc Artificial Intelligence',
    degreeLevel: 'master',
    normalizedSubject: 'Artificial Intelligence',
    officialUrl: 'https://example.com/northstar/artificial-intelligence',
    verificationStatus: 'NEEDS_REVIEW',
    retrievedAt: '2026-08-01T00:00:00.000Z',
  },
];

/** Fixed public fixture for demonstrating deterministic recommendations. */
export function demoUniversityMatches() {
  const programmes = new Map<number, RecommendationProgramme[]>();
  for (const programme of demoProgrammes) {
    const current = programmes.get(programme.universityId) ?? [];
    current.push(programme);
    programmes.set(programme.universityId, current);
  }
  return rankUniversityRecommendations(demoProfile, demoUniversities, programmes, {
    asOf: '2026-08-18T00:00:00.000Z',
  });
}
