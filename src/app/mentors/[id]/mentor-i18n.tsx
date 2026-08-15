'use client';

import { useLanguage } from '@/lib/i18n';

export function LocalizedReviewByline({ createdAt }: { createdAt: string }) {
  const { lang, t } = useLanguage();
  const locale = lang === 'vi' ? 'vi-VN' : 'en-GB';
  const date = new Date(createdAt).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return <>{t('{student} · {date}', { student: t('Glowbal student'), date })}</>;
}
