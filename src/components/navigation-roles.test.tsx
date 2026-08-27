import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigationSessionValue } from '@/components/navigation-session';
import type { NavEntry } from '@/shared/ui/nav-model';

const mocks = vi.hoisted(() => ({
  session: {
    ready: true,
    signedIn: false,
    user: null,
    completed: false,
  } as NavigationSessionValue,
  maybeSingle: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/components/navigation-session', () => ({
  useNavigationSession: () => mocks.session,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mocks.from }),
}));

import {
  NavigationRolesProvider,
  useNavigationRoles,
  withNavigationRoleItems,
} from './navigation-roles';

function Probe() {
  const roles = useNavigationRoles();
  return <output data-testid="roles">{JSON.stringify(roles)}</output>;
}

describe('NavigationRolesProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = {
      ready: true,
      signedIn: false,
      user: null,
      completed: false,
    };
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => ({
        ok: true,
        json: async () =>
          String(input).includes('/api/admin/check')
            ? { isAdmin: false }
            : { isCoordinator: false },
      })),
    );
  });

  it('does not request roles for a signed-out visitor', () => {
    render(
      <NavigationRolesProvider>
        <Probe />
      </NavigationRolesProvider>,
    );

    expect(screen.getByTestId('roles')).toHaveTextContent('null');
    expect(mocks.from).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shares advisor, coordinator, and admin roles for the signed-in identity', async () => {
    mocks.session = {
      ready: true,
      signedIn: true,
      user: { id: 'user-1', name: 'Role User' },
      completed: true,
    };
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'user-1' }, error: null });
    vi.mocked(fetch).mockImplementation(async (input) => ({
      ok: true,
      json: async () =>
        String(input).includes('/api/admin/check')
          ? { isAdmin: true }
          : { isCoordinator: true },
    }) as Response);

    render(
      <NavigationRolesProvider>
        <Probe />
      </NavigationRolesProvider>,
    );

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('roles').textContent ?? 'null')).toEqual({
        userId: 'user-1',
        isAdvisor: true,
        isAdmin: true,
        isCoordinator: true,
      }),
    );
    expect(mocks.from).toHaveBeenCalledWith('achiever_profiles');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('withNavigationRoleItems', () => {
  it('appends only the destinations allowed by the current roles', () => {
    const items: readonly NavEntry[] = [{ href: '/', label: 'Home' }];

    expect(
      withNavigationRoleItems(
        items,
        {
          userId: 'user-1',
          isAdvisor: true,
          isAdmin: true,
          isCoordinator: false,
        },
        (label) => label,
      ),
    ).toEqual([
      { href: '/', label: 'Home' },
      { href: '/dashboard/advisor', label: 'Advisor hub' },
      { href: '/admin', label: 'Admin' },
    ]);
  });
});
