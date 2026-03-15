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
import { FiMail, FiLock, FiEye, FiEyeOff, FiHeart, FiShield } from 'react-icons/fi';
import Link from 'next/link';
import { motion } from 'framer-motion';
import SplitSignInLayout from '@/components/auth/SplitSignInLayout';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

/* ── Health Card Mockup (decoration for left panel) ── */
function HealthCardMockup() {
  return (
    <div className="w-64 rounded-2xl p-5 border border-teal-700/50 bg-gradient-to-br from-[#1A3835] to-[#162F2D] shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold uppercase text-teal-400 tracking-widest">ArogyaTrack</span>
        <FiShield className="w-4 h-4 text-teal-400/60" />
      </div>
      <div className="h-1.5 w-20 bg-teal-600/40 rounded mb-2" />
      <div className="h-1.5 w-32 bg-teal-600/30 rounded mb-4" />
      <div className="flex gap-2">
        <FiHeart className="w-4 h-4 text-red-400/60" />
        <div className="flex-1 space-y-1">
          <div className="h-1 w-full bg-teal-600/20 rounded" />
          <div className="h-1 w-3/4 bg-teal-600/15 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function PatientSignInPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const response: any = await api.auth.login(data.email, data.password);
      if (response.user.role !== 'patient') {
        toast.error('This login is for patients only');
        return;
      }
      setAuth(response.user, { access: response.access, refresh: response.refresh });
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Invalid email or password');
    }
  };

  return (
    <SplitSignInLayout decoration={<HealthCardMockup />}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1 font-syne">Patient Login</h2>
          <p className="text-sm text-slate-500 font-dm">Access your health records & prescriptions</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <div className="relative group">
              <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
              <Input
                {...form.register('email')}
                type="email"
                placeholder="you@email.com"
                className="pl-11 h-12 bg-white border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl"
              />
            </div>
            {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <Link href="/forgot-password" className="text-xs text-teal-600 hover:text-teal-700 font-medium">Forgot?</Link>
            </div>
            <div className="relative group">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
              <Input
                {...form.register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pl-11 pr-11 h-12 bg-white border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
            {form.formState.errors.password && <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>}
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base bg-teal-700 hover:bg-teal-800 shadow-lg shadow-teal-700/20 rounded-xl"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup/patient" className="text-teal-700 font-semibold hover:underline">Register</Link>
          </p>
          <Link href="/signup" className="text-xs text-slate-400 hover:text-slate-600">← Back to role selection</Link>
        </div>
      </motion.div>
    </SplitSignInLayout>
  );
}
