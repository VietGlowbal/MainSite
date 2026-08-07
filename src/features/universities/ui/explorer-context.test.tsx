import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: {} }),
}));

import { UniversityExplorerProvider, useExplorer } from './explorer-context';

function Probe({ onMount }: { onMount: () => void }) {
  const { isShortlisted } = useExplorer();
  useEffect(onMount, [onMount]);
  return <output>{isShortlisted(42) ? 'saved' : 'guest'}</output>;
}

const props = {
  initialUniversities: [],
  initialApplications: [],
  hasProfile: false,
  admissionUnlocked: false,
  profileStrength: null,
};

describe('UniversityExplorerProvider hydration', () => {
  it('hydrates the signed-in shortlist without remounting its children', () => {
    const onMount = vi.fn();
    const { rerender } = render(
      <UniversityExplorerProvider {...props} initialShortlist={[]} isLoggedIn={false}>
        <Probe onMount={onMount} />
      </UniversityExplorerProvider>,
    );

    rerender(
      <UniversityExplorerProvider {...props} initialShortlist={[42]} isLoggedIn>
        <Probe onMount={onMount} />
      </UniversityExplorerProvider>,
    );

    expect(screen.getByText('saved')).toBeInTheDocument();
    expect(onMount).toHaveBeenCalledTimes(1);
  });
});
