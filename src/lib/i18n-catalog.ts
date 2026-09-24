import { translations as baseTranslations } from './i18n-dictionary';
import { APPLICATION_FLOW_TRANSLATIONS } from './i18n-application-flow';
import { PERSONAL_REPORT_TRANSLATIONS } from './i18n-personal-report';
import { STRATEGY_HUB_TRANSLATIONS } from './i18n-strategy-hub';
import { PLANNER_TRANSLATIONS } from './i18n-planner';
import { MATCHING_REPORT_TRANSLATIONS } from './i18n-matching-report';
import { FINAL_CHECK_TRANSLATIONS } from './i18n-final-check';
import { STRATEGY_REPORT_TRANSLATIONS } from './i18n-strategy-report';
import { AUTH_TRANSLATIONS } from './i18n-auth';

/**
 * Runtime/static-audit translation catalog.
 *
 * Feature-specific catalogs keep large report surfaces maintainable without
 * turning the base navigation/product dictionary into an unstructured dump.
 */
export const translations: Record<string, string> = {
  ...baseTranslations,
  ...PERSONAL_REPORT_TRANSLATIONS,
  ...APPLICATION_FLOW_TRANSLATIONS,
  ...STRATEGY_HUB_TRANSLATIONS,
  ...PLANNER_TRANSLATIONS,
  ...MATCHING_REPORT_TRANSLATIONS,
  ...FINAL_CHECK_TRANSLATIONS,
  ...STRATEGY_REPORT_TRANSLATIONS,
  ...AUTH_TRANSLATIONS,
};
