'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff, FiCheckCircle, FiClock } from 'react-icons/fi';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      console.log('Login attempt:', { email: data.email, passwordLength: data.password.length });
      const response: any = await api.auth.login(data.email, data.password);

      setAuth(response.user, {
        access: response.access,
        refresh: response.refresh,
      });

      toast.success('Login successful!');

      // Role-based redirect
      const role = response.user.role;
      if (role === 'doctor') {
        router.push('/doctor');
      } else if (role === 'admin' || role === 'authority') {
        router.push('/admin');
      } else if (role === 'pharmacist') {
        router.push('/pharmacy');
      } else {
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', {
        status: error?.response?.status,
        data: error?.response?.data,
        fullError: error
      });
      const msg =
        error?.response?.data?.non_field_errors?.[0] ||
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        'Invalid email or password';
      toast.error(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <span className="text-2xl text-white">🏥</span>
            </div>
            <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Status messages */}
            {message === 'verified' && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                <FiCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800">Email verified successfully! You can now sign in.</p>
              </div>
            )}
            {message === 'doctor_verified' && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <FiClock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">Email verified! Your doctor profile is under review. You&apos;ll be notified once approved.</p>
              </div>
            )}
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    {...form.register('email')}
                    type="email"
                    placeholder="your.email@example.com"
                    className="pl-10"
                    autoComplete="email"
                  />
                </div>
                {form.formState.errors.email && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Password</label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    {...form.register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Signing In...' : 'Sign In'}
              </Button>

              {/* Sign up link */}
              <div className="text-center text-sm">
                <span className="text-gray-600">Don&apos;t have an account? </span>
                <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
                  Create Account
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
