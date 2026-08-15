import type { IntakeChoice, IntakeOption } from '../domain';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function localizeIntakeCopy(choice: IntakeChoice, t: Translate) {
  switch (choice.type) {
    case 'specific':
      return {
        label: t(choice.season === 'autumn' ? 'Autumn / Fall {year}' : 'Spring {year}', {
          year: choice.year,
        }),
        detail: t(
          choice.season === 'autumn'
            ? 'September – December {year}'
            : 'January – April {year}',
          { year: choice.year },
        ),
      };
    case 'later':
      return {
        label: t('Later than {year}', { year: choice.afterYear }),
        detail: t('Starting from {year} or later', { year: choice.afterYear + 1 }),
      };
    case 'undecided':
      return {
        label: t('Not decided yet'),
        detail: t('I’m still exploring my options'),
      };
  }
}

export function localizeIntakeOption(option: IntakeOption, t: Translate): IntakeOption {
  return { ...option, ...localizeIntakeCopy(option.choice, t) };
}
