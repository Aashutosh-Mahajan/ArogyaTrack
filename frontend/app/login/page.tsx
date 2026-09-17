'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff, FiCheckCircle, FiClock, FiActivity, FiArrowLeft, FiShield } from 'react-icons/fi';
import Link from 'next/link';
import { motion } from 'framer-motion';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginPageContent() {
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

      setAuth(response.user);

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
      {/* Left Panel - Branding (fixed ink panel, like the landing hero) */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-[#151109] border-r border-white/5 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#4a8a6f]/20 rounded-full blur-[128px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#4a8a6f]/15 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>

        {/* Content */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 w-fit group">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 group-hover:bg-white/20 transition-all">
              <FiActivity className="w-5 h-5 text-[#8fc4a8]" />
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
            <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4a8a6f]/15 border border-[#4a8a6f]/30 text-[#8fc4a8] text-xs font-medium uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#6fae87] animate-pulse"></span>
              Govt. of India
            </div>
            <h1 className="text-5xl font-display font-bold text-white mb-6 leading-tight">
              Secure Access to <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8fc4a8] to-[#6fae87]">National Health Data</span>
            </h1>
            <p className="text-lg text-white/60 leading-relaxed font-light">
              Authorized personnel only. Access real-time surveillance metrics, patient records, and predictive analytics dashboards.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-white/40 text-sm font-mono">
          <p>© 2026 Ministry of Health</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FiShield className="w-4 h-4" /> 256-bit Encryption
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex items-center justify-center p-8 lg:p-12 bg-background relative">
        <Link href="/" className="absolute top-8 left-8 lg:hidden flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <FiArrowLeft className="w-4 h-4" /> Back
        </Link>
        <ThemeToggle className="absolute top-8 right-8 text-foreground" />

        <div className="w-full max-w-[420px] space-y-8">
          <div className="text-center lg:text-left">
            <span className="eyebrow bg-primary/8 text-primary mb-4">Secure Sign-In</span>
            <h2 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h2>
            <p className="text-muted-foreground">Please enter your credentials to continue.</p>
          </div>

          {/* Alerts */}
          {message === 'verified' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 p-4 rounded-xl bg-primary/8 border border-primary/15 text-primary">
              <FiCheckCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">Email verified successfully!</p>
            </motion.div>
          )}
          {message === 'doctor_verified' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600">
              <FiClock className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">Profile under review by medical board.</p>
            </motion.div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80 ml-1">Official Email</label>
              <div className="relative group">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  {...form.register('email')}
                  type="email"
                  className="pl-11 h-12 bg-card border-border focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
                  placeholder="officer@health.gov.in"
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs text-destructive ml-1 font-medium">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-medium text-foreground/80">Password</label>
                <Link href="/forgot-password" className="text-xs text-primary hover:opacity-80 font-medium">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative group">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  {...form.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="pl-11 pr-11 h-12 bg-card border-border focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-destructive ml-1 font-medium">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="group magnetic-btn w-full h-12 pl-6 pr-2 text-base font-semibold text-primary-foreground bg-primary hover:opacity-90 shadow-button rounded-full transition-colors flex items-center justify-center gap-3 disabled:opacity-60 disabled:pointer-events-none active:scale-[0.98]"
            >
              {form.formState.isSubmitting ? 'Authenticating…' : (
                <>
                  Access Dashboard
                  <span className="btn-icon-wrap">
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8h8M9 4l4 4-4 4" /></svg>
                  </span>
                </>
              )}
            </button>
          </form>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              New healthcare facility?{' '}
              <Link href="/signup" className="text-primary font-semibold hover:underline">
                Register Here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
