import { describe, expect, it } from 'vitest';
import type { ApplicationStrategyContext } from '@/features/application-strategy/domain';
import { deterministicGaps, mergeMissingInformation, toTargetProfilePatch } from './target-profile';

function context(overrides: Partial<ApplicationStrategyContext> = {}): ApplicationStrategyContext {
  return {
    candidate: { academics: null, achievements: [], activities: [], goals: null, preferences: {} },
    application: {
      universityName: 'Test University',
      courseName: 'Computer Science',
      requirements: null,
      courseSummary: null,
      deadline: null,
      sources: [],
    },
    documents: { cvText: null, structuredCv: null, statementText: null },
    notes: [],
    ...overrides,
  };
}

describe('deterministicGaps', () => {
  it('reports every gap for an empty context', () => {
    const gaps = deterministicGaps(context());
    expect(gaps.length).toBeGreaterThanOrEqual(5);
    expect(gaps.some((g) => g.includes('programme’s own page'))).toBe(true);
    expect(gaps.some((g) => g.includes('academic background'))).toBe(true);
    expect(gaps.some((g) => g.includes('career goal'))).toBe(true);
  });

  it('stops reporting the programme gap once there is programme material', () => {
    const gaps = deterministicGaps(
      context({
        application: { ...context().application, requirements: 'A-level maths at grade A' },
      }),
    );
    expect(gaps.some((g) => g.includes('programme’s own page'))).toBe(false);
  });

  it('reports nothing once every input is present', () => {
    const gaps = deterministicGaps(
      context({
        candidate: {
          academics: 'IB 42',
          achievements: [{ title: 'Olympiad' }],
          activities: [{ title: 'Robotics club' }],
          goals: 'Data engineering',
          preferences: {},
        },
        application: {
          ...context().application,
          requirements: 'A-level maths',
          sources: [{ field: 'programme', url: 'https://example.ac.uk/cs' }],
        },
        documents: { cvText: 'Education...', structuredCv: null, statementText: null },
      }),
    );
    expect(gaps).toEqual([]);
  });
});

describe('mergeMissingInformation', () => {
  it('puts the deterministic checks first, since they are the actionable ones', () => {
    const merged = mergeMissingInformation(['Model gap'], ['Checked gap']);
    expect(merged[0]).toBe('Checked gap');
  });

  it('dedupes case-insensitively', () => {
    const merged = mergeMissingInformation(['No CV content yet'], ['no cv content yet']);
    expect(merged).toHaveLength(1);
  });

  it('drops empties and caps the list at a readable length', () => {
    const merged = mergeMissingInformation(
      Array.from({ length: 30 }, (_, i) => `gap ${i}`),
      ['', '   '],
    );
    expect(merged).toHaveLength(10);
  });
});

describe('toTargetProfilePatch', () => {
  const generation = {
    careerDirection: 'Data engineering',
    universityPositioning: '',
    educationPhilosophy: '   ',
    environment: 'Small cohort',
    programmeObjectives: '',
    priorityCapabilities: 'Analytical thinking',
    careerAlignment: '',
    missingInformation: [],
    sourcesUsed: [],
  };

  /**
   * The distinction matters: `null` is "we could not establish this", which the
   * status derivation counts as unfilled. An empty string would count as content
   * and would report the profile as further along than it is.
   */
  it('turns empty and whitespace-only fields into null', () => {
    const patch = toTargetProfilePatch(generation);
    expect(patch.universityPositioning).toBeNull();
    expect(patch.educationPhilosophy).toBeNull();
    expect(patch.programmeObjectives).toBeNull();
    expect(patch.careerAlignment).toBeNull();
  });

  it('keeps real values', () => {
    const patch = toTargetProfilePatch(generation);
    expect(patch.careerDirection).toBe('Data engineering');
    expect(patch.priorityCapabilities).toBe('Analytical thinking');
  });
});
