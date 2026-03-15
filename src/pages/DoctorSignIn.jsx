import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SplitSignInLayout from '../components/SplitSignInLayout';
import { EnvelopeSimple, LockKey, Eye, EyeSlash } from '@phosphor-icons/react';

const DoctorSignIn = () => {
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = (e) => {
    e.preventDefault();
  };

  const amberWarning = (
    <div className="bg-[#1A3835] rounded-2xl p-5 border border-[#f59e0b]/40 shadow-[0_4px_16px_rgba(245,158,11,0.1)] flex items-start gap-3">
      <span className="text-xl">⚠️</span>
      <p className="text-[13px] text-[#f59e0b] leading-tight font-medium">
        New registrations require admin approval.<br />
        Allow 24-48 hours after document submission.
      </p>
    </div>
  );

  return (
    <SplitSignInLayout
      role="doctor"
      heading="Doctor Portal"
      subtitle="Verified professionals only"
      description="Access patient records and write electronic prescriptions securely."
      features={[
        "QR-Based Patient Lookup",
        "AI-Assisted E-Prescriptions",
        "Drug Interaction Alerts"
      ]}
      pillText="Doctor"
      pillColor="#1F6F6A"
      pillBg="#D9E5E3"
      leftBottomElement={amberWarning}
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

          <Link to="/doctor/register" className="shared-btn-ghost w-full">Register as Doctor →</Link>
        </form>
      </div>
    </SplitSignInLayout>
  );
};

export default DoctorSignIn;
