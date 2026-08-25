import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PRIVATE_ROBOTS } from '@/lib/seo/indexability';

export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
