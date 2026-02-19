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
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff, FiCheckCircle, FiClock, FiActivity, FiArrowLeft, FiShield } from 'react-icons/fi';
import Link from 'next/link';
import { motion } from 'framer-motion';

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
      console.error('Login error:', error);
      const msg =
        error?.response?.data?.non_field_errors?.[0] ||
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        'Invalid email or password';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel - Branding */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-teal-900 border-r border-teal-800/50 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5 mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-600/30 rounded-full blur-[128px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>

        {/* Content */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 w-fit group">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 group-hover:bg-white/20 transition-all">
              <FiActivity className="w-5 h-5 text-emerald-300" />
            </div>
            <span className="text-xl font-display font-bold text-white tracking-tight">ArogyaTrack</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 text-xs font-medium uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Govt. of India
            </div>
            <h1 className="text-5xl font-display font-bold text-white mb-6 leading-tight">
              Secure Access to <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-teal-200">National Health Data</span>
            </h1>
            <p className="text-lg text-teal-100/80 leading-relaxed font-light">
              Authorized personnel only. Access real-time surveillance metrics, patient records, and predictive analytics dashboards.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-teal-200/60 text-sm font-mono">
          <p>© 2026 Ministry of Health</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FiShield className="w-4 h-4" /> 256-bit Encryption
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex items-center justify-center p-8 lg:p-12 bg-slate-50 relative">
        <Link href="/" className="absolute top-8 left-8 lg:hidden flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
          <FiArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="w-full max-w-[400px] space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h2>
            <p className="text-slate-500">Please enter your credentials to continue.</p>
          </div>

          {/* Alerts */}
          {message === 'verified' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800">
              <FiCheckCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">Email verified successfully!</p>
            </motion.div>
          )}
          {message === 'doctor_verified' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-800">
              <FiClock className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">Profile under review by medical board.</p>
            </motion.div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 ml-1">Official Email</label>
              <div className="relative group">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
                <Input
                  {...form.register('email')}
                  type="email"
                  className="pl-11 h-12 bg-white border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all"
                  placeholder="officer@health.gov.in"
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs text-red-500 ml-1 font-medium">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <Link href="/forgot-password" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative group">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
                <Input
                  {...form.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="pl-11 pr-11 h-12 bg-white border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-red-500 ml-1 font-medium">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base bg-teal-700 hover:bg-teal-800 shadow-lg shadow-teal-700/20 rounded-xl transition-all"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Authenticating...' : 'Access Dashboard'}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-slate-500">
              New healthcare facility?{' '}
              <Link href="/signup" className="text-teal-700 font-semibold hover:underline">
                Register Here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
