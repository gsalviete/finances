import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Bricolage_Grotesque, Instrument_Sans, Spline_Sans_Mono } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from './providers';

/** Tipografia da identidade: display com personalidade, corpo neutro, números tabulares. */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display-face',
});
const body = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body-face',
});
const mono = Spline_Sans_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono-face',
});

export const metadata: Metadata = {
  title: 'finances',
  description: 'Quanto eu ainda posso gastar até o final deste mês?',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // hints em cookie: primeiro paint já sai no tema e idioma certos (FR-036, sem FOUC)
  const store = await cookies();
  const themeHint = store.get('finances-theme')?.value;
  const langHint = store.get('finances-lang')?.value;
  const lang = langHint?.toLowerCase().startsWith('en') ? 'en-US' : 'pt-BR';
  return (
    <html
      lang={lang}
      data-theme={themeHint === 'dark' || themeHint === 'light' ? themeHint : undefined}
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers initialLang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
