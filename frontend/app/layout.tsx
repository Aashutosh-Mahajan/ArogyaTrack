import './globals.css';
import type { Metadata } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';
import { ThemeProvider } from './theme-provider';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['opsz', 'SOFT', 'WONK'],
});
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'ArogyaTrack - National Health Surveillance',
  description: 'Advanced Public Health Surveillance and Management System | Government of India',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakarta.className} ${fraunces.variable} ${plusJakarta.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Providers>{children}</Providers>
          <div className="grain-overlay" aria-hidden="true" />
        </ThemeProvider>
      </body>
    </html>
  );
}
