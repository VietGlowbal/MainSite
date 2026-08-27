'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigationSession } from '@/components/navigation-session';
import { createClient } from '@/lib/supabase/client';
import type { NavEntry, NavLink } from '@/shared/ui/nav-model';

export type NavigationRoles = {
  userId: string;
  isAdvisor: boolean;
  isAdmin: boolean;
  isCoordinator: boolean;
};

const NavigationRolesContext = createContext<NavigationRoles | null>(null);

const ADVISOR_DASHBOARD_ITEM = { href: '/dashboard/advisor', label: 'Advisor hub' };
const COORDINATOR_ITEM = { href: '/coordinator', label: 'Coordinator' };
const ADMIN_ITEM = { href: '/admin', label: 'Admin' };

async function readRoleCheck(
  href: string,
  key: 'isAdmin' | 'isCoordinator',
): Promise<boolean> {
  try {
    const response = await fetch(href, { cache: 'no-store' });
    if (!response.ok) return false;

    const body = (await response.json()) as Partial<Record<typeof key, unknown>>;
    return body[key] === true;
  } catch {
    return false;
  }
}

/**
 * Loads role-gated navigation once for the signed-in identity and shares it
 * with every header implementation. Some routes render the root AppTopNav and
 * others render SiteNavigation, so available destinations stay route-invariant.
 */
export function NavigationRolesProvider({ children }: { children: ReactNode }) {
  const session = useNavigationSession();
  const supabase = useMemo(() => createClient(), []);
  const [loadedRoles, setLoadedRoles] = useState<NavigationRoles | null>(null);
  const requestVersion = useRef(0);
  const userId = session.user?.id ?? null;

  useEffect(() => {
    let active = true;
    const version = ++requestVersion.current;

    if (!userId) {
      return () => {
        active = false;
      };
    }
    const activeUserId = userId;

    async function loadRoles() {
      let advisorResult: { data: unknown } = { data: null };
      let isAdmin = false;
      let isCoordinator = false;

      try {
        [advisorResult, isAdmin, isCoordinator] = await Promise.all([
          supabase
            .from('achiever_profiles')
            .select('id')
            .eq('id', activeUserId)
            .maybeSingle(),
          readRoleCheck('/api/admin/check', 'isAdmin'),
          readRoleCheck('/api/coordinator/check', 'isCoordinator'),
        ]);
      } catch {
        // Navigation permissions are best-effort affordances. The destination
        // remains protected server-side even when this read is unavailable.
      }

      if (!active || version !== requestVersion.current) return;

      setLoadedRoles({
        userId: activeUserId,
        isAdvisor: Boolean(advisorResult.data),
        isAdmin,
        isCoordinator,
      });
    }

    void loadRoles();

    return () => {
      active = false;
    };
  }, [supabase, userId]);

  const roles = loadedRoles?.userId === userId ? loadedRoles : null;

  return (
    <NavigationRolesContext.Provider value={roles}>
      {children}
    </NavigationRolesContext.Provider>
  );
}

export function useNavigationRoles(): NavigationRoles | null {
  return useContext(NavigationRolesContext);
}

/** Append private role destinations after the shared student navigation. */
export function withNavigationRoleItems(
  items: readonly NavEntry[],
  roles: NavigationRoles | null,
  t: (label: string) => string,
): NavEntry[] {
  const roleItems: readonly NavLink[] = [
    ...(roles?.isAdvisor ? [ADVISOR_DASHBOARD_ITEM] : []),
    ...(roles?.isCoordinator ? [COORDINATOR_ITEM] : []),
    ...(roles?.isAdmin ? [ADMIN_ITEM] : []),
  ];

  return [
    ...items,
    ...roleItems.map((item) => ({ href: item.href, label: t(item.label) })),
  ];
}
