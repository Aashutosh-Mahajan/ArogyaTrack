'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirects /doctor → /doctor/dashboard so the sidebar "Dashboard" link
 * always matches the canonical route.
 */
export default function DoctorIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/doctor/dashboard');
  }, [router]);
  return null;
}
