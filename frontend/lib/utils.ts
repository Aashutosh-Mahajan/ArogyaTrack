import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, format: string = 'PPP'): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.slice(0, length)}...` : str;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = String(item[key]);
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: 'text-red-600 bg-red-100',
    high: 'text-orange-600 bg-orange-100',
    medium: 'text-yellow-600 bg-yellow-100',
    low: 'text-blue-600 bg-blue-100',
    info: 'text-gray-600 bg-gray-100',
  };
  return colors[severity.toLowerCase()] || colors.info;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'text-green-600 bg-green-100',
    pending: 'text-yellow-600 bg-yellow-100',
    completed: 'text-blue-600 bg-blue-100',
    cancelled: 'text-red-600 bg-red-100',
    expired: 'text-gray-600 bg-gray-100',
  };
  return colors[status.toLowerCase()] || colors.pending;
}
