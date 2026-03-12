import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SplitSignInLayout from '../components/SplitSignInLayout';
import { EnvelopeSimple, LockKey, Eye, EyeSlash } from '@phosphor-icons/react';

const PharmacistSignIn = () => {
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = (e) => {
    e.preventDefault();
  };

  const pillIllustration = (
    <div className="w-full flex justify-center opacity-60">
       <svg width="140" height="140" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[#4DD4CC] drop-shadow-[0_0_15px_rgba(77,212,204,0.3)] min-w-[120px]">
          <path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"></path>
          <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"></line>
       </svg>
    </div>
  );

  return (
    <SplitSignInLayout
      role="pharmacist"
      heading="Pharmacist Portal"
      subtitle="Licensed pharmacies only"
      description="Validate and dispense prescriptions safely and track real-time inventory."
      features={[
        "Prescription Validation & QR Scan",
        "Real-time Inventory Management",
        "Dispensing Workflow Tracking"
      ]}
      pillText="Pharmacist"
      pillColor="#0f766e"
      pillBg="#ccfbf1"
      leftBottomElement={pillIllustration}
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

          <Link to="/pharmacist/register" className="shared-btn-ghost w-full">Register Pharmacy →</Link>
        </form>
      </div>
    </SplitSignInLayout>
  );
};

export default PharmacistSignIn;
