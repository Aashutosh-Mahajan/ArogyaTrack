'use client';

import React, { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { FiX, FiDownload, FiUser, FiPhone, FiHeart, FiCreditCard } from 'react-icons/fi';
import { Button } from '@/components/ui/button';

interface EmergencyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  healthId: string | null;
  bloodGroup: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  patientName: string;
}

export function EmergencyModal({
  open,
  onOpenChange,
  healthId,
  bloodGroup,
  emergencyContactName,
  emergencyContactPhone,
  emergencyContactRelationship,
  patientName,
}: EmergencyModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = () => {
    // Build a printable HTML document and trigger browser print-to-PDF
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Emergency Card – ${patientName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1a1a1a; }
            .card { border: 2px solid #dc2626; border-radius: 12px; max-width: 420px; margin: 0 auto; overflow: hidden; }
            .header { background: #dc2626; color: white; padding: 16px 24px; text-align: center; }
            .header h1 { font-size: 18px; font-weight: 700; }
            .header p { font-size: 12px; opacity: 0.9; margin-top: 4px; }
            .body { padding: 24px; }
            .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
            .row:last-child { border-bottom: none; }
            .label { font-size: 13px; color: #6b7280; font-weight: 500; }
            .value { font-size: 14px; font-weight: 600; text-align: right; }
            .blood { color: #dc2626; font-size: 18px; }
            .footer { text-align: center; padding: 12px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>EMERGENCY HEALTH CARD</h1>
              <p>${patientName}</p>
            </div>
            <div class="body">
              <div class="row">
                <span class="label">Health ID</span>
                <span class="value">${healthId || 'N/A'}</span>
              </div>
              <div class="row">
                <span class="label">Blood Group</span>
                <span class="value blood">${bloodGroup || 'N/A'}</span>
              </div>
              <div class="row">
                <span class="label">Emergency Contact</span>
                <span class="value">${emergencyContactName || 'N/A'}</span>
              </div>
              <div class="row">
                <span class="label">Phone</span>
                <span class="value">${emergencyContactPhone || 'N/A'}</span>
              </div>
              <div class="row">
                <span class="label">Relationship</span>
                <span class="value">${emergencyContactRelationship || 'N/A'}</span>
              </div>
            </div>
            <div class="footer">Generated from Health Surveillance Platform</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const rows = [
    {
      icon: FiCreditCard,
      label: 'Health ID',
      value: healthId,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: FiHeart,
      label: 'Blood Group',
      value: bloodGroup,
      color: 'text-red-600',
      bg: 'bg-red-50',
      highlight: true,
    },
    {
      icon: FiUser,
      label: 'Emergency Contact',
      value: emergencyContactName,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      icon: FiPhone,
      label: 'Phone',
      value: emergencyContactPhone,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* Header */}
          <div className="bg-red-600 px-6 py-5 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <Dialog.Title className="text-lg font-bold text-white">
                  Emergency Health Card
                </Dialog.Title>
                <Dialog.Description className="text-red-100 text-sm mt-0.5">
                  Critical health information for emergencies
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="text-white/80 hover:text-white transition-colors rounded-full p-1 hover:bg-white/10">
                  <FiX className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div ref={contentRef} className="p-6 space-y-3">
            {rows.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className={`${row.bg} ${row.color} p-2.5 rounded-lg`}>
                  <row.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {row.label}
                  </p>
                  <p
                    className={`text-sm font-semibold mt-0.5 truncate ${
                      row.highlight ? 'text-red-600 text-base' : 'text-gray-900'
                    }`}
                  >
                    {row.value || 'N/A'}
                  </p>
                </div>
              </div>
            ))}

            {emergencyContactRelationship && (
              <div className="flex items-center gap-4 p-3 rounded-xl border border-gray-100">
                <div className="bg-amber-50 text-amber-600 p-2.5 rounded-lg">
                  <FiUser className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Relationship
                  </p>
                  <p className="text-sm font-semibold mt-0.5 text-gray-900">
                    {emergencyContactRelationship}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <Button
              onClick={handleDownloadPDF}
              className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
              size="lg"
            >
              <FiDownload className="h-4 w-4" />
              Download Emergency Card (PDF)
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
