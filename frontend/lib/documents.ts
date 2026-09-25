import toast from 'react-hot-toast';
import { api } from './api';
import { t } from './i18n';

/** Server-generated PDFs. Paths are relative to the API root, e.g. `/documents/invoices/<id>/`. */
export const docPaths = {
  visitRecord: (id: number | string) => `/documents/visit-records/${id}/`,
  labResult: (id: number | string) => `/documents/lab-results/${id}/`,
  labResults: () => '/documents/lab-results/',
  prescription: (id: string, language = 'en') => `/documents/prescriptions/${id}/?language=${encodeURIComponent(language)}`,
  invoice: (id: string) => `/documents/invoices/${id}/`,
  healthCard: () => '/patients/my-card/pdf/',
};

async function errorText(e: any): Promise<string> {
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text());
      if (json?.detail) return t(String(json.detail));
    } catch {
      /* not JSON */
    }
  }
  if (e?.message === 'Network Error') return t('Cannot reach the server. Check your connection.');
  return t('Could not prepare the PDF. Please try again.');
}

/**
 * Fetch an authenticated PDF and open it in a new tab (`view`) or save it.
 * For `view`, the tab is opened synchronously so pop-up blockers allow it.
 */
export async function getPdf(path: string, fileName: string, mode: 'view' | 'download' = 'download') {
  const tab = mode === 'view' ? window.open('', '_blank') : null;
  if (tab) tab.document.title = 'Preparing PDF…';
  try {
    const res = await api.client.client.get(path, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    if (mode === 'view') {
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    return true;
  } catch (e) {
    tab?.close();
    toast.error(await errorText(e));
    return false;
  }
}
