'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import toast from 'react-hot-toast';
import { FiMail, FiLock } from 'react-icons/fi';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function PatientLoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onLoginSubmit = async (data: LoginFormData) => {
    try {
      const response: any = await api.auth.login(data.email, data.password);
      
      // Verify role is patient
      if (response.user.role !== 'patient') {
        toast.error('Invalid credentials for patient login');
        return;
      }

      setAuth(response.user, {
        access: response.access,
        refresh: response.refresh,
      });
      
      toast.success('Login successful');
      router.push('/dashboard');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.non_field_errors?.[0] || 
                          error?.response?.data?.detail || 
                          'Invalid email or password';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl font-bold">Patient Login</CardTitle>
            <CardDescription>
              Sign in to your patient account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    {...loginForm.register('email')}
                    type="email"
                    placeholder="patient@example.com"
                    className="pl-10"
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-red-600">
                    {loginForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    {...loginForm.register('password')}
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                  />
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-red-600">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="text-right">
                <Link href="/forgot-password/patient" className="text-sm text-blue-600 hover:text-blue-700">
                  Forgot password?
                </Link>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={loginForm.formState.isSubmitting}
              >
                {loginForm.formState.isSubmitting ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="text-center text-sm space-y-2">
                <div>
                  <span className="text-gray-600">Don't have an account? </span>
                  <Link href="/signup/patient" className="text-blue-600 hover:text-blue-700 font-medium">
                    Register
                  </Link>
                </div>
                <div>
                  <Link href="/login/doctor" className="text-gray-600 hover:text-gray-700">
                    Login as Doctor
                  </Link>
                  {' | '}
                  <Link href="/login/admin" className="text-gray-600 hover:text-gray-700">
                    Admin Login
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
