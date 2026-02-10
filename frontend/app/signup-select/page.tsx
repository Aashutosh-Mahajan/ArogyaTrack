'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FiBriefcase, FiUser } from 'react-icons/fi';
import Link from 'next/link';

export default function SignupLandingPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Join Our Healthcare Platform</h1>
          <p className="text-gray-600">Choose your account type to get started</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Doctor Card */}
          <Card 
            className="shadow-xl hover:shadow-2xl transition-all cursor-pointer border-2 hover:border-blue-500"
            onClick={() => router.push('/signup/doctor')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-blue-100 rounded-full">
                  <FiBriefcase className="w-12 h-12 text-blue-600" />
                </div>
              </div>
              <CardTitle className="text-2xl">Doctor Registration</CardTitle>
              <CardDescription className="text-base">
                For healthcare professionals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Access patient records securely</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Create and manage prescriptions</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Track patient health metrics</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>QR code patient verification</span>
                </li>
              </ul>
              <Button className="w-full" onClick={() => router.push('/signup/doctor')}>
                Register as Doctor
              </Button>
            </CardContent>
          </Card>

          {/* Patient Card */}
          <Card 
            className="shadow-xl hover:shadow-2xl transition-all cursor-pointer border-2 hover:border-green-500"
            onClick={() => router.push('/signup/patient')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-green-100 rounded-full">
                  <FiUser className="w-12 h-12 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-2xl">Patient Registration</CardTitle>
              <CardDescription className="text-base">
                For patients and individuals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Manage your medical records</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Digital health card with QR code</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Track medications and prescriptions</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>View test results and history</span>
                </li>
              </ul>
              <Button className="w-full" onClick={() => router.push('/signup/patient')}>
                Register as Patient
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-6">
          <span className="text-gray-600">Already have an account? </span>
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
