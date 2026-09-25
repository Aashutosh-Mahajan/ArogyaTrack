import { t } from './i18n';
import type { UserRole } from '@/types';

/** Landing page for each role after sign-in or when bounced from a page. */
export function roleHome(role?: UserRole | string | null): string {
  switch (role) {
    case 'doctor':
      return '/doctor/dashboard';
    case 'pharmacist':
      return '/pharmacy';
    case 'admin':
    case 'authority':
      return '/admin';
    case 'patient':
      return '/dashboard';
    default:
      return '/login';
  }
}

export function roleLabel(role?: UserRole | string | null): string {
  switch (role) {
    case 'doctor':
      return t('Doctor');
    case 'pharmacist':
      return t('Pharmacist');
    case 'admin':
      return t('Administrator');
    case 'authority':
      return t('Health authority');
    case 'patient':
      return t('Patient');
    default:
      return t('Guest');
  }
}
