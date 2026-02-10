'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import toast from 'react-hot-toast';
import { FiMail, FiLock } from 'react-icons/fi';
import Link from 'next/link';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type EmailFormData = z.infer<typeof emailSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

export default function DoctorForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const onEmailSubmit = async (data: EmailFormData) => {
    try {
      await api.auth.requestPasswordReset(data.email);
      setEmail(data.email);
      setStep('reset');
      toast.success('OTP sent to your email');
    } catch (error) {
      toast.error('Failed to send OTP');
    }
  };

  const onResetSubmit = async (data: ResetFormData) => {
    try {
      await api.auth.confirmPasswordReset(email, data.otp, data.newPassword);
      toast.success('Password reset successful! You can now login.');
      router.push('/login/doctor');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.otp?.[0] || 
                          error?.response?.data?.detail || 
                          'Password reset failed';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl font-bold">Reset Password</CardTitle>
            <CardDescription>
              {step === 'email' 
                ? 'Enter your email to receive a password reset OTP' 
                : 'Enter the OTP and your new password'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'email' ? (
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...emailForm.register('email')}
                      type="email"
                      placeholder="doctor@example.com"
                      className="pl-10"
                    />
                  </div>
                  {emailForm.formState.errors.email && (
                    <p className="text-sm text-red-600">
                      {emailForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={emailForm.formState.isSubmitting}
                >
                  {emailForm.formState.isSubmitting ? 'Sending...' : 'Send OTP'}
                </Button>

                <div className="text-center text-sm">
                  <Link href="/login/doctor" className="text-blue-600 hover:text-blue-700">
                    Back to login
                  </Link>
                </div>
              </form>
            ) : (
              <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">OTP</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...resetForm.register('otp')}
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className="pl-10 tracking-widest text-center text-lg"
                    />
                  </div>
                  {resetForm.formState.errors.otp && (
                    <p className="text-sm text-red-600">
                      {resetForm.formState.errors.otp.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">New Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...resetForm.register('newPassword')}
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                    />
                  </div>
                  {resetForm.formState.errors.newPassword && (
                    <p className="text-sm text-red-600">
                      {resetForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...resetForm.register('confirmPassword')}
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                    />
                  </div>
                  {resetForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-600">
                      {resetForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={resetForm.formState.isSubmitting}
                >
                  {resetForm.formState.isSubmitting ? 'Resetting...' : 'Reset Password'}
                </Button>

                <div className="text-center text-sm">
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Back to email
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
