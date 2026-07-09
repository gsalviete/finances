import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import '../styles/globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'finances',
  description: 'Quanto eu ainda posso gastar até o final deste mês?',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // hint de tema em cookie: primeiro paint já sai no tema certo (FR-036, sem FOUC)
  const themeHint = (await cookies()).get('finances-theme')?.value;
  return (
    <html
      lang="pt-BR"
      data-theme={themeHint === 'dark' || themeHint === 'light' ? themeHint : undefined}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
