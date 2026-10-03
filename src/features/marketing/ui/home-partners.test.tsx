import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/lib/i18n';
import { HomePartners } from './home-partners';
vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
describe('lazy scholarship preview', () => {
  it('opens on demand, filters real entries, and closes', async () => {
    render(<LanguageProvider><HomePartners scholarships={[
      { id: 1, title: 'Alpha scholarship', href: '#alpha', organization: 'Alpha University', value: 'Full tuition' },
      { id: 2, title: 'Beta scholarship', href: '#beta', organization: 'Beta University', value: 'Half tuition' },
    ]} scholarshipTotal={100} /></LanguageProvider>);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Find scholarships' }));
    const search = await screen.findByRole('searchbox', {}, { timeout: 15000 });
    expect(screen.getByText('Alpha scholarship')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'Beta' } });
    expect(screen.queryByText('Alpha scholarship')).not.toBeInTheDocument();
    expect(screen.getByText('Beta scholarship')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide scholarships' }));
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});
