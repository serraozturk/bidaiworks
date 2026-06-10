import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from '@/components/NavBar';
import { CookieConsent } from '@/components/CookieConsent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'bidAI — Renovation quotes from local contractors',
  description:
    'Post your renovation project, get an AI cost estimate, and receive matching quotes from licensed contractors in your area.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-slate-50">
      <body className="flex min-h-screen flex-col font-sans text-slate-900 antialiased">
        <NavBar />

        <main className="flex-1">{children}</main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} bidAI</span>

            <span className="flex items-center gap-4">
              <a href="/legal/terms" className="hover:text-slate-700">
                Terms
              </a>

              <a href="/legal/privacy" className="hover:text-slate-700">
                Privacy
              </a>

              <span>Protected renovation marketplace.</span>
            </span>
          </div>
        </footer>

        <CookieConsent />
      </body>
    </html>
  );
}