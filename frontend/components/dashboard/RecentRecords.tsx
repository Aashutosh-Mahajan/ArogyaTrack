'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RecentRecord } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RecordDetailModal } from '@/components/dashboard/RecordDetailModal';
import {
  FiActivity,
  FiChevronDown,
  FiChevronUp,
  FiEye,
  FiDownload,
  FiCalendar,
  FiUser,
  FiClipboard,
  FiFileText,
  FiAlertCircle,
} from 'react-icons/fi';
import Link from 'next/link';

/* ─── Status badge config ──────────────────────────────────────── */
const statusConfig = {
  completed: {
    label: 'Completed',
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  follow_up: {
    label: 'Follow-up',
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  critical: {
    label: 'Critical',
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
} as const;

/* ─── Single record card ───────────────────────────────────────── */
function RecordCard({ record }: { record: RecentRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const st = statusConfig[record.status];

  const visitDate = new Date(record.visit_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const handleDownloadPDF = () => {
    // re-use the modal's print-to-PDF approach in a lightweight way
    setModalOpen(true);
  };

  return (
    <>
      <div
        className={`rounded-xl border transition-all duration-200 hover:shadow-md ${
          record.status === 'critical'
            ? 'border-red-200 bg-red-50/30'
            : 'border-gray-100 bg-white'
        }`}
      >
        {/* Main row */}
        <div className="p-4 flex items-start gap-4">
          {/* Left icon */}
          <div className="hidden sm:flex bg-blue-50 text-blue-600 rounded-xl p-2.5 mt-0.5 shrink-0">
            <FiActivity className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Top line */}
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {record.diagnosis_summary}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <FiUser className="h-3 w-3" />
                    Dr. {record.doctor_name}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>{record.department}</span>
                  <span className="text-gray-300">•</span>
                  <span className="inline-flex items-center gap-1">
                    <FiCalendar className="h-3 w-3" />
                    {visitDate}, {record.visit_time}
                  </span>
                </div>
              </div>

              {/* Status badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${st.bg} ${st.text} ${st.border}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                {st.label}
              </span>
            </div>

            {/* Summary pills */}
            <div className="flex items-center gap-3 mt-2.5 flex-wrap">
              {record.tests_performed && (
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                  <FiClipboard className="h-3 w-3" />
                  Tests: {record.tests_performed.split('\n')[0].slice(0, 40)}
                  {record.tests_performed.length > 40 ? '…' : ''}
                </span>
              )}
              {record.prescriptions_count > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                  <FiFileText className="h-3 w-3" />
                  {record.prescriptions_count} prescription{record.prescriptions_count !== 1 ? 's' : ''}
                </span>
              )}
              {record.attachments.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                  📎 {record.attachments.length} file{record.attachments.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-blue-600"
              onClick={() => setModalOpen(true)}
              title="View details"
            >
              <FiEye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
              onClick={() => setExpanded((prev) => !prev)}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? (
                <FiChevronUp className="h-4 w-4" />
              ) : (
                <FiChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Expanded section */}
        {expanded && (
          <div className="px-4 pb-4 pt-0 border-t border-gray-100 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Diagnosis */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Diagnosis
                </p>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {record.diagnosis_summary || 'N/A'}
                </p>
              </div>

              {/* Tests */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Tests Performed
                </p>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {record.tests_performed || 'None'}
                </p>
              </div>

              {/* Prescription */}
              {record.prescription_text && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Prescription
                  </p>
                  <pre className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">
                    {record.prescription_text}
                  </pre>
                </div>
              )}

              {/* Doctor Notes */}
              {record.doctor_notes && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Doctor Notes
                  </p>
                  <p className="text-sm text-gray-800 leading-relaxed italic">
                    {record.doctor_notes}
                  </p>
                </div>
              )}
            </div>

            {/* Attachment links */}
            {record.attachments.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Attachments
                </p>
                <div className="flex flex-wrap gap-2">
                  {record.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-xs text-blue-600 font-medium transition-colors"
                    >
                      <FiDownload className="h-3 w-3" />
                      {att.file_name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Download PDF */}
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setModalOpen(true)}
              >
                <FiDownload className="h-3.5 w-3.5" />
                Download PDF
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <RecordDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        record={record}
      />
    </>
  );
}

/* ─── Main component ───────────────────────────────────────────── */
export function RecentRecords() {
  const { data: records, isLoading } = useQuery<RecentRecord[]>({
    queryKey: ['dashboard-recent-records'],
    queryFn: () => api.dashboard.getRecentRecords({ limit: 10 }),
    staleTime: 60_000,
  });

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Medical Records</CardTitle>
          <Link
            href="/dashboard/medical-records"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            View All
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-gray-100 p-4"
              >
                <div className="flex gap-4">
                  <div className="hidden sm:block h-10 w-10 bg-gray-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-gray-200 rounded" />
                    <div className="h-3 w-64 bg-gray-100 rounded" />
                    <div className="h-3 w-32 bg-gray-100 rounded" />
                  </div>
                  <div className="h-6 w-20 bg-gray-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : records && records.length > 0 ? (
          records.map((record) => <RecordCard key={record.id} record={record} />)
        ) : (
          <div className="text-center py-12 text-gray-500">
            <FiAlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No medical records yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Your visit records will appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
