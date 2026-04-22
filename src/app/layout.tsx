import type { Metadata } from 'next';
import { Geist_Mono, Outfit } from 'next/font/google';
import { NavReveal } from '@/components/nav-reveal';
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
            <NavReveal />
          </div>
        </header>
        <div className="flex-1 min-h-0">{children}</div>
      </body>
    </html>
  );
}
