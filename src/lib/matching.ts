import type { StudentProfile, University } from './types';

/**
 * Compute a 0–100 match score between a student profile and a university.
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
  let score = 0;

  // ── Country match (25 pts) ──
  const preferredCountries = (profile.preferred_countries ?? []).map((c) => c.toLowerCase());
  if (preferredCountries.length > 0) {
    const uniCountry = (university.country ?? '').toLowerCase();
    if (preferredCountries.includes(uniCountry)) {
      score += 25;
    } else {
      // Partial credit if same region
      const regionMap: Record<string, string[]> = {
        'north america': ['united states', 'canada'],
        'uk & ireland': ['united kingdom', 'ireland'],
        europe: ['netherlands', 'germany', 'france', 'sweden', 'switzerland', 'spain', 'italy'],
        'asia-pacific': ['singapore', 'australia', 'new zealand', 'japan', 'south korea', 'hong kong'],
        'middle east': ['united arab emirates', 'qatar'],
      };
      const userRegions = new Set<string>();
      for (const [region, countries] of Object.entries(regionMap)) {
        if (preferredCountries.some((c) => countries.includes(c))) {
          userRegions.add(region);
        }
      }
      for (const [, countries] of Object.entries(regionMap)) {
        if (countries.includes(uniCountry)) {
          // Check if user wants any country in this region
          if (preferredCountries.some((c) => countries.includes(c))) {
            score += 15; // same region but different country
          }
          break;
        }
      }
    }
  } else {
    score += 12; // no preference = neutral
  }

  // ── Subject match (25 pts) ──
  const targetSubjects = (profile.target_subjects ?? []).map((s) => s.toLowerCase());
  if (targetSubjects.length > 0) {
    const strengths = (university.strengths ?? '').toLowerCase();
    const bestFor = (university.best_for ?? '').toLowerCase();
    const combined = `${strengths} ${bestFor}`;

    let subjectHits = 0;
    for (const subject of targetSubjects) {
      // Check for partial matches (e.g., "computer science" matches "cs")
      const keywords = subject.split(' ');
      if (keywords.some((kw) => kw.length > 2 && combined.includes(kw))) {
        subjectHits++;
      }
    }
    const ratio = Math.min(subjectHits / Math.max(targetSubjects.length, 1), 1);
    score += Math.round(ratio * 25);
  } else {
    score += 12;
  }

  // ── Budget match (20 pts) ──
  const budgetRange = profile.budget_range ?? '';
  const tuitionStr = (university.tuition_usd ?? '').replace(/[^0-9.]/g, '');
  const livingStr = (university.living_cost_usd ?? '').replace(/[^0-9.]/g, '');
  const tuition = parseFloat(tuitionStr) || 0;
  const living = parseFloat(livingStr) || 0;
  const totalCost = tuition + living;

  if (budgetRange && totalCost > 0) {
    let maxBudget = 100000; // default high
    if (budgetRange.includes('15k')) maxBudget = 15000;
    else if (budgetRange.includes('25k')) maxBudget = 25000;
    else if (budgetRange.includes('50k') && !budgetRange.includes('+')) maxBudget = 50000;
    else if (budgetRange.includes('50k+')) maxBudget = 150000;

    if (totalCost <= maxBudget) {
      score += 20;
    } else if (totalCost <= maxBudget * 1.3) {
      score += 10; // slightly over budget
    } else {
      score += 3; // way over budget
    }
  } else {
    score += 10;
  }

  // ── Study level (15 pts) ──
  // We check if the university's best_for or notes mention the study level
  const studyLevel = (profile.study_level ?? '').toLowerCase();
  if (studyLevel) {
    const uniText = `${university.best_for ?? ''} ${university.notes ?? ''} ${university.strengths ?? ''}`.toLowerCase();
    if (studyLevel === 'undergraduate' && (uniText.includes('undergrad') || uniText.includes('ug') || uniText.includes('bachelor'))) {
      score += 15;
    } else if (studyLevel === 'postgraduate' && (uniText.includes('postgrad') || uniText.includes('master') || uniText.includes('mba') || uniText.includes('pg'))) {
      score += 15;
    } else if (studyLevel === 'phd' && (uniText.includes('phd') || uniText.includes('research') || uniText.includes('doctoral'))) {
      score += 15;
    } else {
      score += 8; // university likely offers all levels
    }
  } else {
    score += 8;
  }

  // ── Campus vibe (10 pts) ──
  const campusPref = (profile.campus_preferences ?? '').toLowerCase();
  if (campusPref && campusPref !== 'flexible') {
    const uniEnv = `${university.housing ?? ''} ${university.international_environment ?? ''} ${university.specific_insight ?? ''}`.toLowerCase();
    if (campusPref.includes('city') && (uniEnv.includes('city') || uniEnv.includes('urban') || uniEnv.includes('metropolitan'))) {
      score += 10;
    } else if (campusPref.includes('campus') && (uniEnv.includes('campus') || uniEnv.includes('college town'))) {
      score += 10;
    } else if (campusPref.includes('quiet') && (uniEnv.includes('quiet') || uniEnv.includes('rural') || uniEnv.includes('green'))) {
      score += 10;
    } else {
      score += 5;
    }
  } else {
    score += 7; // flexible = mostly matches
  }

  // ── Support alignment (5 pts) ──
  const supportNeeds = (profile.support_needs ?? '').toLowerCase();
  if (supportNeeds) {
    const scholarship = (university.scholarship ?? '').toLowerCase();
    if (supportNeeds.includes('scholarship') && scholarship && scholarship !== 'none') {
      score += 5;
    } else if (supportNeeds.includes('budget') && totalCost < 30000) {
      score += 5;
    } else {
      score += 2;
    }
  } else {
    score += 3;
  }

  return Math.min(Math.max(Math.round(score), 0), 100);
}
