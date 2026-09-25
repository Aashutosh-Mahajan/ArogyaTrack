'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Visits and prescriptions are recorded together on the consultation page. */
export default function Redirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/doctor/patients/${id}/create-consultation`);
  }, [id, router]);
  return null;
}
