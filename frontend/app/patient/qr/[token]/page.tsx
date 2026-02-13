'use client';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FiShield, FiLogIn } from 'react-icons/fi';
import Link from 'next/link';

/**
 * QR Scan Landing Page: /patient/qr/[token]/
 *
 * When a doctor scans a patient's QR code, this page is loaded.
 * - If the user is an authenticated doctor → redirect to doctor scan results
 * - If not authenticated → show login prompt
 * - If not a doctor → show 403 forbidden
 */
export default function QRScanLandingPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  const token = params.token as string;

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'doctor') {
        // Doctor is authenticated – redirect to scanner with pre-filled token
        // Store token in sessionStorage so the scan-qr page can pick it up
        sessionStorage.setItem('qr_scan_token', token);
        router.push('/doctor/scan-qr');
      }
    }
  }, [isAuthenticated, user, token, router]);

  // Doctor authenticated – show redirecting
  if (isAuthenticated && user?.role === 'doctor') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="loading-dots"><span></span><span></span><span></span></div>
            <p className="mt-4 text-gray-600">Redirecting to patient records...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Non-doctor authenticated user
  if (isAuthenticated && user?.role !== 'doctor') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardHeader className="text-center">
            <div className="w-14 h-14 mx-auto mb-2 rounded-xl bg-red-100 flex items-center justify-center">
              <FiShield className="h-7 w-7 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Only authorized doctors can access patient records via QR scan.
            </p>
            <Link href="/dashboard">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated – prompt login
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="w-14 h-14 mx-auto mb-2 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiShield className="h-7 w-7 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Patient QR Verification</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            This QR code links to a patient's health records. 
            Please sign in with a <strong>doctor account</strong> to access the records.
          </p>
          <Link href="/login">
            <Button className="w-full" size="lg">
              <FiLogIn className="mr-2 h-4 w-4" />
              Sign In as Doctor
            </Button>
          </Link>
          <p className="text-xs text-gray-400">
            Health Surveillance System • Secure & Tamper-proof
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
