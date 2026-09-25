import type { LucideIcon } from 'lucide-react';
import { m } from '@/lib/i18n';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  Download,
  FilePlus2,
  FileText,
  FlaskConical,
  Globe2,
  HeartPulse,
  History,
  LayoutGrid,
  Network,
  Package,
  ReceiptText,
  Pill,
  QrCode,
  ScanLine,
  ShieldCheck,
  TrendingUp,
  User,
  UserCheck,
  Users,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only the exact path counts as active (for section index pages). */
  exact?: boolean;
  /** Which live counter to show as a badge. */
  badge?: 'patientAlerts' | 'surveillanceAlerts' | 'pendingDoctors';
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /** Restrict the whole group to these user roles. */
  roles?: string[];
}

export type PortalKey = 'patient' | 'doctor' | 'pharmacist' | 'admin';

export const portalNav: Record<PortalKey, { title: string; groups: NavGroup[] }> = {
  patient: {
    title: m('Patient portal'),
    groups: [
      {
        label: m('Overview'),
        items: [
          { href: '/dashboard', label: m('Dashboard'), icon: LayoutGrid, exact: true },
          { href: '/dashboard/patient-card', label: m('Health card'), icon: CreditCard },
          { href: '/dashboard/alerts', label: m('Alerts'), icon: Bell, badge: 'patientAlerts' },
        ],
      },
      {
        label: m('Health records'),
        items: [
          { href: '/dashboard/medical-records', label: m('Medical records'), icon: FileText },
          { href: '/dashboard/lab-reports', label: m('Lab reports'), icon: FlaskConical },
          { href: '/dashboard/conditions', label: m('Conditions'), icon: HeartPulse },
        ],
      },
      {
        label: m('Medication'),
        items: [
          { href: '/dashboard/prescriptions', label: m('Prescriptions'), icon: ClipboardList },
          { href: '/dashboard/medicines', label: m('Medicines'), icon: Pill },
          { href: '/dashboard/adherence', label: m('Adherence'), icon: CalendarCheck },
          { href: '/dashboard/bills', label: m('Pharmacy bills'), icon: ReceiptText },
        ],
      },
      {
        label: m('Account'),
        items: [
          { href: '/dashboard/profile', label: m('Profile'), icon: User },
          { href: '/dashboard/downloads', label: m('Downloads'), icon: Download },
          { href: '/dashboard/security', label: m('Security'), icon: ShieldCheck },
        ],
      },
    ],
  },
  doctor: {
    title: m('Doctor portal'),
    groups: [
      {
        label: m('Clinic'),
        items: [
          { href: '/doctor/dashboard', label: m('Dashboard'), icon: LayoutGrid },
          { href: '/doctor/patients', label: m('My patients'), icon: Users },
          { href: '/doctor/high-risk', label: m('High-risk watch'), icon: AlertTriangle },
        ],
      },
      {
        label: m('Actions'),
        items: [
          { href: '/doctor/scan-qr', label: m('Scan health card'), icon: QrCode },
          { href: '/doctor/add-record', label: m('Add record'), icon: FilePlus2 },
        ],
      },
      {
        label: m('Account'),
        items: [{ href: '/doctor/security', label: m('Security'), icon: ShieldCheck }],
      },
    ],
  },
  pharmacist: {
    title: m('Pharmacy portal'),
    groups: [
      {
        label: m('Counter'),
        items: [
          { href: '/pharmacy', label: m('Dashboard'), icon: LayoutGrid, exact: true },
          { href: '/pharmacy/scan', label: m('Scan prescription'), icon: ScanLine },
          { href: '/pharmacy/dispense/patient', label: m('Dispense by patient'), icon: Pill },
        ],
      },
      {
        label: m('Records'),
        items: [
          { href: '/pharmacy/history', label: m('Dispensing history'), icon: History },
          { href: '/pharmacy/invoices', label: m('Invoices'), icon: ReceiptText },
          { href: '/pharmacy/inventory', label: m('Inventory'), icon: Package },
        ],
      },
      {
        label: m('Account'),
        items: [{ href: '/pharmacy/security', label: m('Security'), icon: ShieldCheck }],
      },
    ],
  },
  admin: {
    title: m('Surveillance command'),
    groups: [
      {
        label: m('Monitor'),
        items: [
          { href: '/admin', label: m('Command centre'), icon: LayoutGrid, exact: true },
          { href: '/admin/alerts', label: m('Outbreak alerts'), icon: Bell, badge: 'surveillanceAlerts' },
          { href: '/admin/surveillance', label: m('Surveillance map'), icon: Globe2 },
        ],
      },
      {
        label: m('Intelligence'),
        items: [
          { href: '/admin/analytics', label: m('Analytics'), icon: BarChart3 },
          { href: '/admin/clusters', label: m('Clusters'), icon: Network },
          { href: '/admin/forecasts', label: m('Forecasts'), icon: TrendingUp },
        ],
      },
      {
        label: m('Administration'),
        roles: ['admin'],
        items: [
          { href: '/admin/approvals', label: m('Doctor approvals'), icon: UserCheck, badge: 'pendingDoctors' },
          { href: '/admin/users', label: m('Users & audit log'), icon: Users },
          { href: '/admin/security', label: m('Security'), icon: ShieldCheck },
        ],
      },
    ],
  },
};

export function portalFor(role?: string | null, pathname = ''): PortalKey {
  if (role === 'doctor') return 'doctor';
  if (role === 'pharmacist') return 'pharmacist';
  if (role === 'admin' || role === 'authority') return 'admin';
  if (role === 'patient') return 'patient';
  if (pathname.startsWith('/doctor')) return 'doctor';
  if (pathname.startsWith('/pharmacy')) return 'pharmacist';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'patient';
}

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

/** Best nav match for the current path (longest href wins). */
export function findNavItem(portal: PortalKey, pathname: string): NavItem | undefined {
  const all = portalNav[portal].groups.flatMap((g) => g.items);
  return all
    .filter((i) => isNavActive(i, pathname) || pathname.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export const PulseIcon = Activity;
