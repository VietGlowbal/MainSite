import { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScholarshipDashboard } from '@/app/scholarships/scholarship-dashboard';
import { LanguageProvider, useLanguage } from '@/lib/i18n';

function Controls() {
  const { setLang } = useLanguage();
  useEffect(() => setLang('vi'), [setLang]);
  return <button type="button" onClick={() => setLang('en')}>EN</button>;
}

describe('Scholarships language switching', () => {
  it('switches static AI-tab chrome from Vietnamese back to English', async () => {
    render(
      <LanguageProvider>
        <Controls />
        <ScholarshipDashboard applications={[]} existingScholarships={[]} />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Chưa nhập khóa học nào' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No courses imported yet' })).toBeInTheDocument();
    });
  });
});
