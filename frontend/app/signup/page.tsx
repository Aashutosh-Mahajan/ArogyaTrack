'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiUser, FiBriefcase, FiAward, FiArrowRight } from 'react-icons/fi';

export default function SignupPage() {
  const router = useRouter();

  const roleCards = [
    {
      id: 'patient',
      label: 'Patient',
      icon: <FiUser className="w-12 h-12" />,
      desc: 'Access medical records, prescriptions & health tracking',
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700',
      path: '/signup/patient',
    },
    {
      id: 'doctor',
      label: 'Doctor',
      icon: <FiBriefcase className="w-12 h-12" />,
      desc: 'Manage patients, write prescriptions & medical records',
      color: 'from-emerald-500 to-emerald-600',
      hoverColor: 'hover:from-emerald-600 hover:to-emerald-700',
      path: '/signup/doctor',
    },
    {
      id: 'pharmacy',
      label: 'Pharmacy',
      icon: <FiAward className="w-12 h-12" />,
      desc: 'Scan prescriptions, dispense medicine & track inventory',
      color: 'from-purple-500 to-purple-600',
      hoverColor: 'hover:from-purple-600 hover:to-purple-700',
      path: '#', // TODO: Create pharmacy signup page
      comingSoon: true,
    },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Create Your Account</h1>
          <p className="text-lg text-gray-600">Choose your role to get started</p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {roleCards.map((role) => (
            <button
              key={role.id}
              onClick={() => {
                if (!role.comingSoon) {
                  router.push(role.path);
                }
              }}
              disabled={role.comingSoon}
              className={`
                relative group p-8 rounded-2xl bg-white shadow-lg 
                transition-all duration-300 transform hover:scale-105 hover:shadow-xl
                ${role.comingSoon ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Gradient Background on Hover */}
              <div className={`
                absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 
                transition-opacity duration-300 bg-gradient-to-br ${role.color}
                ${role.comingSoon ? '' : ''}
              `} />

              {/* Icon */}
              <div className={`
                w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center
                bg-gradient-to-br ${role.color} text-white
                transform transition-transform group-hover:scale-110
              `}>
                {role.icon}
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-gray-900 mb-3">{role.label}</h2>

              {/* Description */}
              <p className="text-gray-600 text-sm mb-6 min-h-[3rem]">{role.desc}</p>

              {/* CTA */}
              {role.comingSoon ? (
                <div className="inline-flex items-center text-sm font-medium text-gray-500">
                  Coming Soon
                </div>
              ) : (
                <div className={`
                  inline-flex items-center text-sm font-medium 
                  bg-gradient-to-r ${role.color} bg-clip-text text-transparent
                  group-hover:translate-x-1 transition-transform
                `}>
                  Get Started
                  <FiArrowRight className={`ml-2 text-current`} style={{
                    color: role.color.includes('blue') ? '#3b82f6' :
                           role.color.includes('emerald') ? '#10b981' : '#a855f7'
                  }} />
                </div>
              )}

              {/* Coming Soon Badge */}
              {role.comingSoon && (
                <div className="absolute top-4 right-4 bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full">
                  Soon
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Features Banner */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl mb-2">🔒</div>
              <h3 className="font-semibold text-gray-900 mb-1">Secure & HIPAA Compliant</h3>
              <p className="text-sm text-gray-600">Your data is encrypted and protected</p>
            </div>
            <div>
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-semibold text-gray-900 mb-1">Fast Approval</h3>
              <p className="text-sm text-gray-600">Doctor accounts reviewed in 24-48 hours</p>
            </div>
            <div>
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-semibold text-gray-900 mb-1">Professional Standards</h3>
              <p className="text-sm text-gray-600">Production-grade healthcare system</p>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="text-center text-sm">
          <span className="text-gray-600">Already have an account? </span>
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
            Sign In
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
