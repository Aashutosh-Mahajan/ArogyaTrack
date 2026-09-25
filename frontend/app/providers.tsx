'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { LanguageProvider } from '@/components/providers/LanguageProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        {children}
        <Toaster
          position="top-right"
          gutter={10}
          toastOptions={{
            duration: 4000,
            className: '!rounded-xl !text-sm !font-medium',
            style: {
              background: 'hsl(var(--popover))',
              color: 'hsl(var(--popover-foreground))',
              border: '1px solid hsl(var(--border))',
              boxShadow: '0 16px 40px -16px hsl(var(--shadow-color) / 0.35)',
              padding: '10px 14px',
            },
            success: {
              duration: 3000,
              iconTheme: { primary: 'hsl(var(--success))', secondary: 'hsl(var(--card))' },
            },
            error: {
              iconTheme: { primary: 'hsl(var(--destructive))', secondary: 'hsl(var(--card))' },
            },
          }}
        />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
