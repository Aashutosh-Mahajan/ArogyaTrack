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
import { FiMail, FiLock, FiShield } from 'react-icons/fi';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onLoginSubmit = async (data: LoginFormData) => {
    try {
      const response: any = await api.auth.login(data.email, data.password);
      
      // Verify role is admin or authority
      if (response.user.role !== 'admin' && response.user.role !== 'authority') {
        toast.error('Invalid credentials for admin login');
        return;
      }

      setAuth(response.user, {
        access: response.access,
        refresh: response.refresh,
      });
      
      toast.success('Login successful');
      router.push('/admin');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.non_field_errors?.[0] || 
                          error?.response?.data?.detail || 
                          'Invalid email or password';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-purple-500/20">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <FiShield className="w-8 h-8 text-purple-600" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold">Admin Login</CardTitle>
            <CardDescription>
              Administrator access only
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    {...loginForm.register('email')}
                    type="email"
                    placeholder="admin@example.com"
                    className="pl-10"
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-red-600">
                    {loginForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    {...loginForm.register('password')}
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                  />
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-red-600">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full bg-purple-600 hover:bg-purple-700"
                disabled={loginForm.formState.isSubmitting}
              >
                {loginForm.formState.isSubmitting ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="text-center text-sm space-y-2">
                <div>
                  <Link href="/login/patient" className="text-gray-600 hover:text-gray-700">
                    Patient Login
                  </Link>
                  {' | '}
                  <Link href="/login/doctor" className="text-gray-600 hover:text-gray-700">
                    Doctor Login
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
