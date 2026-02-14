'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { PatientCard } from '@/types';
import { FiDownload, FiUser, FiDroplet, FiCalendar, FiMapPin, FiHash, FiCamera, FiUpload } from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function PatientCardPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

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
      // Refetch the card data to get the new photo URL
      queryClient.invalidateQueries({ queryKey: ['patient-card'] });
    } catch (err: any) {
      console.error('Photo upload error:', err);
      toast.error(err?.response?.data?.detail || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadPDF = async () => {
    try {
      // Get auth token from zustand persist storage
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
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="loading-dots"><span></span><span></span><span></span></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !card) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              <FiUser className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">No patient card found. Please complete your profile first.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Patient Card</h1>
            <p className="text-gray-600 mt-1">Your secure digital health identity</p>
          </div>
          <Button onClick={handleDownloadPDF} className="flex items-center gap-2">
            <FiDownload className="h-4 w-4" />
            Download Card
          </Button>
        </div>

        {/* Digital Card */}
        <Card className="overflow-hidden shadow-xl border-0">
          {/* Card Header - Blue Gradient */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-xs font-medium tracking-widest uppercase">
                  Health Surveillance System
                </p>
                <h2 className="text-2xl font-bold mt-1">{card.name}</h2>
                <p className="text-blue-100 text-sm mt-1">Digital Patient Card</p>
              </div>
              {/* Profile Photo */}
              <div className="relative">
                {card.profile_photo_url ? (
                  <img
                    src={card.profile_photo_url}
                    alt="Profile"
                    className="w-24 h-24 rounded-lg object-cover border-4 border-white/30 shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30">
                    <FiUser className="w-12 h-12 text-white/70" />
                  </div>
                )}
                {/* Upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute -bottom-2 -right-2 bg-white text-blue-600 rounded-full p-2 shadow-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                  title="Upload photo"
                >
                  {isUploading ? (
                    <div className="loading-dots small"><span></span><span></span><span></span></div>
                  ) : (
                    <FiCamera className="w-4 h-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left - Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <FiHash className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Patient ID</p>
                    <p className="text-sm font-bold text-gray-900 font-mono">
                      {card.unique_patient_id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-red-100 p-2 rounded-lg">
                    <FiDroplet className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Blood Group</p>
                    <p className="text-sm font-bold text-gray-900">{card.blood_group}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <FiCalendar className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Date of Birth</p>
                    <p className="text-sm font-bold text-gray-900">
                      {card.date_of_birth
                        ? new Date(card.date_of_birth).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <FiMapPin className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">District</p>
                    <p className="text-sm font-bold text-gray-900">
                      {card.district || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right - QR Code */}
              <div className="flex flex-col items-center justify-center">
                {card.qr_code_url ? (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-3 shadow-inner">
                    <img
                      src={card.qr_code_url}
                      alt="Patient QR Code"
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-xl p-8 text-center">
                    <p className="text-gray-400 text-sm">QR Code generating...</p>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Scan to verify patient identity
                </p>
              </div>
            </div>
          </CardContent>

          {/* Card Footer */}
          <div className="bg-gray-50 px-6 py-3 border-t">
            <p className="text-xs text-gray-400 text-center">
              This is a tamper-proof digital card • QR code is permanently linked to your identity
            </p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(PatientCardPage, ['patient']);
