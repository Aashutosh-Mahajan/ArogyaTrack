import './globals.css';
import type { Metadata } from 'next';
import { Inter, Syne, DM_Sans } from 'next/font/google';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });
const syne = Syne({ subsets: ['latin'], variable: '--font-syne' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm' });

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
    <html lang="en">
      <body className={`${inter.className} ${syne.variable} ${dmSans.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
