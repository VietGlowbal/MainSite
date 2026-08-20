import { translations as baseTranslations } from './i18n-dictionary';
import { APPLICATION_FLOW_TRANSLATIONS } from './i18n-application-flow';
import { PERSONAL_REPORT_TRANSLATIONS } from './i18n-personal-report';
import { PLANNER_TRANSLATIONS } from './i18n-planner';

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
  ...PLANNER_TRANSLATIONS,
};
