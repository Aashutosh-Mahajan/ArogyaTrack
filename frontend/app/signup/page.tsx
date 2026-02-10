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
import { FiMail, FiUser, FiPhone, FiMapPin, FiLock, FiCalendar } from 'react-icons/fi';
import Link from 'next/link';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

type SignupFormData = z.infer<typeof signupSchema>;
type OtpFormData = z.infer<typeof otpSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'signup' | 'otp'>('signup');
  const [signupData, setSignupData] = useState<SignupFormData | null>(null);

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
  });

  const onSignupSubmit = async (data: SignupFormData) => {
    try {
      // Send registration request
      await api.auth.register({
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        phone_number: data.phone,
        date_of_birth: data.dateOfBirth,
        address: data.address,
      });
      
      setSignupData(data);
      setStep('otp');
      toast.success('OTP sent to your email');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || 'Registration failed';
      toast.error(errorMessage);
    }
  };

  const onOtpSubmit = async (data: OtpFormData) => {
    if (!signupData) return;
    
    try {
      // Verify OTP and complete registration
      await api.auth.verifyRegistration(signupData.email, data.otp);
      
      toast.success('Registration successful! Please sign in.');
      router.push('/login');
    } catch (error) {
      toast.error('Invalid OTP. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl font-bold">Create Account</CardTitle>
            <CardDescription>
              {step === 'signup' 
                ? 'Fill in your details to get started' 
                : 'Enter the OTP sent to your email to verify your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'signup' ? (
              <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        {...signupForm.register('firstName')}
                        type="text"
                        placeholder="John"
                        className="pl-10"
                      />
                    </div>
                    {signupForm.formState.errors.firstName && (
                      <p className="text-sm text-red-600">
                        {signupForm.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        {...signupForm.register('lastName')}
                        type="text"
                        placeholder="Doe"
                        className="pl-10"
                      />
                    </div>
                    {signupForm.formState.errors.lastName && (
                      <p className="text-sm text-red-600">
                        {signupForm.formState.errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...signupForm.register('email')}
                      type="email"
                      placeholder="your.email@example.com"
                      className="pl-10"
                    />
                  </div>
                  {signupForm.formState.errors.email && (
                    <p className="text-sm text-red-600">
                      {signupForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...signupForm.register('phone')}
                      type="tel"
                      placeholder="+1234567890"
                      className="pl-10"
                    />
                  </div>
                  {signupForm.formState.errors.phone && (
                    <p className="text-sm text-red-600">
                      {signupForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date of Birth</label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...signupForm.register('dateOfBirth')}
                      type="date"
                      className="pl-10"
                    />
                  </div>
                  {signupForm.formState.errors.dateOfBirth && (
                    <p className="text-sm text-red-600">
                      {signupForm.formState.errors.dateOfBirth.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Address</label>
                  <div className="relative">
                    <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...signupForm.register('address')}
                      type="text"
                      placeholder="123 Main St, City, Country"
                      className="pl-10"
                    />
                  </div>
                  {signupForm.formState.errors.address && (
                    <p className="text-sm text-red-600">
                      {signupForm.formState.errors.address.message}
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={signupForm.formState.isSubmitting}
                  >
                    {signupForm.formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </div>

                <div className="text-center text-sm">
                  <span className="text-gray-600">Already have an account? </span>
                  <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                    Sign In
                  </Link>
                </div>
              </form>
            ) : (
              <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Verification Code</label>
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
                  <p className="text-xs text-gray-500 text-center">
                    We sent a 6-digit code to {signupData?.email}
                  </p>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={otpForm.formState.isSubmitting}
                >
                  {otpForm.formState.isSubmitting ? 'Verifying...' : 'Verify Account'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep('signup')}
                >
                  Back to Registration
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
