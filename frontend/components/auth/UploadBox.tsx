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
      <label className="block text-sm font-medium text-foreground/80 mb-1">{label}</label>
      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-primary/60 hover:bg-primary/8 ${
            error ? 'border-red-400 bg-red-50/30' : 'border-border'
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
          <FiUploadCloud className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Drag & drop or <span className="text-primary font-medium">browse</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF (max 5MB)</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-primary/8 border border-emerald-200 rounded-xl">
          <FiCheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="text-sm text-primary truncate flex-1">{file.name}</span>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="p-1 rounded-full hover:bg-primary/12 text-primary"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
