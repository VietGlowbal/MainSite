import { describe, expect, it } from 'vitest';
import { translations } from '@/lib/i18n-dictionary';
import { guideArea } from './strategy-guide';

describe('Strategy guide localization', () => {
  it('has Vietnamese dictionary entries for every user-facing Strategy step string', () => {
    const area = guideArea('strategy');
    const strings = [
      area.title,
      area.summary,
      ...area.steps.flatMap((step) => [
        step.title,
        step.summary,
        ...step.details,
        ...(step.linkLabel ? [step.linkLabel] : []),
      ]),
    ];

    expect(strings.filter((copy) => translations[copy] === undefined)).toEqual([]);
  });
});
