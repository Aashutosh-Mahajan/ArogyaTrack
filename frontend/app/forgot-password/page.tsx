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
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
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
  path: ['confirmPassword'],
});

type EmailFormData = z.infer<typeof emailSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'reset' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
      toast.success('If the email exists, an OTP has been sent.');
    } catch (error) {
      // Still show success to prevent email enumeration
      setEmail(data.email);
      setStep('reset');
      toast.success('If the email exists, an OTP has been sent.');
    }
  };

  const onResetSubmit = async (data: ResetFormData) => {
    try {
      await api.auth.confirmPasswordReset(email, data.otp, data.newPassword);
      setStep('success');
      toast.success('Password reset successful!');
    } catch (error: any) {
      const msg =
        error?.response?.data?.otp?.[0] ||
        error?.response?.data?.detail ||
        'Password reset failed. Please try again.';
      toast.error(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl font-bold">
              {step === 'success' ? 'Password Reset!' : 'Reset Password'}
            </CardTitle>
            <CardDescription>
              {step === 'email' && 'Enter your email to receive a reset code'}
              {step === 'reset' && 'Enter the code and set your new password'}
              {step === 'success' && 'Your password has been changed successfully'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'email' && (
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...emailForm.register('email')}
                      type="email"
                      placeholder="your.email@example.com"
                      className="pl-10"
                      autoComplete="email"
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
                  {emailForm.formState.isSubmitting ? 'Sending...' : 'Send Reset Code'}
                </Button>
                <div className="text-center text-sm">
                  <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
                    <FiArrowLeft className="w-3 h-3" /> Back to Sign In
                  </Link>
                </div>
              </form>
            )}

            {step === 'reset' && (
              <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                <div className="text-center mb-2">
                  <p className="text-sm text-gray-500">
                    Code sent to <span className="font-semibold text-gray-700">{email}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Verification Code</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...resetForm.register('otp')}
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className="pl-10 tracking-[0.3em] text-center text-lg font-mono"
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
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                  {resetForm.formState.errors.newPassword && (
                    <p className="text-sm text-red-600">
                      {resetForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm New Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...resetForm.register('confirmPassword')}
                      type={showPassword ? 'text' : 'password'}
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

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep('email')}
                >
                  <FiArrowLeft className="mr-2" /> Back
                </Button>
              </form>
            )}

            {step === 'success' && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                  <FiCheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-gray-600 text-sm">
                  Your password has been reset. You can now sign in with your new password.
                </p>
                <Button className="w-full" onClick={() => router.push('/login')}>
                  Go to Sign In
                </Button>
              </div>
            )}
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
