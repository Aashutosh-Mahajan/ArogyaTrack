'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Old route kept for bookmarks; the patient list lives at /doctor/patients. */
export default function MyPatientsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/doctor/patients');
  }, [router]);
  return null;
}
