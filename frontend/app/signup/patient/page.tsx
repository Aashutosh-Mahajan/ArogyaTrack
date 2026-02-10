'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import toast from 'react-hot-toast';
import { FiMail, FiUser, FiPhone, FiLock, FiMapPin, FiCalendar, FiDroplet } from 'react-icons/fi';
import Link from 'next/link';

const patientSignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['male', 'female', 'other'], { required_error: 'Gender is required' }),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], { required_error: 'Blood group is required' }),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

type PatientSignupFormData = z.infer<typeof patientSignupSchema>;
type OtpFormData = z.infer<typeof otpSchema>;

export default function PatientSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'signup' | 'otp'>('signup');
  const [email, setEmail] = useState('');

  const signupForm = useForm<PatientSignupFormData>({
    resolver: zodResolver(patientSignupSchema),
  });

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
  });

  const onSignupSubmit = async (data: PatientSignupFormData) => {
    try {
      await api.auth.registerPatient({
        email: data.email,
        password: data.password,
        first_name: data.firstName,
        last_name: data.lastName,
        date_of_birth: data.dateOfBirth,
        gender: data.gender,
        blood_group: data.bloodGroup,
        phone: data.phone,
        address: data.address,
      });
      
      setEmail(data.email);
      setStep('otp');
      toast.success('Registration successful! Please check your email for OTP verification.');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.email?.[0] || 
                          error?.response?.data?.detail || 
                          'Registration failed';
      toast.error(errorMessage);
    }
  };

  const onOtpSubmit = async (data: OtpFormData) => {
    try {
      await api.auth.verifyEmail(email, data.otp);
      toast.success('Email verified successfully! You can now login.');
      router.push('/login/patient');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.otp?.[0] || 'Invalid OTP. Please try again.';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl font-bold">Patient Registration</CardTitle>
            <CardDescription>
              {step === 'signup' 
                ? 'Create your patient account' 
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
                      placeholder="patient@example.com"
                      className="pl-10"
                    />
                  </div>
                  {signupForm.formState.errors.email && (
                    <p className="text-sm text-red-600">
                      {signupForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date of Birth</label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
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
                    <label className="text-sm font-medium">Gender</label>
                    <Select onValueChange={(value: string) => signupForm.setValue('gender', value as 'male' | 'female' | 'other')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {signupForm.formState.errors.gender && (
                      <p className="text-sm text-red-600">
                        {signupForm.formState.errors.gender.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Blood Group</label>
                    <div className="relative">
                      <FiDroplet className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                      <Select onValueChange={(value: string) => signupForm.setValue('bloodGroup', value as 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-')}>
                        <SelectTrigger className="pl-10">
                          <SelectValue placeholder="Select blood group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A+">A+</SelectItem>
                          <SelectItem value="A-">A-</SelectItem>
                          <SelectItem value="B+">B+</SelectItem>
                          <SelectItem value="B-">B-</SelectItem>
                          <SelectItem value="AB+">AB+</SelectItem>
                          <SelectItem value="AB-">AB-</SelectItem>
                          <SelectItem value="O+">O+</SelectItem>
                          <SelectItem value="O-">O-</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {signupForm.formState.errors.bloodGroup && (
                      <p className="text-sm text-red-600">
                        {signupForm.formState.errors.bloodGroup.message}
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

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        {...signupForm.register('password')}
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                      />
                    </div>
                    {signupForm.formState.errors.password && (
                      <p className="text-sm text-red-600">
                        {signupForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirm Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        {...signupForm.register('confirmPassword')}
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                      />
                    </div>
                    {signupForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-red-600">
                        {signupForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={signupForm.formState.isSubmitting}
                >
                  {signupForm.formState.isSubmitting ? 'Registering...' : 'Register'}
                </Button>

                <div className="text-center text-sm space-y-2">
                  <div>
                    <span className="text-gray-600">Already have an account? </span>
                    <Link href="/login/patient" className="text-blue-600 hover:text-blue-700 font-medium">
                      Login
                    </Link>
                  </div>
                  <div>
                    <span className="text-gray-600">Are you a doctor? </span>
                    <Link href="/signup/doctor" className="text-blue-600 hover:text-blue-700 font-medium">
                      Register as Doctor
                    </Link>
                  </div>
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
                  {otpForm.formState.isSubmitting ? 'Verifying...' : 'Verify Email'}
                </Button>

                <div className="text-center text-sm">
                  <button
                    type="button"
                    onClick={() => setStep('signup')}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Back to registration
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
