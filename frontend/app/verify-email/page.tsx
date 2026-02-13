'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { FiMail, FiShield, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const role = searchParams.get('role') || 'patient';

  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasteData)) {
      const digits = pasteData.split('');
      setOtp(digits);
      inputRefs.current[5]?.focus();
      handleVerify(pasteData);
    }
  };

  const handleVerify = useCallback(async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    if (code.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }

    if (!email) {
      toast.error('Email not found. Please register again.');
      return;
    }

    setLoading(true);
    try {
      await api.auth.verifyEmail(email, code);
      setVerified(true);
      toast.success('Email verified successfully!');

      // Redirect based on role after a short delay
      setTimeout(() => {
        if (role === 'doctor') {
          router.push('/login?message=doctor_verified');
        } else {
          router.push('/login?message=verified');
        }
      }, 2000);
    } catch (error: any) {
      const msg =
        error?.response?.data?.otp?.[0] ||
        error?.response?.data?.non_field_errors?.[0] ||
        error?.response?.data?.detail ||
        'Invalid or expired OTP. Please try again.';
      toast.error(msg);
      // Clear OTP inputs
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [otp, email, role, router]);

  const handleResendOTP = async () => {
    if (!email) {
      toast.error('Email not found. Please register again.');
      return;
    }

    setResending(true);
    try {
      await api.auth.sendOtp(email);
      toast.success('New OTP sent to your email!');
      setCountdown(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      toast.error('Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // Success state
  if (verified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <FiCheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
            <p className="text-gray-600 mb-4">
              Your email <span className="font-semibold text-gray-800">{email}</span> has been verified successfully.
            </p>
            {role === 'doctor' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> Your doctor registration is under review.
                  You&apos;ll receive an email once your profile is approved by our admin team (24-48 hours).
                </p>
              </div>
            ) : (
              <p className="text-gray-500 text-sm mb-6">
                Redirecting you to the login page...
              </p>
            )}
            <button
              onClick={() => router.push('/login')}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <FiShield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
            <p className="text-gray-600 text-sm">
              We&apos;ve sent a 6-digit verification code to
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <FiMail className="w-4 h-4 text-indigo-600" />
              <span className="font-semibold text-indigo-600">{email || 'your email'}</span>
            </div>
          </div>

          {/* OTP Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
              Enter verification code
            </label>
            <div className="flex justify-center gap-3" onPaste={handlePaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all ${
                    digit
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 bg-white text-gray-900'
                  } focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200`}
                  disabled={loading}
                />
              ))}
            </div>
          </div>

          {/* Verify Button */}
          <button
            onClick={() => handleVerify()}
            disabled={loading || otp.join('').length !== 6}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
              loading || otp.join('').length !== 6
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying...
              </span>
            ) : (
              'Verify Email'
            )}
          </button>

          {/* Resend OTP */}
          <div className="mt-6 text-center">
            {canResend ? (
              <button
                onClick={handleResendOTP}
                disabled={resending}
                className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
              >
                {resending ? 'Sending...' : 'Resend verification code'}
              </button>
            ) : (
              <p className="text-gray-500 text-sm">
                Resend code in <span className="font-semibold text-indigo-600">{countdown}s</span>
              </p>
            )}
          </div>

          {/* Help text */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 text-center">
              Didn&apos;t receive the email? Check your spam folder or click resend above.
              The code expires in 5 minutes.
            </p>
          </div>

          {/* Back to signup */}
          <div className="mt-4 text-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <FiArrowLeft className="w-3 h-3" />
              Back to Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
