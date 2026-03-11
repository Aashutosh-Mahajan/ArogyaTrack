'use client';

import React from 'react';
import Link from 'next/link';
import { FiActivity, FiShield, FiCheckCircle, FiClock, FiLock } from 'react-icons/fi';
import { motion } from 'framer-motion';

/* ── ECG SVG line ───────────────────────────── */
const ecgPath = 'M0,12 L40,12 L45,12 L50,2 L55,22 L60,0 L65,20 L70,12 L110,12 L150,12 L155,12 L160,2 L165,22 L170,0 L175,20 L180,12 L220,12 L260,12';

interface Feature {
  icon: React.ReactNode;
  label: string;
}

interface Props {
  /** Decorative element shown above the feature list on the left panel */
  decoration?: React.ReactNode;
  /** Feature bullets rendered on the left panel */
  features?: Feature[];
  /** Right-side content (the sign-in form) */
  children: React.ReactNode;
}

const defaultFeatures: Feature[] = [
  { icon: <FiCheckCircle className="w-4 h-4 text-emerald-400" />, label: 'Instant access to health records' },
  { icon: <FiClock className="w-4 h-4 text-emerald-400" />, label: '24/7 prescription tracking' },
  { icon: <FiLock className="w-4 h-4 text-emerald-400" />, label: 'End-to-end encrypted data' },
];

export default function SplitSignInLayout({ decoration, features = defaultFeatures, children }: Props) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[42%_58%]">
      {/* ── Left Dark Panel (42%) ───────────────────────── */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-[#0F2928] overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5 mix-blend-overlay" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-600/30 rounded-full blur-[128px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-600/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 w-fit group">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 group-hover:bg-white/20 transition-all">
              <FiActivity className="w-5 h-5 text-emerald-300" />
            </div>
            <span className="text-xl font-syne font-bold text-white tracking-tight">ArogyaTrack</span>
          </Link>
        </div>

        {/* Middle: Decoration + Features */}
        <div className="relative z-10 flex flex-col items-start gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="w-full"
          >
            {decoration}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-teal-100/80 text-sm font-dm">
                {f.icon}
                <span>{f.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Footer: ECG + security */}
        <div className="relative z-10 space-y-3">
          <div className="flex justify-start opacity-20">
            <svg viewBox="0 0 260 24" className="w-40 h-5" preserveAspectRatio="none">
              <path d={ecgPath} fill="none" stroke="#4DD4CC" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="flex items-center gap-4 text-teal-200/50 text-xs font-mono">
            <span>© 2026 Ministry of Health</span>
            <span className="flex items-center gap-1"><FiShield className="w-3.5 h-3.5" /> 256-bit Encryption</span>
          </div>
        </div>
      </div>

      {/* ── Right Panel (58%) ───────────────────────────── */}
      <div className="flex items-center justify-center p-8 lg:p-16 bg-slate-50 relative overflow-y-auto">
        <div className="w-full max-w-[420px]">
          {children}
        </div>
      </div>
    </div>
  );
}
