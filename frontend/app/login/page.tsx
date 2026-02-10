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

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

type EmailFormData = z.infer<typeof emailSchema>;
type OtpFormData = z.infer<typeof otpSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
  });

  const onEmailSubmit = async (data: EmailFormData) => {
    try {
      await api.auth.sendOtp(data.email);
      setEmail(data.email);
      setStep('otp');
      toast.success('OTP sent to your email');
    } catch (error) {
      toast.error('Failed to send OTP');
    }
  };

  const onOtpSubmit = async (data: OtpFormData) => {
    try {
      const response: any = await api.auth.verifyOtp(email, data.otp);
      setAuth(response.user, {
        access: response.access,
        refresh: response.refresh,
      });
      
      toast.success('Login successful');
      
      // Redirect based on role
      const role = response.user.role;
      if (role === 'doctor') {
        router.push('/doctor');
      } else if (role === 'admin' || role === 'authority') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      toast.error('Invalid OTP');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
            <CardDescription>
              {step === 'email' 
                ? 'Enter your email to receive an OTP' 
                : 'Enter the OTP sent to your email'}
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
                      placeholder="your.email@example.com"
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
                  <span className="text-gray-600">Don't have an account? </span>
                  <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
                    Sign Up
                  </Link>
                </div>
              </form>
            ) : (
              <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">OTP</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...otpForm.register('otp')}
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className="pl-10 tracking-widest text-center text-lg"
                    />
                  </div>
                  {otpForm.formState.errors.otp && (
                    <p className="text-sm text-red-600">
                      {otpForm.formState.errors.otp.message}
                    </p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={otpForm.formState.isSubmitting}
                >
                  {otpForm.formState.isSubmitting ? 'Verifying...' : 'Verify OTP'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep('email')}
                >
                  Back to Email
                </Button>
              </form>
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
