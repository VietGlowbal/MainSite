import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist_Mono, Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Glowbal V2',
  description: 'Student-first global course and university guidance platform.',
};

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/auth', label: 'Auth' },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} h-full overflow-x-hidden bg-white antialiased`}
    >
      <body className="min-h-full overflow-x-hidden bg-white text-slate-800 flex flex-col glowbal-site-shell">
        <header className="glowbal-topbar border-b border-black/5 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10 lg:px-12">
            <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
              <span className="glowbal-wordmark">Glowbal</span>
            </Link>
            <nav className="glowbal-nav flex items-center gap-2 text-sm text-slate-600">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="glowbal-nav-link transition hover:text-slate-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <div className="flex-1 min-h-0">{children}</div>
      </body>
    </html>
  );
}
