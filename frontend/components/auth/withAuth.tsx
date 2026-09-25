'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { roleHome } from '@/lib/roles';
import { LogoMark } from '@/components/brand/Logo';
import toast from 'react-hot-toast';
import { t } from '@/lib/i18n';

export function AuthLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5">
      <LogoMark className="h-11 w-11 animate-pulse" />
      <div className="loading-dots" aria-label={t("Loading")}>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles?: string[]
) {
  return function AuthenticatedComponent(props: P) {
    const router = useRouter();
    const { isAuthenticated, user } = useAuthStore();
    const [isChecking, setIsChecking] = React.useState(true);
    const [hydrated, setHydrated] = React.useState(false);

    React.useEffect(() => {
      // Wait for Zustand to hydrate from localStorage
      const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
      if (useAuthStore.persist.hasHydrated()) setHydrated(true);
      return () => { unsub(); };
    }, []);

    React.useEffect(() => {
      if (!hydrated) return;

      if (!isAuthenticated) {
        toast.error(t("Please sign in to continue"));
        router.replace('/login');
        return;
      }

      if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        toast.error(t("That page belongs to a different portal"));
        router.replace(roleHome(user.role));
        return;
      }

      setIsChecking(false);
    }, [hydrated, isAuthenticated, user, router]);

    if (isChecking) return <AuthLoading />;

    return <Component {...props} />;
  };
}
