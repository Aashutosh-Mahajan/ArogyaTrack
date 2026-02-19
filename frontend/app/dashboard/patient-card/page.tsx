'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { withAuth } from '@/components/auth/withAuth';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { PatientCard } from '@/types';
import { FiDownload, FiUser, FiCamera, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';
import styles from './PatientCard.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ── Static Data for Visuals ──
const QR_DATA = [
  [1, 1, 1, 0, 1, 1, 1],
  [1, 0, 1, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [0, 0, 0, 1, 0, 0, 0],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 1, 0, 1],
  [1, 1, 1, 0, 1, 1, 1],
];

const BARCODE_PATTERN = [2, 1, 3, 1, 2, 4, 1, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 2, 1, 2, 3, 1, 2];

function PatientCardPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isFlipped, setIsFlipped] = useState(false);

  const { data: card, isLoading, error } = useQuery<PatientCard>({
    queryKey: ['patient-card'],
    queryFn: () => api.patients.getPatientCard() as Promise<PatientCard>,
  });

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a JPG or PNG image');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      await api.patients.uploadCardPhoto(file);
      toast.success('Profile photo uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: ['patient-card'] });
    } catch (err: any) {
      console.error('Photo upload error:', err);
      toast.error(err?.response?.data?.detail || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const stored = localStorage.getItem('auth-storage');
      const tokens = stored ? JSON.parse(stored) : null;
      const accessToken = tokens?.state?.tokens?.access;

      if (!accessToken) {
        toast.error('Please login again to download');
        return;
      }

      const response = await axios.get(`${API_URL}/patients/my-card/pdf/`, {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patient_card_${card?.unique_patient_id || 'card'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Card downloaded successfully!');
    } catch (err: any) {
      console.error('PDF download error:', err);
      toast.error(err?.response?.data?.detail || 'Failed to download card');
    }
  };

  if (isLoading) {
    return (

      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="loading-dots"><span></span><span></span><span></span></div>
      </div>

    );
  }

  if (error || !card) {
    return (

      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
          <FiAlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <p className="text-gray-600 font-medium">No patient card found.</p>
          <p className="text-gray-500 text-sm mt-2">Please complete your profile to generate your card.</p>
        </div>
      </div>

    );
  }

  return (

    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Patient Card</h1>
          <p className="text-gray-600 mt-1">Your official national health digital identity</p>
        </div>
        <Button onClick={handleDownloadPDF} className="flex items-center gap-2 shadow-sm">
          <FiDownload className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {/* Card Container - Centered & Animated */}
      <div className="flex justify-center my-8">
        <div className={styles.cardContainer}>
          <div className={styles.scene} onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`${styles.card} ${isFlipped ? styles.isFlipped : ''}`}>

              {/* ════════════ FRONT CARD ════════════ */}
              <div className={`${styles.cardFace} ${styles.cardFront}`}>

                {/* ECG Line */}
                <svg className={styles.ecgLine} viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polyline points="0,15 20,15 28,5 34,25 40,10 46,20 52,15 80,15 88,5 94,25 100,10 106,20 112,15 160,15"
                    stroke="white" strokeWidth="1.5" fill="none" />
                </svg>

                {/* Header */}
                <div className={styles.frontHeader}>
                  <div className={styles.shieldIcon}>
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.5C16.5 21.15 20 16.25 20 11V5L12 2zm-1 13l-3-3 1.4-1.4L11 12.2l4.6-4.6L17 9l-6 6z" />
                    </svg>
                  </div>
                  <div className={styles.brandText}>
                    <h1>AROGYA<span>TRACK</span></h1>
                    <p>National Health Surveillance</p>
                  </div>
                </div>

                {/* Body */}
                <div className={styles.frontBody}>
                  {/* Avatar */}
                  <div
                    className={`group ${styles.avatarWrap} cursor-pointer relative`}
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    {card.profile_photo_url ? (
                      <img src={card.profile_photo_url} alt="Profile" />
                    ) : (
                      <FiUser className="text-white/90 w-12 h-12" />
                    )}
                    {/* Upload Overlay */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <FiCamera className="text-white w-6 h-6" />
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handlePhotoUpload}
                      onClick={(e) => e.stopPropagation()}
                      className="hidden"
                    />
                  </div>

                  {/* Info */}
                  <div className={styles.infoBlock}>
                    <div className={styles.name}>{card.name}</div>
                    <div className={styles.infoRow}><strong>ID:</strong> {card.unique_patient_id}</div>
                    <div className={styles.infoRow}>
                      <span className={styles.bloodDot}></span>
                      <span>Blood Group:</span>
                      <span className={styles.bloodText}>{card.blood_group}</span>
                    </div>
                    <div className={styles.infoRow}><strong>DOB:</strong> {card.date_of_birth ? new Date(card.date_of_birth).toLocaleDateString('en-IN') : 'N/A'}</div>
                    <div className={styles.infoRow}><strong>Addr:</strong> {card.district || card.address || 'N/A'}</div>
                    <div className={styles.infoRow} style={{ color: '#c0392b', fontWeight: 'bold' }}>
                      <span>EMG:</span> +91-90001 11222
                    </div>
                  </div>

                  {/* QR */}
                  <div className={styles.qrBlock}>
                    <div className={styles.qrFrame}>
                      {/* If real QR URL exists, show it. Otherwise show decorative grid */}
                      {card.qr_code_url ? (
                        <img src={card.qr_code_url} alt="QR Code" />
                      ) : (
                        QR_DATA.map((row, rIndex) => (
                          row.map((cell, cIndex) => (
                            <div
                              key={`${rIndex}-${cIndex}`}
                              className={cell ? styles.qrCell : `${styles.qrCell} ${styles.qrCellDark}`}
                            />
                          ))
                        ))
                      )}
                    </div>
                    <div className={styles.qrLabel}>Scan for<br />Medical History</div>
                  </div>
                </div>

                {/* Issue Strip */}
                <div className={styles.issueStrip}>
                  <span>Date of Issue: <strong>{new Date().toLocaleDateString('en-IN')}</strong></span>
                  <span>ID: <strong>{card.unique_patient_id}</strong></span>
                </div>

                {/* Emergency */}
                <div className={styles.emergencyStrip}>
                  <span className={styles.label}>Emergency Contact:</span>
                  <span className={styles.number}>+91-90001 11222</span>
                </div>

                {/* Footer */}

                {/* Footer */}
                <div className={styles.frontFooter}>
                  <div className={styles.helpline}>
                    <div className={styles.helplineIcon}>
                      <svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
                    </div>
                    <span>National Health Helpline: <strong>1001</strong></span>
                  </div>

                  <div className={styles.verifiedBadge}>
                    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                    <span>Verified by<br />ArogyaTrack</span>
                  </div>
                </div>
              </div>


              {/* ════════════ BACK CARD ════════════ */}
              <div className={`${styles.cardFace} ${styles.cardBack}`}>

                <svg className={styles.ecgLine} viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polyline points="0,15 20,15 28,5 34,25 40,10 46,20 52,15 80,15 88,5 94,25 100,10 106,20 112,15 160,15"
                    stroke="white" strokeWidth="1.5" fill="none" />
                </svg>

                {/* Header */}
                <div className={styles.backHeader}>
                  <div className={styles.shieldIcon}>
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.5C16.5 21.15 20 16.25 20 11V5L12 2zm-1 13l-3-3 1.4-1.4L11 12.2l4.6-4.6L17 9l-6 6z" />
                    </svg>
                  </div>
                  <div className={styles.brandText}>
                    <h1>AROGYA<span>TRACK</span></h1>
                    <p>National Health Surveillance</p>
                  </div>
                </div>

                {/* Terms Body */}
                <div className={styles.termsBody}>
                  <div className={styles.termsCol}>
                    <h3>Terms & Conditions</h3>
                    <ul>
                      <li>This card is property of the Government of India and is non-transferable.</li>
                      <li>Misuse of this card is punishable under applicable laws.</li>
                      <li>Cardholder is responsible for maintaining confidentiality of data.</li>
                      <li>Report lost or stolen card immediately to the National Health Helpline.</li>
                    </ul>
                  </div>
                  <div className={styles.termsCol}>
                    <h3>Regulations</h3>
                    <ul>
                      <li>Presentation of this card is mandatory for accessing subsidized health services.</li>
                      <li>Updates to personal information must be reported within 30 days.</li>
                      <li>Data collected is for national health surveillance and public health purposes only.</li>
                    </ul>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className={styles.disclaimerStrip}>
                  <span className={styles.discLabel}>DISCLAIMER:</span>
                  <p>This card does not guarantee medical treatment. Services are subject to availability and government policy.</p>
                </div>

                {/* Back Footer */}
                <div className={styles.backFooter}>
                  <div className={styles.issuer}>
                    <div className={styles.emblem}>🏛</div>
                    <div className={styles.issuerText}>
                      Issued by
                      <strong>Ministry of Health & Family Welfare,</strong>
                      Government of India.
                    </div>
                  </div>

                  <div className={styles.barcodeWrap}>
                    <div className={styles.barcode}>
                      {BARCODE_PATTERN.map((width, idx) => (
                        <div
                          key={idx}
                          className={styles.bar}
                          style={{ width: `${width * 1.5}px` }}
                        />
                      ))}
                    </div>
                    <div className={styles.barcodeNum}>AT-GOV-IND-SEQ-998877</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>



    </div>

  );
}

export default withAuth(PatientCardPage, ['patient']);
