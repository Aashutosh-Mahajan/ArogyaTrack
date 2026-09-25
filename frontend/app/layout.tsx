import './globals.css';
import '@fontsource-variable/geist';
import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Noto_Sans_Bengali, Noto_Sans_Devanagari, Noto_Sans_Tamil, Noto_Sans_Telugu } from 'next/font/google';
import { Providers } from './providers';
import { ThemeProvider } from './theme-provider';

const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
});

// Interface text in Hindi/Marathi, Tamil, Telugu and Bengali (Geist has no
// glyphs for these scripts). Each face is only fetched when its script is
// on the page.
const deva = Noto_Sans_Devanagari({ subsets: ['devanagari'], weight: ['400', '500', '600', '700'], display: 'swap', preload: false, variable: '--font-deva' });
const tamil = Noto_Sans_Tamil({ subsets: ['tamil'], weight: ['400', '500', '600', '700'], display: 'swap', preload: false, variable: '--font-tamil' });
const telugu = Noto_Sans_Telugu({ subsets: ['telugu'], weight: ['400', '500', '600', '700'], display: 'swap', preload: false, variable: '--font-telugu' });
const bengali = Noto_Sans_Bengali({ subsets: ['bengali'], weight: ['400', '500', '600', '700'], display: 'swap', preload: false, variable: '--font-bengali' });

export const metadata: Metadata = {
  title: {
    default: 'ArogyaTrack — National Health Surveillance',
    template: '%s · ArogyaTrack',
  },
  description:
    'One platform for patient records, e-prescriptions, pharmacy dispensing and AI-assisted disease surveillance across India.',
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: 'ArogyaTrack — National Health Surveillance',
    description:
      'Patient records, e-prescriptions, pharmacy dispensing and AI-assisted outbreak detection in one platform.',
    images: ['/image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f8f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1113' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${instrument.variable} ${deva.variable} ${tamil.variable} ${telugu.variable} ${bengali.variable}`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <Providers>{children}</Providers>
          <div className="grain-overlay" aria-hidden="true" />
        </ThemeProvider>
      </body>
    </html>
  );
}
