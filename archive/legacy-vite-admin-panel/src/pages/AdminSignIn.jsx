import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, EnvelopeSimple, LockKey, Key, Eye, EyeSlash } from '@phosphor-icons/react';

const AdminSignIn = () => {
  const [showPass, setShowPass] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignIn = (e) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-[#0F2928] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Dot Grid */}
      <div className="absolute inset-0 z-0 opacity-30" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }}></div>

      <Link to="/role-selector" className="absolute top-8 left-8 text-white/50 hover:text-white transition hover:underline text-sm font-medium z-20">
        ← All Roles
      </Link>

      {/* Main Card */}
      <div className={`bg-[#1A3835] border border-[#4DD4CC]/20 rounded-[20px] p-12 max-w-[480px] w-full shadow-[0_24px_64px_rgba(0,0,0,0.4)] relative z-10 
        ${mounted ? 'slide-up-stagger slide-up-stagger-1' : 'opacity-0'}`}>
        
        {/* Top Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#7EDED7]/15 flex items-center justify-center mb-4">
            <ShieldCheck size={32} weight="fill" className="text-[#7EDED7]" />
          </div>
          <h1 className="font-['Syne'] text-[26px] text-white font-bold mb-1">Admin Access</h1>
          <p className="text-[#f59e0b] text-[12px] font-medium tracking-wide">Restricted — Authorized Personnel Only</p>
        </div>

        {/* Red Warning Banner */}
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg py-2.5 px-3.5 flex items-start gap-2 mb-8">
          <span className="text-[14px]">⛔</span>
          <p className="text-[#ef4444] text-[11px] font-medium leading-[1.4]">
            Unauthorized access is logged and reported<br />
            to cybersecurity authorities
          </p>
        </div>

        <form onSubmit={handleSignIn} className="flex flex-col gap-5">
          <div className="relative">
            <EnvelopeSimple size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4DD4CC]/60" weight="light" />
            <input 
              type="email" 
              placeholder="Email Address" 
              required
              className="w-full bg-[#0F2928] border border-[#4DD4CC]/20 rounded-[10px] py-[14px] pl-[2.75rem] pr-4 text-white placeholder-[#9CA8A8] outline-none transition-all duration-200 focus:border-[#4DD4CC] focus:shadow-[0_0_0_3px_rgba(77,212,204,0.1)] text-[14px]" 
            />
          </div>

          <div className="relative">
            <LockKey size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4DD4CC]/60" weight="light" />
            <input 
              type={showPass ? "text" : "password"} 
              placeholder="Password" 
              required
              className="w-full bg-[#0F2928] border border-[#4DD4CC]/20 rounded-[10px] py-[14px] pl-[2.75rem] pr-12 text-white placeholder-[#9CA8A8] outline-none transition-all duration-200 focus:border-[#4DD4CC] focus:shadow-[0_0_0_3px_rgba(77,212,204,0.1)] text-[14px]" 
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA8A8] hover:text-[#4DD4CC]">
              {showPass ? <EyeSlash size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="flex flex-col gap-1 mt-2">
            <label className="text-white font-medium text-[13px] flex items-center gap-1.5 ml-1">
              🔑 Access Key
            </label>
            <div className="relative">
              <Key size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#f59e0b]/60" weight="light" />
              <input 
                type={showKey ? "text" : "password"} 
                placeholder="Enter your secret access key" 
                required
                className="w-full bg-[#0F2928] border border-[#f59e0b]/30 rounded-[10px] py-[14px] pl-[2.75rem] pr-12 text-white placeholder-[#9CA8A8] outline-none transition-all duration-200 focus:border-[#f59e0b] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.1)] text-[14px]" 
              />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA8A8] hover:text-[#f59e0b]">
                {showKey ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="text-[#f59e0b] text-[11px] mt-1 ml-1 font-medium opacity-80">
              Access keys are issued by system administrators only
            </p>
          </div>

          <button type="submit" className="shared-btn-primary mt-4">Authenticate  →</button>
        </form>

        <div className="mt-8 text-center text-white/50 text-[11px] font-medium">
          Need access? Contact: <a href="mailto:admin@arogyatrack.gov.in" className="hover:text-white transition-colors underline decoration-white/20 underline-offset-2">admin@arogyatrack.gov.in</a>
        </div>
        
        <div className="absolute -bottom-10 left-0 w-full text-center">
           <p className="text-[#ef4444] text-[10px] font-bold tracking-wider opacity-60">🔴 ALL ADMIN SESSIONS ARE MONITORED AND LOGGED</p>
        </div>
      </div>
    </div>
  );
};

export default AdminSignIn;
