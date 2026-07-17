'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from 'next-themes';
import { I18nProvider, useI18n } from '../lib/i18n';
import { SessionProvider } from '../lib/session';

/** motionLevel (Settings §3.7): FULL respeita o SO; REDUCED/NONE forçam redução. */
function MotionPreference({ children }: { children: React.ReactNode }) {
  const { motionLevel } = useI18n();
  return (
    <MotionConfig reducedMotion={motionLevel === 'FULL' ? 'user' : 'always'}>
      {children}
    </MotionConfig>
  );
}

export function Providers({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang?: string;
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } }),
  );
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      <I18nProvider initialLang={initialLang}>
        <MotionPreference>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>{children}</SessionProvider>
          </QueryClientProvider>
        </MotionPreference>
      </I18nProvider>
    </ThemeProvider>
  );
}
