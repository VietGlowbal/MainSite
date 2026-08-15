import type { StudentProfile } from '@/lib/types';
import { rankUniversityMatches, type UniversityMatchingCandidate } from './university-matching';

const demoProfile: StudentProfile = {
  study_level: 'postgraduate',
  target_subjects: ['Technology'],
  preferred_countries: ['Canada'],
  budget_range: '$25k / year',
  campus_preferences: 'Big city',
  support_needs: 'Parents / family alignment',
};

const demoUniversities: UniversityMatchingCandidate[] = [
  {
    id: 9101,
    name: 'Northstar Institute of Technology',
    country: 'Canada',
    strengths: 'Computer Science, Artificial Intelligence, Robotics',
    best_for: 'Postgraduate technology students',
    tuition_usd: '$20,000',
    living_cost_usd: '$10,000',
    international_environment: 'Big city campus with an international community',
    scholarship: 'Merit scholarships available',
  },
  {
    id: 9102,
    name: 'Cedar Business University',
    country: 'Canada',
    strengths: 'Business, Management, Economics',
    best_for: 'Postgraduate study',
    tuition_usd: '$15,000',
    living_cost_usd: '$10,000',
    international_environment: 'Suburban campus',
    scholarship: 'Limited funding information',
  },
  {
    id: 9103,
    name: 'Westbridge Arts University',
    country: 'United Kingdom',
    strengths: 'Arts, Design, Media Studies',
    best_for: 'Creative undergraduate study',
    tuition_usd: '$50,000',
    living_cost_usd: '$20,000',
    international_environment: 'Historic campus town',
    scholarship: 'Limited funding information',
  },
];

/** Fixed public fixture for demonstrating university-only deterministic tiers. */
export function demoUniversityMatches() {
  return rankUniversityMatches(demoProfile, demoUniversities);
}
