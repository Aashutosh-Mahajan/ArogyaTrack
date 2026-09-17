import React, { useState } from 'react';

const UploadBox = ({ label, hint = "PDF/JPG/PNG — max 5MB", required = false }) => {
  const [file, setFile] = useState(null);

  const handleUpload = (e) => {
    // Mock upload behavior
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0].name);
    }
  };

  return (
    <div className="w-full mb-6">
      <label className="block text-sm font-semibold text-[#2F3A3A] mb-2">
        {label} {required && <span className="text-[#ef4444]">*</span>}
      </label>
      
      {!file ? (
        <div 
          className="border-2 border-dashed border-[#D9E5E3] rounded-xl p-7 bg-[#EEF3F2] text-center transition-all duration-200 hover:border-[#1F6F6A] hover:bg-[#EEF5F4] cursor-pointer relative group"
          onClick={() => document.getElementById(`upload-${label}`).click()}
        >
          <input 
            type="file" 
            id={`upload-${label}`} 
            className="hidden" 
            onChange={handleUpload} 
            accept=".pdf,.jpg,.jpeg,.png"
          />
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-[#1F6F6A] mb-3 group-hover:-translate-y-1 transition-transform"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          <p className="text-sm font-medium text-[#1F6F6A] mb-1">Drag & drop or click to upload</p>
          <p className="text-xs text-[#9CA8A8]">{hint}</p>
        </div>
      ) : (
        <div className="border border-[#D9E5E3] rounded-xl p-4 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-[#1F6F6A]"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>
            <span className="text-sm font-medium text-[#2F3A3A] truncate max-w-[200px]">{file}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setFile(null)}
            className="flex items-center gap-1 text-xs font-semibold text-[#ef4444] hover:underline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
             Remove
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadBox;
