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
import { FiMail, FiLock, FiEye, FiEyeOff, FiShield, FiAlertTriangle, FiKey } from 'react-icons/fi';
import Link from 'next/link';
import { motion } from 'framer-motion';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  access_key: z.string().min(1, 'Access key is required'),
});

type FormData = z.infer<typeof schema>;

export default function AdminSignInPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const response: any = await api.auth.login(data.email, data.password);
      if (response.user.role !== 'admin' && response.user.role !== 'authority') {
        toast.error('Access restricted to administrators only');
        return;
      }
      setAuth(response.user, { access: response.access, refresh: response.refresh });
      toast.success('Admin access granted');
      router.push('/admin');
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Invalid credentials');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundColor: '#0A1A19',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {/* Radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[600px] h-[400px] bg-[radial-gradient(circle,rgba(239,68,68,0.08)_0%,transparent_60%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[440px] mx-4"
      >
        {/* Shield Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <FiShield className="w-8 h-8 text-red-400" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white font-syne mb-1">Admin Access</h1>
          <p className="text-sm text-slate-400 font-dm">Surveillance dashboard &amp; system control</p>
        </div>

        {/* Red Warning Banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-8">
          <FiAlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Restricted Access</p>
            <p className="text-xs text-red-200/50 mt-0.5">
              Unauthorized access attempts are logged and reported.
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 space-y-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Official Email</label>
              <div className="relative group">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
                <Input
                  {...form.register('email')}
                  type="email"
                  placeholder="admin@health.gov.in"
                  className="pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl"
                />
              </div>
              {form.formState.errors.email && <p className="text-xs text-red-400">{form.formState.errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <div className="relative group">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
                <Input
                  {...form.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-11 pr-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.password && <p className="text-xs text-red-400">{form.formState.errors.password.message}</p>}
            </div>

            {/* Access Key */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Access Key</label>
              <div className="relative group">
                <FiKey className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500/60 group-focus-within:text-amber-400 transition-colors" />
                <Input
                  {...form.register('access_key')}
                  type="password"
                  placeholder="Enter admin access key"
                  className="pl-11 h-12 bg-white/5 border-amber-500/30 text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                />
              </div>
              {form.formState.errors.access_key && <p className="text-xs text-red-400">{form.formState.errors.access_key.message}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base bg-red-600/80 hover:bg-red-600 border border-red-500/30 text-white rounded-xl transition-all"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Authenticating…' : 'Access Admin Panel'}
            </Button>
          </form>
        </div>

        {/* Monitoring notice */}
        <p className="text-center text-[11px] text-slate-500 mt-6 font-dm">
          All login attempts are monitored &amp; logged for security compliance.
        </p>

        <div className="text-center mt-4">
          <Link href="/signup" className="text-xs text-slate-500 hover:text-slate-300">← Back to role selection</Link>
        </div>
      </motion.div>
    </div>
  );
}
