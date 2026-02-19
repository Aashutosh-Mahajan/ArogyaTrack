'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiUser, FiBriefcase, FiAward, FiArrowRight, FiActivity, FiShield } from 'react-icons/fi';
import { motion } from 'framer-motion';

export default function SignupPage() {
  const router = useRouter();

  const roleCards = [
    {
      id: 'patient',
      label: 'Citizen / Patient',
      icon: <FiUser className="w-10 h-10" />,
      desc: 'Access personal health records, recipes & immunization history.',
      color: 'bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-400',
      iconBg: 'bg-blue-100',
      path: '/signup/patient',
    },
    {
      id: 'doctor',
      label: 'Medical Officer',
      icon: <FiBriefcase className="w-10 h-10" />,
      desc: 'Manage patient queues, issue digital prescriptions & update records.',
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:border-emerald-400',
      iconBg: 'bg-emerald-100',
      path: '/signup/doctor',
    },
    {
      id: 'pharmacy',
      label: 'Pharmacist',
      icon: <FiAward className="w-10 h-10" />,
      desc: 'Verify digital prescriptions, manage inventory & dispensing.',
      color: 'bg-purple-50 text-purple-600 border-purple-200 hover:border-purple-400',
      iconBg: 'bg-purple-100',
      path: '/signup/pharmacist',
      comingSoon: false,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans selection:bg-teal-100">
      {/* Background Decor */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-teal-900 to-slate-50 -z-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[128px] -translate-y-1/2 translate-x-1/2 -z-10" />

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header Branding */}
        <div className="flex flex-col items-center justify-center mb-16 text-center">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 group">
            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-md border border-white/20 shadow-lg group-hover:bg-white/20 transition-all">
              <FiActivity className="w-6 h-6 text-emerald-300" />
            </div>
            <div className="text-left">
              <span className="text-2xl font-display font-bold text-white block leading-none tracking-tight">ArogyaTrack</span>
              <span className="text-[10px] text-teal-200 uppercase tracking-widest block leading-none mt-1">Govt. of India</span>
            </div>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white space-y-4 max-w-2xl"
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold">Register on the Network</h1>
            <p className="text-lg text-teal-100/90 font-light">
              Join the unified national health interface. Select your role to begin the registration process.
            </p>
          </motion.div>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {roleCards.map((role, i) => (
            <motion.button
              key={role.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => {
                if (!role.comingSoon) {
                  router.push(role.path);
                }
              }}
              disabled={role.comingSoon}
              className={`
                relative group text-left p-8 rounded-[2rem] bg-white border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1
                ${role.comingSoon ? 'opacity-70 grayscale' : role.color}
              `}
            >
              <div className={`w-16 h-16 rounded-2xl ${role.iconBg} flex items-center justify-center mb-6 transition-transform group-hover:scale-110`}>
                {role.icon}
              </div>

              <h3 className="text-2xl font-bold text-slate-900 mb-2">{role.label}</h3>
              <p className="text-slate-500 mb-8 min-h-[3rem] leading-relaxed">
                {role.desc}
              </p>

              <div className="flex items-center justify-between mt-auto">
                {role.comingSoon ? (
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    Coming Soon
                  </span>
                ) : (
                  <span className="text-sm font-bold flex items-center gap-2 group-hover:gap-3 transition-all">
                    Proceed <FiArrowRight />
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Features / Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center space-y-8"
        >
          <div className="inline-flex flex-wrap justify-center gap-6 md:gap-12 text-sm font-medium text-slate-500">
            <div className="flex items-center gap-2">
              <FiShield className="text-emerald-600" /> HIPAA Compliant
            </div>
            <div className="flex items-center gap-2">
              <FiShield className="text-emerald-600" /> ISO 27001 Certified
            </div>
            <div className="flex items-center gap-2">
              <FiShield className="text-emerald-600" /> 256-bit SSL Security
            </div>
          </div>

          <p className="text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-teal-700 font-bold hover:underline">
              Official Login
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
