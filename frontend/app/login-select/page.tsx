'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FiBriefcase, FiUser, FiShield } from 'react-icons/fi';
import Link from 'next/link';

export default function LoginLandingPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome Back</h1>
          <p className="text-gray-600">Select your account type to login</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Doctor Login */}
          <Card 
            className="shadow-xl hover:shadow-2xl transition-all cursor-pointer border-2 hover:border-blue-500"
            onClick={() => router.push('/login/doctor')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-blue-100 rounded-full">
                  <FiBriefcase className="w-10 h-10 text-blue-600" />
                </div>
              </div>
              <CardTitle className="text-xl">Doctor Login</CardTitle>
              <CardDescription>
                Healthcare professionals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => router.push('/login/doctor')}>
                Login as Doctor
              </Button>
            </CardContent>
          </Card>

          {/* Patient Login */}
          <Card 
            className="shadow-xl hover:shadow-2xl transition-all cursor-pointer border-2 hover:border-green-500"
            onClick={() => router.push('/login/patient')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-green-100 rounded-full">
                  <FiUser className="w-10 h-10 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-xl">Patient Login</CardTitle>
              <CardDescription>
                Patients and individuals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => router.push('/login/patient')}>
                Login as Patient
              </Button>
            </CardContent>
          </Card>

          {/* Admin Login */}
          <Card 
            className="shadow-xl hover:shadow-2xl transition-all cursor-pointer border-2 hover:border-purple-500"
            onClick={() => router.push('/login/admin')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-purple-100 rounded-full">
                  <FiShield className="w-10 h-10 text-purple-600" />
                </div>
              </div>
              <CardTitle className="text-xl">Admin Login</CardTitle>
              <CardDescription>
                System administrators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => router.push('/login/admin')}>
                Login as Admin
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-6">
          <span className="text-gray-600">Don't have an account? </span>
          <Link href="/signup-select" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
