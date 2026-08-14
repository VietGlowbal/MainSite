import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import { useNewsCopy } from './news-copy';

function Probe() {
  const t = useNewsCopy();
  const { setLang } = useLanguage();
  return (
    <>
      <span data-testid="mapped">{t('Edit article')}</span>
      <span data-testid="global">{t('Title')}</span>
      <button type="button" onClick={() => setLang('vi')}>VI</button>
    </>
  );
}

describe('useNewsCopy', () => {
  it('uses CMS copy first and the global dictionary as a fallback', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('mapped')).toHaveTextContent('Edit article');

    fireEvent.click(screen.getByRole('button', { name: 'VI' }));

    expect(screen.getByTestId('mapped')).toHaveTextContent('Chỉnh sửa bài viết');
    expect(screen.getByTestId('global')).toHaveTextContent('Tiêu đề');
  });
});
