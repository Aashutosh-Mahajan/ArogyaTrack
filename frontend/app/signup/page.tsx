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
import {
  FiMail, FiUser, FiPhone, FiLock, FiMapPin, FiCalendar,
  FiDroplet, FiBriefcase, FiAward, FiArrowRight, FiArrowLeft, FiCheckCircle,
} from 'react-icons/fi';
import Link from 'next/link';

// ─── Role type ───────────────────────────────────────────────
type Role = 'patient' | 'doctor' | 'pharmacy';

// ─── Schemas per role ────────────────────────────────────────
const patientSchema = z.object({
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
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match", path: ['confirmPassword'],
});

const doctorSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  medicalLicense: z.string().min(5, 'Medical license number is required'),
  specialization: z.string().min(2, 'Specialization is required'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match", path: ['confirmPassword'],
});

const pharmacySchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  pharmacyName: z.string().min(2, 'Pharmacy name is required'),
  licenseNumber: z.string().min(5, 'License number is required'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match", path: ['confirmPassword'],
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

type OtpFormData = z.infer<typeof otpSchema>;

// ─── Role cards config ───────────────────────────────────────
const roleCards: { id: Role; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  {
    id: 'patient',
    label: 'Patient',
    icon: <FiUser className="w-8 h-8" />,
    desc: 'Access medical records, prescriptions & health tracking',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'doctor',
    label: 'Doctor',
    icon: <FiBriefcase className="w-8 h-8" />,
    desc: 'Manage patients, write prescriptions & medical records',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: <FiAward className="w-8 h-8" />,
    desc: 'Scan prescriptions, dispense medicine & track inventory',
    color: 'from-purple-500 to-purple-600',
  },
];

// ─── Step indicator ──────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
              i < current
                ? 'bg-blue-600 text-white'
                : i === current
                ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {i < current ? <FiCheckCircle className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-12 h-0.5 ${i < current ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'role' | 'details' | 'otp'>('role');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [email, setEmail] = useState('');

  // Forms
  const patientForm = useForm<z.infer<typeof patientSchema>>({
    resolver: zodResolver(patientSchema),
  });
  const doctorForm = useForm<z.infer<typeof doctorSchema>>({
    resolver: zodResolver(doctorSchema),
  });
  const pharmacyForm = useForm<z.infer<typeof pharmacySchema>>({
    resolver: zodResolver(pharmacySchema),
  });
  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
  });

  const stepIndex = step === 'role' ? 0 : step === 'details' ? 1 : 2;

  // ── Submit handlers ──
  const onPatientSubmit = async (data: z.infer<typeof patientSchema>) => {
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
      toast.success('Registration successful! Check your email for OTP.');
    } catch (error: any) {
      toast.error(error?.response?.data?.email?.[0] || error?.response?.data?.detail || 'Registration failed');
    }
  };

  const onDoctorSubmit = async (data: z.infer<typeof doctorSchema>) => {
    try {
      await api.auth.registerDoctor({
        email: data.email,
        password: data.password,
        first_name: data.firstName,
        last_name: data.lastName,
        medical_license: data.medicalLicense,
        specialization: data.specialization,
        phone: data.phone,
      });
      setEmail(data.email);
      setStep('otp');
      toast.success('Registration successful! Check your email for OTP.');
    } catch (error: any) {
      toast.error(error?.response?.data?.email?.[0] || error?.response?.data?.detail || 'Registration failed');
    }
  };

  const onPharmacySubmit = async (data: z.infer<typeof pharmacySchema>) => {
    try {
      await api.auth.registerPharmacy({
        email: data.email,
        password: data.password,
        first_name: data.firstName,
        last_name: data.lastName,
        pharmacy_name: data.pharmacyName,
        license_number: data.licenseNumber,
        phone: data.phone,
        address: data.address,
      });
      setEmail(data.email);
      setStep('otp');
      toast.success('Registration successful! Check your email for OTP.');
    } catch (error: any) {
      toast.error(error?.response?.data?.email?.[0] || error?.response?.data?.detail || 'Registration failed');
    }
  };

  const onOtpSubmit = async (data: OtpFormData) => {
    try {
      await api.auth.verifyEmail(email, data.otp);
      toast.success('Email verified successfully! You can now login.');
      router.push('/login');
    } catch (error: any) {
      toast.error(error?.response?.data?.otp?.[0] || 'Invalid OTP. Please try again.');
    }
  };

  // ── Role selection slide ──
  const renderRoleSelection = () => (
    <div className="space-y-6">
      <div className="grid gap-4">
        {roleCards.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setSelectedRole(role.id)}
            className={`relative w-full text-left p-5 rounded-xl border-2 transition-all duration-200 ${
              selectedRole === role.id
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${role.color} text-white flex items-center justify-center`}>
                {role.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900">{role.label}</h3>
                <p className="text-sm text-gray-500">{role.desc}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedRole === role.id ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
              }`}>
                {selectedRole === role.id && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </div>
          </button>
        ))}
      </div>
      <Button
        className="w-full"
        disabled={!selectedRole}
        onClick={() => setStep('details')}
      >
        Continue <FiArrowRight className="ml-2" />
      </Button>
    </div>
  );

  // ── Shared field helpers ──
  const renderField = (
    form: any,
    name: string,
    label: string,
    icon: React.ReactNode,
    type = 'text',
    placeholder = '',
  ) => (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
        <Input {...form.register(name)} type={type} placeholder={placeholder} className="pl-10" />
      </div>
      {form.formState.errors[name] && (
        <p className="text-sm text-red-600">{form.formState.errors[name]?.message}</p>
      )}
    </div>
  );

  // ── Patient form ──
  const renderPatientForm = () => (
    <form onSubmit={patientForm.handleSubmit(onPatientSubmit)} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {renderField(patientForm, 'firstName', 'First Name', <FiUser />, 'text', 'John')}
        {renderField(patientForm, 'lastName', 'Last Name', <FiUser />, 'text', 'Doe')}
      </div>
      {renderField(patientForm, 'email', 'Email', <FiMail />, 'email', 'patient@example.com')}
      <div className="grid md:grid-cols-2 gap-4">
        {renderField(patientForm, 'dateOfBirth', 'Date of Birth', <FiCalendar />, 'date')}
        <div className="space-y-2">
          <label className="text-sm font-medium">Gender</label>
          <Select onValueChange={(v: string) => patientForm.setValue('gender', v as any)}>
            <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {patientForm.formState.errors.gender && (
            <p className="text-sm text-red-600">{patientForm.formState.errors.gender.message}</p>
          )}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Blood Group</label>
          <div className="relative">
            <FiDroplet className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
            <Select onValueChange={(v: string) => patientForm.setValue('bloodGroup', v as any)}>
              <SelectTrigger className="pl-10"><SelectValue placeholder="Select blood group" /></SelectTrigger>
              <SelectContent>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {patientForm.formState.errors.bloodGroup && (
            <p className="text-sm text-red-600">{patientForm.formState.errors.bloodGroup.message}</p>
          )}
        </div>
        {renderField(patientForm, 'phone', 'Phone Number', <FiPhone />, 'tel', '+1234567890')}
      </div>
      {renderField(patientForm, 'address', 'Address', <FiMapPin />, 'text', '123 Main St, City, Country')}
      <div className="grid md:grid-cols-2 gap-4">
        {renderField(patientForm, 'password', 'Password', <FiLock />, 'password', '••••••••')}
        {renderField(patientForm, 'confirmPassword', 'Confirm Password', <FiLock />, 'password', '••••••••')}
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => setStep('role')} className="flex-1">
          <FiArrowLeft className="mr-2" /> Back
        </Button>
        <Button type="submit" className="flex-1" disabled={patientForm.formState.isSubmitting}>
          {patientForm.formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
        </Button>
      </div>
    </form>
  );

  // ── Doctor form ──
  const renderDoctorForm = () => (
    <form onSubmit={doctorForm.handleSubmit(onDoctorSubmit)} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {renderField(doctorForm, 'firstName', 'First Name', <FiUser />, 'text', 'John')}
        {renderField(doctorForm, 'lastName', 'Last Name', <FiUser />, 'text', 'Doe')}
      </div>
      {renderField(doctorForm, 'email', 'Email', <FiMail />, 'email', 'doctor@example.com')}
      <div className="grid md:grid-cols-2 gap-4">
        {renderField(doctorForm, 'medicalLicense', 'Medical License Number', <FiBriefcase />, 'text', 'MD12345')}
        {renderField(doctorForm, 'specialization', 'Specialization', <FiAward />, 'text', 'Cardiology')}
      </div>
      {renderField(doctorForm, 'phone', 'Phone Number', <FiPhone />, 'tel', '+1234567890')}
      <div className="grid md:grid-cols-2 gap-4">
        {renderField(doctorForm, 'password', 'Password', <FiLock />, 'password', '••••••••')}
        {renderField(doctorForm, 'confirmPassword', 'Confirm Password', <FiLock />, 'password', '••••••••')}
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => setStep('role')} className="flex-1">
          <FiArrowLeft className="mr-2" /> Back
        </Button>
        <Button type="submit" className="flex-1" disabled={doctorForm.formState.isSubmitting}>
          {doctorForm.formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
        </Button>
      </div>
    </form>
  );

  // ── Pharmacy form ──
  const renderPharmacyForm = () => (
    <form onSubmit={pharmacyForm.handleSubmit(onPharmacySubmit)} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {renderField(pharmacyForm, 'firstName', 'First Name', <FiUser />, 'text', 'John')}
        {renderField(pharmacyForm, 'lastName', 'Last Name', <FiUser />, 'text', 'Doe')}
      </div>
      {renderField(pharmacyForm, 'email', 'Email', <FiMail />, 'email', 'pharmacy@example.com')}
      {renderField(pharmacyForm, 'pharmacyName', 'Pharmacy Name', <FiBriefcase />, 'text', 'City Pharmacy')}
      <div className="grid md:grid-cols-2 gap-4">
        {renderField(pharmacyForm, 'licenseNumber', 'License Number', <FiAward />, 'text', 'PH12345')}
        {renderField(pharmacyForm, 'phone', 'Phone Number', <FiPhone />, 'tel', '+1234567890')}
      </div>
      {renderField(pharmacyForm, 'address', 'Address', <FiMapPin />, 'text', '123 Main St, City, Country')}
      <div className="grid md:grid-cols-2 gap-4">
        {renderField(pharmacyForm, 'password', 'Password', <FiLock />, 'password', '••••••••')}
        {renderField(pharmacyForm, 'confirmPassword', 'Confirm Password', <FiLock />, 'password', '••••••••')}
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => setStep('role')} className="flex-1">
          <FiArrowLeft className="mr-2" /> Back
        </Button>
        <Button type="submit" className="flex-1" disabled={pharmacyForm.formState.isSubmitting}>
          {pharmacyForm.formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
        </Button>
      </div>
    </form>
  );

  // ── OTP form ──
  const renderOtpForm = () => (
    <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
          <FiMail className="w-8 h-8 text-blue-600" />
        </div>
        <p className="text-gray-600 text-sm">
          We sent a 6-digit verification code to<br />
          <span className="font-semibold text-gray-900">{email}</span>
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Verification Code</label>
        <div className="relative">
          <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            {...otpForm.register('otp')}
            type="text"
            placeholder="000000"
            maxLength={6}
            className="pl-10 tracking-[0.3em] text-center text-lg font-mono"
          />
        </div>
        {otpForm.formState.errors.otp && (
          <p className="text-sm text-red-600">{otpForm.formState.errors.otp.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={otpForm.formState.isSubmitting}>
        {otpForm.formState.isSubmitting ? 'Verifying...' : 'Verify Email'}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('details')}>
        <FiArrowLeft className="mr-2" /> Back to Registration
      </Button>
    </form>
  );

  // ── Titles ──
  const getTitle = () => {
    if (step === 'role') return 'Create Account';
    if (step === 'otp') return 'Verify Your Email';
    const r = roleCards.find((r) => r.id === selectedRole);
    return `${r?.label} Registration`;
  };

  const getDescription = () => {
    if (step === 'role') return 'Choose your role to get started';
    if (step === 'otp') return 'Enter the code we sent to your email';
    return 'Fill in your details to create your account';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <StepIndicator current={stepIndex} total={3} />
            <CardTitle className="text-3xl font-bold">{getTitle()}</CardTitle>
            <CardDescription>{getDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'role' && renderRoleSelection()}
            {step === 'details' && selectedRole === 'patient' && renderPatientForm()}
            {step === 'details' && selectedRole === 'doctor' && renderDoctorForm()}
            {step === 'details' && selectedRole === 'pharmacy' && renderPharmacyForm()}
            {step === 'otp' && renderOtpForm()}

            {step !== 'otp' && (
              <div className="text-center text-sm mt-4">
                <span className="text-gray-600">Already have an account? </span>
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  Sign In
                </Link>
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
