'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

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
      const unsub = useAuthStore.persist.onFinishHydration(() => {
        setHydrated(true);
      });
      // If already hydrated (e.g. not the first mount)
      if (useAuthStore.persist.hasHydrated()) {
        setHydrated(true);
      }
      return () => { unsub(); };
    }, []);

    React.useEffect(() => {
      if (!hydrated) return;

      if (!isAuthenticated) {
        toast.error('Please login to continue');
        router.push('/login');
        return;
      }

      if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        toast.error('You do not have permission to access this page');
        router.push('/dashboard');
        return;
      }

      setIsChecking(false);
    }, [hydrated, isAuthenticated, user, router]);

    if (isChecking) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
