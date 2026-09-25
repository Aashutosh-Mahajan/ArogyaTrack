/**
 * Saving files fetched from the API. Documents (visit records, lab results,
 * prescriptions, invoices, the health card) are generated as PDFs on the
 * server — see `lib/documents.ts`.
 */

/** Open a fetched blob in a new tab or save it under `fileName`. */
export function openBlob(blob: Blob, fileName: string, mode: 'view' | 'download') {
  const url = window.URL.createObjectURL(blob);
  if (mode === 'view') {
    window.open(url, '_blank');
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
