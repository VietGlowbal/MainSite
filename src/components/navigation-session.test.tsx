import { act, render, screen, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  loginFetch: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mocks.getUser,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    from: mocks.from,
  }),
}));

import {
  NavigationSessionProvider,
  notifyNavigationOnboardingCompleted,
  useNavigationSession,
  type NavigationSessionValue,
} from './navigation-session';

const USER = {
  id: 'user-1',
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-08-07T00:00:00.000Z',
  email: 'student@example.com',
  user_metadata: {
    full_name: 'Test Student',
    avatar_url: 'https://example.com/avatar.png',
  },
} satisfies User;

let authCallback:
  | ((event: string, session: { user: User } | null) => void)
  | undefined;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function Probe() {
  const session = useNavigationSession();
  return <output data-testid="session">{JSON.stringify(session)}</output>;
}

function renderProvider() {
  return render(
    <NavigationSessionProvider>
      <Probe />
    </NavigationSessionProvider>,
  );
}

function readSession(): NavigationSessionValue {
  return JSON.parse(screen.getByTestId('session').textContent ?? '{}') as NavigationSessionValue;
}

describe('NavigationSessionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authCallback = undefined;
    window.sessionStorage.clear();
    mocks.loginFetch.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mocks.loginFetch);

    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.onAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails closed when a consumer is rendered outside the provider', () => {
    render(<Probe />);

    expect(readSession()).toEqual({
      ready: false,
      signedIn: false,
      user: null,
      completed: false,
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('stays unresolved until the one initial auth read finishes', async () => {
    const auth = deferred<{ data: { user: null } }>();
    mocks.getUser.mockReturnValue(auth.promise);

    renderProvider();

    expect(readSession()).toEqual({
      ready: false,
      signedIn: false,
      user: null,
      completed: false,
    });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.from).not.toHaveBeenCalled();

    auth.resolve({ data: { user: null } });

    await waitFor(() => expect(readSession().ready).toBe(true));
    expect(readSession()).toEqual({
      ready: true,
      signedIn: false,
      user: null,
      completed: false,
    });
  });

  it('loads only the completion fields and exposes the signed-in user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        onboarding_completed: false,
        study_level: 'undergraduate',
        preferred_countries: ['United Kingdom'],
      },
      error: null,
    });

    renderProvider();

    await waitFor(() => expect(readSession().ready).toBe(true));

    expect(readSession()).toEqual({
      ready: true,
      signedIn: true,
      user: {
        id: 'user-1',
        name: 'Test Student',
        avatarUrl: 'https://example.com/avatar.png',
      },
      completed: true,
    });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith('student_profiles');
    expect(mocks.select).toHaveBeenCalledWith(
      'onboarding_completed, study_level, preferred_countries',
    );
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
  });

  it('retries one profile-read error and resolves from the successful retry', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'profile temporarily unavailable' },
      })
      .mockResolvedValueOnce({
        data: { onboarding_completed: true },
        error: null,
      });

    renderProvider();

    await waitFor(() => expect(readSession().ready).toBe(true));
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(2);
    expect(readSession()).toMatchObject({
      ready: true,
      signedIn: true,
      user: { id: 'user-1' },
      completed: true,
    });
  });

  it('stays unresolved after a persistent profile-read error without losing the identity', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'profile unavailable' },
    });

    renderProvider();

    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalledTimes(2));
    expect(readSession()).toMatchObject({
      ready: false,
      signedIn: true,
      user: { id: 'user-1' },
      completed: false,
    });
  });

  it('records sign-in once per browser session and resets the guard on sign-out', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.maybeSingle.mockResolvedValue({
      data: { onboarding_completed: true },
      error: null,
    });

    renderProvider();
    await waitFor(() => expect(readSession().ready).toBe(true));

    act(() => authCallback?.('SIGNED_IN', { user: USER }));
    expect(mocks.loginFetch).toHaveBeenCalledOnce();
    expect(mocks.loginFetch).toHaveBeenLastCalledWith('/api/auth/login-event', {
      method: 'POST',
    });
    expect(window.sessionStorage.getItem('gb_login_logged')).toBe('1');

    act(() => authCallback?.('SIGNED_IN', { user: USER }));
    expect(mocks.loginFetch).toHaveBeenCalledOnce();

    act(() => authCallback?.('SIGNED_OUT', null));
    expect(window.sessionStorage.getItem('gb_login_logged')).toBeNull();

    act(() => authCallback?.('SIGNED_IN', { user: USER }));
    expect(mocks.loginFetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates the initial auth event and follows later auth changes', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.maybeSingle.mockResolvedValue({
      data: { onboarding_completed: true },
      error: null,
    });

    const view = renderProvider();
    await waitFor(() => expect(readSession().ready).toBe(true));

    act(() => authCallback?.('INITIAL_SESSION', { user: USER }));
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();

    act(() => authCallback?.('SIGNED_OUT', null));
    expect(readSession()).toEqual({
      ready: true,
      signedIn: false,
      user: null,
      completed: false,
    });

    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  it('applies the same-tab completion event immediately and preserves it across an in-flight read', async () => {
    const profile = deferred<{
      data: { onboarding_completed: false };
      error: null;
    }>();
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.maybeSingle.mockReturnValue(profile.promise);

    renderProvider();

    await waitFor(() => expect(readSession().signedIn).toBe(true));
    expect(readSession().ready).toBe(false);

    act(() => notifyNavigationOnboardingCompleted());

    expect(readSession()).toMatchObject({
      ready: true,
      signedIn: true,
      completed: true,
    });

    profile.resolve({ data: { onboarding_completed: false }, error: null });

    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalledOnce());
    await waitFor(() => expect(readSession().completed).toBe(true));
  });
});
