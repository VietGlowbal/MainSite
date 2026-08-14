/** Central, versioned product heuristics. Scores are admission realism signals, never probabilities. */
export const MATCHING_MODEL_VERSION = 'v1' as const;

export const MATCHING_MODEL_V1 = {
  admission: {
    gpa: 30,
    tests: 15,
    prerequisites: 15,
    selectivity: 15,
    other: 25,
  },
  preference: {
    country: 10,
    programme: 15,
    budget: 10,
    city: 5,
    characteristics: 10,
  },
  tier: {
    strongChanceMin: 75,
    targetMin: 55,
    minCoverage: 0.5,
  },
  ranking: {
    preferenceWeight: 0.6,
    admissionWeight: 0.4,
    neutralAdmission: 60,
    neutralPreference: 50,
  },
} as const;
