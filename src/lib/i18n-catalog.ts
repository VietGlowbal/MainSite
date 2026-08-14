import { translations as baseTranslations } from './i18n-dictionary';
import { PERSONAL_REPORT_TRANSLATIONS } from './i18n-personal-report';

/**
 * Runtime/static-audit translation catalog.
 *
 * Feature-specific catalogs keep large report surfaces maintainable without
 * turning the base navigation/product dictionary into an unstructured dump.
 */
export const translations: Record<string, string> = {
  ...baseTranslations,
  ...PERSONAL_REPORT_TRANSLATIONS,
};
