import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SplitSignInLayout from '../components/SplitSignInLayout';
import { EnvelopeSimple, LockKey, Eye, EyeSlash } from '@phosphor-icons/react';

const PatientSignIn = () => {
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = (e) => {
    e.preventDefault();
    // mock sign in
  };

  const healthCardMockup = (
    <div className="bg-[#1A3835] rounded-2xl p-6 border border-[#4DD4CC]/30 shadow-[0_0_20px_rgba(77,212,204,0.15)] relative overflow-hidden">
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#4DD4CC]/10 rounded-full blur-2xl"></div>
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-[#1F6F6A] to-[#185E59] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
          </div>
          <span className="text-[10px] font-bold tracking-wider text-[#4DD4CC]">HEALTH CARD</span>
        </div>
      </div>
      
      <div className="flex gap-4 items-center mb-6 relative z-10">
        <div className="w-16 h-16 rounded-full bg-[#0F2928] border-2 border-[#1F6F6A] overflow-hidden flex items-center justify-center flex-shrink-0">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#4DD4CC]"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
        <div>
          <h3 className="font-['Syne'] font-bold text-xl text-white leading-tight">Aditya Patra</h3>
          <p className="font-mono text-[#4DD4CC] text-sm mt-1">HS-2026-XXXXXX</p>
        </div>
        <div className="ml-auto bg-[#dc2626]/20 text-[#fca5a5] border border-[#dc2626]/30 px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">
          A+
        </div>
      </div>
      
      <div className="flex justify-between items-end border-t border-white/10 pt-4 mt-2 relative z-10">
        <div className="w-12 h-12 bg-white/10 rounded border border-white/20 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect><rect x="14" y="14" width="3" height="3"></rect></svg>
        </div>
        <div className="text-right">
           <p className="text-[9px] text-white/40 font-bold tracking-widest uppercase mb-1">Govt of India</p>
           <p className="text-[8px] text-[#4DD4CC]/60 font-bold">AROGYATRACK VERIFIED</p>
        </div>
      </div>
      
      <p className="absolute -bottom-6 left-0 w-full text-center text-xs text-white/30 italic">
        Your card will be generated upon registration
      </p>
    </div>
  );

  return (
    <SplitSignInLayout
      role="patient"
      heading="Welcome back"
      subtitle="Patient Portal"
      description="Access your complete health journey"
      features={[
        "View Medical Records & Lab Results",
        "Track Active Prescriptions",
        "Manage Family Health Profiles"
      ]}
      pillText="Patient"
      pillColor="#1F6F6A"
      pillBg="#D9E5E3"
      leftBottomElement={healthCardMockup}
    >
      <div className="bg-white rounded-[16px] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#D9E5E3] relative z-20">
        <h2 className="font-['Syne'] text-[#2F3A3A] text-[28px] font-bold mb-1">Sign In</h2>
        <p className="text-[13px] text-[#9CA8A8] mb-8 font-medium">Enter your credentials to continue</p>
        
        <form onSubmit={handleSignIn} className="flex flex-col gap-5">
          <div className="relative">
            <EnvelopeSimple size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1F6F6A]" weight="light" />
            <input type="email" placeholder="Email Address" className="shared-input pl-[2.75rem]" required />
          </div>
          
          <div className="relative">
            <LockKey size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1F6F6A]" weight="light" />
            <input type={showPass ? "text" : "password"} placeholder="Password" className="shared-input pl-[2.75rem] pr-12" required />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA8A8] hover:text-[#1F6F6A]">
              {showPass ? <EyeSlash size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="flex items-center justify-between mt-1 mb-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-[#D9E5E3] text-[#1F6F6A] focus:ring-[#1F6F6A] accent-[#1F6F6A] cursor-pointer" />
              <span className="text-[13px] text-[#6B7C7C] group-hover:text-[#2F3A3A] transition-colors">Remember me</span>
            </label>
            <Link to="#" className="text-[13px] text-[#1F6F6A] font-semibold hover:underline">Forgot Password?</Link>
          </div>

          <button type="submit" className="shared-btn-primary">Sign In</button>
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-[#D9E5E3]"></div>
            <span className="flex-shrink-0 mx-4 text-[#9CA8A8] text-xs">or</span>
            <div className="flex-grow border-t border-[#D9E5E3]"></div>
          </div>

          <Link to="/patient/register" className="shared-btn-ghost w-full">New Patient? Create Account →</Link>
        </form>
      </div>
    </SplitSignInLayout>
  );
};

export default PatientSignIn;
