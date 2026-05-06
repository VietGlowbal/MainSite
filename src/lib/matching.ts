import type { StudentProfile, University } from './types';

// ── Match breakdown types ──────────────────────────────────────────────

export interface MatchBreakdownItem {
  score: number;
  max: number;
  reason: string;
}

export interface MatchBreakdown {
  country: MatchBreakdownItem;
  subjects: MatchBreakdownItem;
  budget: MatchBreakdownItem;
  level: MatchBreakdownItem;
  environment: MatchBreakdownItem;
  support: MatchBreakdownItem;
}

export interface MatchResult {
  percentage: number;
  breakdown: MatchBreakdown | null;
}

/**
 * Compute a 0–100 match score between a student profile and a university.
 * Returns both the percentage and a detailed breakdown for tooltip display.
 *
 * Weights:
 *   Country match:  25%
 *   Subject match:  25%
 *   Budget match:   20%
 *   Study level:    15%
 *   Campus vibe:    10%
 *   Support needs:   5%
 */
export function computeMatchScore(profile: StudentProfile, university: University): number {
  return computeMatchResult(profile, university).percentage;
}

export function computeMatchResult(profile: StudentProfile, university: University): MatchResult {
  let score = 0;
  const breakdown: MatchBreakdown = {} as MatchBreakdown;

  // ── Country match (25 pts) ──
  const countryMax = 25;
  let countryScore = 0;
  let countryReason = '';
  const preferredCountries = (profile.preferred_countries ?? []).map((c) => c.toLowerCase());
  if (preferredCountries.length > 0) {
    const uniCountry = (university.country ?? '').toLowerCase();
    if (preferredCountries.includes(uniCountry)) {
      countryScore = 25;
      countryReason = `${university.country} is in your preferred countries`;
    } else {
      // Partial credit if same region
      const regionMap: Record<string, string[]> = {
        'north america': ['united states', 'canada'],
        'uk & ireland': ['united kingdom', 'ireland'],
        europe: ['netherlands', 'germany', 'france', 'sweden', 'switzerland', 'spain', 'italy'],
        'asia-pacific': ['singapore', 'australia', 'new zealand', 'japan', 'south korea', 'hong kong'],
        'middle east': ['united arab emirates', 'qatar'],
      };
      let regionMatch = false;
      for (const [, countries] of Object.entries(regionMap)) {
        if (countries.includes(uniCountry)) {
          if (preferredCountries.some((c) => countries.includes(c))) {
            countryScore = 15;
            countryReason = `${university.country} is in a preferred region`;
            regionMatch = true;
          }
          break;
        }
      }
      if (!regionMatch) {
        countryReason = `${university.country} is not in your preferred countries`;
      }
    }
  } else {
    countryScore = 12;
    countryReason = 'No country preference set — partial credit';
  }
  breakdown.country = { score: countryScore, max: countryMax, reason: countryReason };
  score += countryScore;

  // ── Subject match (25 pts) ──
  const subjectMax = 25;
  let subjectScore = 0;
  let subjectReason = '';
  const targetSubjects = (profile.target_subjects ?? []).map((s) => s.toLowerCase());
  if (targetSubjects.length > 0) {
    const strengths = (university.strengths ?? '').toLowerCase();
    const bestFor = (university.best_for ?? '').toLowerCase();
    const combined = `${strengths} ${bestFor}`;

    const matchedSubjects: string[] = [];
    for (const subject of targetSubjects) {
      const keywords = subject.split(' ');
      if (keywords.some((kw) => kw.length > 2 && combined.includes(kw))) {
        matchedSubjects.push(subject);
      }
    }
    const ratio = Math.min(matchedSubjects.length / Math.max(targetSubjects.length, 1), 1);
    subjectScore = Math.round(ratio * 25);
    subjectReason = matchedSubjects.length > 0
      ? `Matches: ${matchedSubjects.slice(0, 3).join(', ')}${matchedSubjects.length > 3 ? ` +${matchedSubjects.length - 3} more` : ''}`
      : 'None of your target subjects matched';
  } else {
    subjectScore = 12;
    subjectReason = 'No subject preference set — partial credit';
  }
  breakdown.subjects = { score: subjectScore, max: subjectMax, reason: subjectReason };
  score += subjectScore;

  // ── Budget match (20 pts) ──
  const budgetMax = 20;
  let budgetScore = 0;
  let budgetReason = '';
  const budgetRange = profile.budget_range ?? '';
  const tuitionStr = (university.tuition_usd ?? '').replace(/[^0-9.]/g, '');
  const livingStr = (university.living_cost_usd ?? '').replace(/[^0-9.]/g, '');
  const tuition = parseFloat(tuitionStr) || 0;
  const living = parseFloat(livingStr) || 0;
  const totalCost = tuition + living;

  if (budgetRange && totalCost > 0) {
    let maxBudget = 100000;
    if (budgetRange.includes('15k')) maxBudget = 15000;
    else if (budgetRange.includes('25k')) maxBudget = 25000;
    else if (budgetRange.includes('50k') && !budgetRange.includes('+')) maxBudget = 50000;
    else if (budgetRange.includes('50k+')) maxBudget = 150000;

    if (totalCost <= maxBudget) {
      budgetScore = 20;
      budgetReason = `Within your ${budgetRange} budget`;
    } else if (totalCost <= maxBudget * 1.3) {
      budgetScore = 10;
      budgetReason = 'Slightly over budget — within 30%';
    } else {
      budgetScore = 3;
      budgetReason = 'Exceeds your budget significantly';
    }
  } else {
    budgetScore = 10;
    budgetReason = totalCost === 0 ? 'Cost data unavailable — partial credit' : 'No budget preference set';
  }
  breakdown.budget = { score: budgetScore, max: budgetMax, reason: budgetReason };
  score += budgetScore;

  // ── Study level (15 pts) ──
  const levelMax = 15;
  let levelScore = 0;
  let levelReason = '';
  const studyLevel = (profile.study_level ?? '').toLowerCase();
  if (studyLevel) {
    const uniText = `${university.best_for ?? ''} ${university.notes ?? ''} ${university.strengths ?? ''}`.toLowerCase();
    if (studyLevel === 'undergraduate' && (uniText.includes('undergrad') || uniText.includes('ug') || uniText.includes('bachelor'))) {
      levelScore = 15;
      levelReason = 'Offers undergraduate programmes';
    } else if (studyLevel === 'postgraduate' && (uniText.includes('postgrad') || uniText.includes('master') || uniText.includes('mba') || uniText.includes('pg'))) {
      levelScore = 15;
      levelReason = 'Offers postgraduate programmes';
    } else if (studyLevel === 'phd' && (uniText.includes('phd') || uniText.includes('research') || uniText.includes('doctoral'))) {
      levelScore = 15;
      levelReason = 'Offers PhD/research programmes';
    } else {
      levelScore = 8;
      levelReason = 'Likely offers all levels — partial credit';
    }
  } else {
    levelScore = 8;
    levelReason = 'No study level preference set';
  }
  breakdown.level = { score: levelScore, max: levelMax, reason: levelReason };
  score += levelScore;

  // ── Campus vibe (10 pts) ──
  const envMax = 10;
  let envScore = 0;
  let envReason = '';
  const campusPref = (profile.campus_preferences ?? '').toLowerCase();
  if (campusPref && campusPref !== 'flexible') {
    const uniEnv = `${university.housing ?? ''} ${university.international_environment ?? ''} ${university.specific_insight ?? ''}`.toLowerCase();
    if (campusPref.includes('city') && (uniEnv.includes('city') || uniEnv.includes('urban') || uniEnv.includes('metropolitan'))) {
      envScore = 10;
      envReason = 'Matches your city environment preference';
    } else if (campusPref.includes('campus') && (uniEnv.includes('campus') || uniEnv.includes('college town'))) {
      envScore = 10;
      envReason = 'Matches your campus environment preference';
    } else if (campusPref.includes('quiet') && (uniEnv.includes('quiet') || uniEnv.includes('rural') || uniEnv.includes('green'))) {
      envScore = 10;
      envReason = 'Matches your quiet/green preference';
    } else {
      envScore = 5;
      envReason = `Environment doesn't clearly match your preference`;
    }
  } else {
    envScore = 7;
    envReason = campusPref === 'flexible' ? 'Flexible — all environments match' : 'No environment preference set';
  }
  breakdown.environment = { score: envScore, max: envMax, reason: envReason };
  score += envScore;

  // ── Support alignment (5 pts) ──
  const supportMax = 5;
  let supportScore = 0;
  let supportReason = '';
  const supportNeedsStr = (profile.support_needs ?? '').toLowerCase();
  if (supportNeedsStr) {
    const scholarship = (university.scholarship ?? '').toLowerCase();
    if (supportNeedsStr.includes('scholarship') && scholarship && scholarship !== 'none') {
      supportScore = 5;
      supportReason = 'Scholarships available';
    } else if (supportNeedsStr.includes('budget') && totalCost < 30000) {
      supportScore = 5;
      supportReason = 'Affordable option matching your needs';
    } else {
      supportScore = 2;
      supportReason = 'Partial support alignment';
    }
  } else {
    supportScore = 3;
    supportReason = 'No specific support needs set';
  }
  breakdown.support = { score: supportScore, max: supportMax, reason: supportReason };
  score += supportScore;

  const percentage = Math.min(Math.max(Math.round(score), 0), 100);
  return { percentage, breakdown };
}
