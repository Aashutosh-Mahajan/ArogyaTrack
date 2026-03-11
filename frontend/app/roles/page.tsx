'use client';

import React from 'react';
import Link from 'next/link';

/* ── Card Data ────────────────────────────────────── */
const roles = [
  {
    title: 'Patient',
    subtitle: 'Access your health records & prescriptions',
    pill: 'Personal Healthcare',
    pillColor: '#4DD4CC',
    pillBg: 'rgba(77,212,204,0.15)',
    href: '/patient/signin',
    icon: 'user',
    badge: null,
  },
  {
    title: 'Doctor',
    subtitle: 'Manage patients, write prescriptions',
    pill: 'Requires Verification',
    pillColor: '#f59e0b',
    pillBg: 'rgba(245,158,11,0.15)',
    href: '/doctor/signin',
    icon: 'stethoscope',
    badge: { text: '⚠️ Admin Verified', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  },
  {
    title: 'Pharmacist',
    subtitle: 'Validate & dispense prescriptions',
    pill: 'Licensed Pharmacy',
    pillColor: '#4DD4CC',
    pillBg: 'rgba(77,212,204,0.15)',
    href: '/pharmacist/signin',
    icon: 'pill',
    badge: null,
  },
  {
    title: 'Admin',
    subtitle: 'Surveillance dashboard & system control',
    pill: 'Access Key Required',
    pillColor: '#ef4444',
    pillBg: 'rgba(239,68,68,0.15)',
    href: '/admin/signin',
    icon: 'shield',
    badge: { text: '⛔ Restricted', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  },
];

/* ── Icon Components (Phosphor-style filled) ──────── */
function UserIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 256 256" fill="#4DD4CC">
      <path d="M230.93,220a8,8,0,0,1-6.93,4H32a8,8,0,0,1-6.92-12c15.23-26.33,38.7-45.21,66.09-54.16a72,72,0,1,1,73.66,0c27.39,8.95,50.86,27.83,66.09,54.16A8,8,0,0,1,230.93,220Z" />
    </svg>
  );
}

function StethoscopeIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 256 256" fill="#4DD4CC">
      <path d="M216,160a32,32,0,1,0-40,31v1a40,40,0,0,1-40,40,8,8,0,0,1,0-16,24,24,0,0,0,24-24v-1a32,32,0,0,1,24-31V112a8,8,0,0,1,8-8h8a8,8,0,0,0,0-16h-8a24,24,0,0,0-24,24v28.29A32,32,0,0,0,216,160ZM56,104H48a8,8,0,0,1,0-16h8a24,24,0,0,1,24,24v40a56,56,0,0,0,112,0V112a24,24,0,0,1,24-24h8a8,8,0,0,1,0,16h-8a8,8,0,0,0-8,8v40a72,72,0,0,1-144,0V112A8,8,0,0,0,56,104Z" />
    </svg>
  );
}

function PillIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 256 256" fill="#4DD4CC">
      <path d="M216.42,39.6a53.26,53.26,0,0,0-75.32,0L39.6,141.09a53.26,53.26,0,0,0,75.32,75.31L216.42,114.91A53.31,53.31,0,0,0,216.42,39.6ZM103.61,205.09a37.26,37.26,0,0,1-52.7-52.69L96,107.31,148.69,160Z" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 256 256" fill="#4DD4CC">
      <path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,26.07,47.05,26.4a8,8,0,0,0,4,0c1-.33,24-7.54,47.05-26.4C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm-34.34,69.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" style={{ strokeWidth: 0 }}>
      <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69l-58.35-58.34a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
    </svg>
  );
}

const iconMap: Record<string, React.FC> = {
  user: UserIcon,
  stethoscope: StethoscopeIcon,
  pill: PillIcon,
  shield: ShieldCheckIcon,
};

/* ── ECG Path for footer ──────────────────────────── */
const ecgPath = 'M0,12 L40,12 L45,12 L50,2 L55,22 L60,0 L65,20 L70,12 L110,12 L150,12 L155,12 L160,2 L165,22 L170,0 L175,20 L180,12 L220,12 L260,12';

/* ── Page ─────────────────────────────────────────── */
export default function RoleSelectorPage() {
  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      style={{
        backgroundColor: '#0F2928',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {/* Radial glow */}
      <div
        className="absolute pointer-events-none z-0"
        style={{
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 600,
          background: 'radial-gradient(circle, rgba(77,212,204,0.12) 0%, transparent 60%)',
        }}
      />

      {/* Logo */}
      <div className="relative z-10 pt-10 flex justify-center mb-12 animate-[fadeUpRole_0.6s_ease-out_forwards] opacity-0">
        <Link href="/" className="flex flex-col items-center gap-1 group">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
            style={{ background: 'linear-gradient(135deg, #166534, #15803d)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="font-syne font-[800] text-[22px] text-white leading-none">ArogyaTrack</span>
          <span className="text-[0.6rem] font-bold tracking-[0.05em] uppercase" style={{ color: '#185E59' }}>
            GOVT. OF INDIA
          </span>
        </Link>
      </div>

      {/* Heading */}
      <div className="relative z-10 text-center animate-[fadeUpRole_0.6s_ease-out_forwards] opacity-0">
        <h1 className="font-syne font-[800] text-[40px] text-white mb-2">Who are you?</h1>
        <p className="font-dm text-[15px] mb-[60px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Select your role to access the platform
        </p>
      </div>

      {/* Cards */}
      <div className="relative z-10 flex justify-center gap-5 flex-wrap max-w-[1200px] mx-auto px-4">
        {roles.map((role, i) => {
          const IconComp = iconMap[role.icon];
          return (
            <Link
              key={role.title}
              href={role.href}
              className="group relative flex flex-col w-[240px] rounded-[20px] p-9 pb-6 cursor-pointer transition-all duration-[250ms] ease-out hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(77,212,204,0.15)] max-[768px]:w-full max-[768px]:mb-3"
              style={{
                backgroundColor: '#1A3835',
                border: '1px solid rgba(77,212,204,0.15)',
                animation: `fadeUpRole 0.6s ease-out ${0.1 * (i + 1)}s forwards, borderPulse 3s infinite alternate`,
                opacity: 0,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.backgroundColor = '#1D4845';
                el.style.borderColor = 'rgba(77,212,204,0.6)';
                el.style.animationName = 'fadeUpRole';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.backgroundColor = '#1A3835';
                el.style.borderColor = 'rgba(77,212,204,0.15)';
                el.style.animationName = 'fadeUpRole, borderPulse';
              }}
            >
              {/* Badge */}
              {role.badge && (
                <span
                  className="absolute top-3 right-3 px-2 py-1 rounded-xl text-[9px] font-bold uppercase"
                  style={{ color: role.badge.color, backgroundColor: role.badge.bg }}
                >
                  {role.badge.text}
                </span>
              )}

              {/* Icon */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                style={{ backgroundColor: 'rgba(77,212,204,0.15)' }}
              >
                <IconComp />
              </div>

              {/* Title */}
              <h3 className="font-syne font-[800] text-[20px] text-white mb-2">{role.title}</h3>

              {/* Subtitle */}
              <p
                className="font-dm text-xs leading-[1.4] mb-auto min-h-[40px]"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                {role.subtitle}
              </p>

              {/* Bottom row */}
              <div className="flex items-center justify-between mt-6">
                <span
                  className="text-[10px] font-bold px-3 py-1 rounded-full"
                  style={{ color: role.pillColor, backgroundColor: role.pillBg }}
                >
                  {role.pill}
                </span>
                <span
                  className="transition-transform duration-200 group-hover:translate-x-1"
                  style={{ color: '#4DD4CC' }}
                >
                  <ArrowRightIcon />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pt-10 pb-5 mt-auto">
        {/* ECG decoration */}
        <div className="flex justify-center mb-4 opacity-20">
          <svg viewBox="0 0 260 24" className="w-48 h-5" preserveAspectRatio="none">
            <path d={ecgPath} fill="none" stroke="#4DD4CC" strokeWidth="1.5" />
          </svg>
        </div>
        <p className="text-[11px] font-dm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Ministry of Health &amp; Family Welfare | Govt. of India
        </p>
      </div>

      {/* Keyframe styles */}
      <style jsx>{`
        @keyframes fadeUpRole {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes borderPulse {
          from { border-color: rgba(77,212,204,0.15); box-shadow: 0 0 0 transparent; }
          to { border-color: rgba(77,212,204,0.3); box-shadow: 0 0 15px rgba(77,212,204,0.05); }
        }
      `}</style>
    </div>
  );
}
