import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const SplitSignInLayout = ({
  role,
  heading,
  subtitle,
  description,
  features,
  pillColor = '#1F6F6A',
  pillBg = '#EEF3F2',
  pillText,
  leftBottomElement,
  children
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="flex min-h-screen bg-[#EEF3F2] overflow-hidden">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] bg-[#0F2928] px-12 py-10 text-white relative">
        <div className={`z-10 relative ${mounted ? 'slide-up-stagger slide-up-stagger-1' : 'opacity-0'}`}>
          <Link to="/role-selector" className="text-white/50 hover:text-white mb-10 inline-block transition hover:underline text-sm font-medium">
            ← All Roles
          </Link>
          
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1F6F6A] to-[#185E59] flex items-center justify-center">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
            </div>
            <div className="flex flex-col">
              <span className="font-['Syne'] font-bold text-lg text-[#1F6F6A] leading-none">ArogyaTrack</span>
              <span className="text-[0.6rem] font-bold tracking-wider text-[#185E59] mt-0.5">GOVT. OF INDIA</span>
            </div>
          </div>

          <h1 className="font-['Syne'] text-4xl font-bold mb-2">{heading}</h1>
          <h2 className="text-xl text-[#4DD4CC] mb-4 font-['Syne']">{subtitle}</h2>
          <p className="text-white/60 mb-10 max-w-sm">{description}</p>

          <div className="flex flex-col gap-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="bg-[#1F6F6A] p-1 rounded-full text-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <span className="text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`z-10 relative mt-12 ${mounted ? 'slide-up-stagger slide-up-stagger-4' : 'opacity-0'}`}>
          {leftBottomElement}
        </div>

        {/* Faint ECG SVG line bottom */}
        <div className="absolute bottom-0 left-0 w-full h-16 opacity-10 pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100%25' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 8 L50 8 L60 0 L70 16 L80 8 L100 8' stroke='%234ade80' stroke-width='2' fill='none' vector-effect='non-scaling-stroke'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat-x',
          backgroundSize: '80px 16px',
          backgroundPosition: 'bottom'
        }}></div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-[58%] flex flex-col justify-center items-center p-6 lg:p-16 relative">
        <div className={`absolute top-8 right-8 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide`} style={{ backgroundColor: pillBg, color: pillColor }}>
          {pillText}
        </div>

        <div className={`w-full max-w-md ${mounted ? 'slide-in-right' : 'opacity-0'}`}>
          {children}
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-[#9CA8A8] whitespace-nowrap flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          Protected by ArogyaTrack Security | HIPAA Compliant
        </div>
      </div>
    </div>
  );
};

export default SplitSignInLayout;
