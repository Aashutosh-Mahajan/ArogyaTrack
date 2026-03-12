'use client';

import React, { useCallback } from 'react';
import { FiUploadCloud, FiCheckCircle, FiX } from 'react-icons/fi';

interface Props {
  label: string;
  accept?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
}

export default function UploadBox({ label, accept = '.jpg,.jpeg,.png,.pdf', file, onFileChange, error }: Props) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) onFileChange(dropped);
    },
    [onFileChange]
  );

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-teal-400 hover:bg-teal-50/50 ${
            error ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
          }`}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.onchange = (e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) onFileChange(f);
            };
            input.click();
          }}
        >
          <FiUploadCloud className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">
            Drag & drop or <span className="text-teal-600 font-medium">browse</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF (max 5MB)</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <FiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="text-sm text-emerald-800 truncate flex-1">{file.name}</span>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="p-1 rounded-full hover:bg-emerald-100 text-emerald-600"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
