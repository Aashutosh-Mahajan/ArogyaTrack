'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff, FiCheckCircle, FiClock, FiLock as FiLockAlt } from 'react-icons/fi';
import Link from 'next/link';
import { motion } from 'framer-motion';
import SplitSignInLayout from '@/components/auth/SplitSignInLayout';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

/* ── Pill SVG illustration for left panel ── */
function PillIllustration() {
  return (
    <div className="flex items-center gap-4">
      <svg width="64" height="64" viewBox="0 0 256 256" fill="none" className="opacity-60">
        <path d="M216.42,39.6a53.26,53.26,0,0,0-75.32,0L39.6,141.09a53.26,53.26,0,0,0,75.32,75.31L216.42,114.91A53.31,53.31,0,0,0,216.42,39.6ZM103.61,205.09a37.26,37.26,0,0,1-52.7-52.69L96,107.31,148.69,160Z" fill="#5ca88c" />
      </svg>
      <div>
        <p className="text-sm font-semibold text-[#8fc4a8]">Licensed Pharmacy Portal</p>
        <p className="text-xs text-[#8fc4a8]/50 mt-1">Validate & dispense prescriptions securely</p>
      </div>
    </div>
  );
}

const pharmacistFeatures = [
  { icon: <FiCheckCircle className="w-4 h-4 text-emerald-400" />, label: 'QR-based prescription verification' },
  { icon: <FiClock className="w-4 h-4 text-emerald-400" />, label: 'Real-time inventory management' },
  { icon: <FiLockAlt className="w-4 h-4 text-emerald-400" />, label: 'Controlled substance tracking' },
];

export default function PharmacistSignInPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const response: any = await api.auth.login(data.email, data.password);
      if (response.user.role !== 'pharmacist') {
        toast.error('This login is for pharmacists only');
        return;
      }
      setAuth(response.user);
      toast.success('Welcome back!');
      router.push('/pharmacy');
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Invalid email or password');
    }
  };

  return (
    <SplitSignInLayout decoration={<PillIllustration />} features={pharmacistFeatures}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-1 font-syne">Pharmacist Login</h2>
          <p className="text-sm text-muted-foreground font-dm">Validate &amp; dispense prescriptions</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Pharmacy Email</label>
            <div className="relative group">
              <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                {...form.register('email')}
                type="email"
                placeholder="pharmacy@medplus.in"
                className="pl-11 h-12 bg-card border-border focus:border-primary focus:ring-primary/20 rounded-xl"
              />
            </div>
            {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-foreground/80">Password</label>
              <Link href="/forgot-password" className="text-xs text-primary hover:text-primary font-medium">Forgot?</Link>
            </div>
            <div className="relative group">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                {...form.register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pl-11 pr-11 h-12 bg-card border-border focus:border-primary focus:ring-primary/20 rounded-xl"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
                {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
            {form.formState.errors.password && <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>}
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base bg-primary hover:opacity-90 shadow-lg shadow-teal-700/20 rounded-xl"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup/pharmacist" className="text-primary font-semibold hover:underline">Register</Link>
          </p>
          <Link href="/signup" className="text-xs text-muted-foreground hover:text-muted-foreground">← Back to role selection</Link>
        </div>
      </motion.div>
    </SplitSignInLayout>
  );
}
