'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { RecentRecord } from '@/types';
import toast from 'react-hot-toast';
import {
  FiX,
  FiDownload,
  FiUser,
  FiCalendar,
  FiClipboard,
  FiFileText,
  FiActivity,
  FiPaperclip,
  FiRefreshCw,
  FiEye,
} from 'react-icons/fi';

interface RecordDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: RecentRecord;
}

const statusConfig = {
  completed: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  follow_up: { label: 'Follow-up Required', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  critical: { label: 'Critical', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
} as const;

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="text-sm text-gray-800 leading-relaxed">{children}</div>
    </div>
  );
}

export function RecordDetailModal({ open, onOpenChange, record }: RecordDetailModalProps) {
  const st = statusConfig[record.status];
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Authenticated download function
  const handleDownloadReport = async (attachmentId: number, fileName: string, isView: boolean = false) => {
    setDownloadingId(attachmentId);
    try {
      const disposition = isView ? 'inline' : 'attachment';
      const blob = await api.medical.downloadReport(attachmentId, disposition);
      
      if (isView) {
        // Open in a new tab for viewing
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      } else {
        // Download the file
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('Report downloaded successfully');
      }
    } catch (error: any) {
      console.error('Download error:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to access this file.');
      } else if (error.response?.status === 404) {
        toast.error('File not found.');
      } else {
        toast.error('Failed to download report.');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const visitDate = new Date(record.visit_date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Visit Record – ${visitDate}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1a1a1a; font-size: 14px; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
            .header h1 { font-size: 20px; color: #1e40af; }
            .header p { color: #6b7280; margin-top: 4px; font-size: 13px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
            .field { }
            .label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
            .value { font-size: 14px; color: #111827; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
            .section-body { font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
            .status { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
            .completed { background: #dcfce7; color: #166534; }
            .follow_up { background: #ffedd5; color: #9a3412; }
            .critical { background: #fee2e2; color: #991b1b; }
            .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Medical Visit Record</h1>
            <p>${visitDate} at ${record.visit_time}</p>
          </div>
          <div class="grid">
            <div class="field"><div class="label">Doctor</div><div class="value">Dr. ${record.doctor_name}</div></div>
            <div class="field"><div class="label">Department</div><div class="value">${record.department}</div></div>
            <div class="field"><div class="label">Status</div><div class="value"><span class="status ${record.status}">${st.label}</span></div></div>
            <div class="field"><div class="label">Prescriptions</div><div class="value">${record.prescriptions_count} item(s)</div></div>
          </div>
          <div class="section"><div class="section-title">Diagnosis</div><div class="section-body">${record.diagnosis_summary}</div></div>
          <div class="section"><div class="section-title">Tests Performed</div><div class="section-body">${record.tests_performed || 'None recorded'}</div></div>
          <div class="section"><div class="section-title">Prescription</div><div class="section-body">${record.prescription_text || 'None'}</div></div>
          ${record.doctor_notes ? `<div class="section"><div class="section-title">Doctor Notes</div><div class="section-body">${record.doctor_notes}</div></div>` : ''}
          <div class="footer">Generated from Health Surveillance Platform</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <Dialog.Title className="text-lg font-bold text-white">
                  Visit Record
                </Dialog.Title>
                <Dialog.Description className="text-blue-100 text-sm mt-0.5">
                  {new Date(record.visit_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}{' '}
                  at {record.visit_time}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="text-white/80 hover:text-white rounded-full p-1 hover:bg-white/10 transition-colors">
                  <FiX className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Meta row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                  <FiUser className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Doctor</p>
                  <p className="text-sm font-semibold text-gray-900">Dr. {record.doctor_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                <div className="bg-purple-50 text-purple-600 p-2 rounded-lg">
                  <FiActivity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Department</p>
                  <p className="text-sm font-semibold text-gray-900">{record.department}</p>
                </div>
              </div>
            </div>

            {/* Status + Rx count */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                {st.label}
              </span>
              <span className="text-xs text-gray-500">
                {record.prescriptions_count} prescription item{record.prescriptions_count !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Clinical sections */}
            <Section icon={FiClipboard} title="Diagnosis">
              {record.diagnosis_summary || 'No diagnosis recorded'}
            </Section>

            {record.tests_performed && (
              <Section icon={FiActivity} title="Tests Performed">
                {record.tests_performed}
              </Section>
            )}

            {record.prescription_text && (
              <Section icon={FiFileText} title="Prescription">
                <pre className="whitespace-pre-wrap font-sans">{record.prescription_text}</pre>
              </Section>
            )}

            {record.doctor_notes && (
              <Section icon={FiFileText} title="Doctor Notes">
                {record.doctor_notes}
              </Section>
            )}

            {/* 📂 Reports Section */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <FiPaperclip className="h-3.5 w-3.5" />
                Reports
                {record.attachments.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 normal-case tracking-normal">
                    {record.attachments.length} {record.attachments.length === 1 ? 'Report' : 'Reports'}
                  </span>
                )}
              </div>
              {record.attachments.length > 0 ? (
                <div className="space-y-2">
                  {record.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-blue-50/40 transition-colors"
                    >
                      <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                        <FiFileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          📄 {att.file_name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {att.uploaded_by_name && (
                            <span className="mr-2">👨‍⚕️ {att.uploaded_by_name}</span>
                          )}
                          📅 {new Date(att.uploaded_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadReport(att.id, att.file_name, true)}
                          disabled={downloadingId === att.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors h-auto"
                          title="View"
                        >
                          {downloadingId === att.id ? (
                            <FiRefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <>🔍 View</>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadReport(att.id, att.file_name, false)}
                          disabled={downloadingId === att.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors h-auto"
                          title="Download"
                        >
                          {downloadingId === att.id ? (
                            <FiRefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <FiDownload className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic py-2">No reports uploaded for this visit</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0">
            <Button
              onClick={handleDownloadPDF}
              className="w-full gap-2"
              size="lg"
            >
              <FiDownload className="h-4 w-4" />
              Download as PDF
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
