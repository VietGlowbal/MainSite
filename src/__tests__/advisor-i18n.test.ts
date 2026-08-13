import { describe, expect, it } from 'vitest';
import { translations } from '@/lib/i18n-dictionary';

const ADVISOR_UI_KEYS = [
  'University not listed',
  'Subject not listed',
  '{price}/hour',
  'Class of {year}',
  "Open the profile to see this advisor's experience and support topics.",
  'Session rate',
  "View {name}'s profile",
  '{count} advisor',
  '{count} advisors',
  '{count} session',
  '{count} sessions',
  'Compare university, academic background, experience and rate.',
  'No advisors have been approved yet. Check back soon.',
  'No advisor matches those filters yet. Try widening the country or subject.',
  '{count} session delivered',
  '{count} sessions delivered',
  '{count} review',
  '{count} reviews',
  'Glowbal student',
  '{date} — no times available',
  'Choose or type a topic so your advisor can prepare.',
  'Tell your advisor what you want to discuss — a sentence is enough.',
  'Book a session with {name}',
  'Book {name}',
  '{count} min',
  'Session ({count} min)',
  'Pay {amount}',
] as const;

const SEEDED_PROFILE_KEYS = [
  'Computer Science, BA',
  'MSc Computer Science',
  'Economics, AB',
  'PhD Aeronautical Engineering',
  'MS Symbolic Systems',
  'Business Administration',
  'BA Architecture',
  'PhD Electrical Engineering',
  'Cambridge CS undergrad. I help applicants demystify the SAQ, technical interviews, and the personal statement. Happy to chat in English or Vietnamese.',
  "Oxford MSc CS, now working in fintech. I review SOPs line-by-line and run mock technical interviews. I'll also tell you honestly when a school isn't worth it.",
  'Harvard ’25, majoring in Economics with a minor in Statistics. I love helping students with the Common App essays — yes, all 650 words of them.',
  'PhD candidate at Imperial. I help applicants for engineering and physics programmes navigate research statements and interview panels.',
  'Stanford alum now at a YC-backed AI startup. I focus on Stanford-specific essays, internship prep, and breaking into Bay Area tech.',
  'VNU Hanoi business student. I work mostly with applicants targeting top Vietnamese universities and exchange programmes — affordable rates in VND.',
  'UCL Architecture grad. Portfolio reviews, design-school interviews, and how to actually survive crit week as a first-year.',
  'MIT EECS PhD. I help applicants for top US engineering programmes nail their statement of purpose and prepare for grilling interviews.',
] as const;

describe('advisor Vietnamese translation coverage', () => {
  it('covers directory, profile and booking interface copy', () => {
    for (const key of ADVISOR_UI_KEYS) {
      expect(translations[key], key).toBeTruthy();
      expect(translations[key], key).not.toBe(key);
    }
  });

  it('covers all seeded advisor academic labels and biographies', () => {
    for (const key of SEEDED_PROFILE_KEYS) {
      expect(translations[key], key).toBeTruthy();
      expect(translations[key], key).not.toBe(key);
    }
  });

  it('preserves interpolation variables in translated advisor copy', () => {
    for (const key of ADVISOR_UI_KEYS.filter((value) => value.includes('{'))) {
      const sourceVars = key.match(/\{\w+\}/g) ?? [];
      const translatedVars = translations[key]?.match(/\{\w+\}/g) ?? [];
      expect(translatedVars, key).toEqual(sourceVars);
    }
  });
});
