import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MultiStepProgress from '../components/MultiStepProgress';
import UploadBox from '../components/UploadBox';
import { HourglassMedium } from '@phosphor-icons/react';

const PharmacistRegister = () => {
  const [step, setStep] = useState(0);
  const steps = ["Pharmacy Details", "Documents & Account"];
  const [mounted, setMounted] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    pharmacyName: '', pharmacyReg: '', councilLicense: '', drugLicense: '', gst: '',
    type: 'Retail Pharmacy', address: '', city: '', state: 'Maharashtra', pin: '',
    fromTime: '09:00', toTime: '21:00', open24: false, phPhone: '', phEmail: '',
    password: '', confirmPassword: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#EEF3F2] flex flex-col items-center justify-center p-6 text-center">
         <div className="bg-white rounded-2xl p-12 max-w-lg w-full shadow-2xl border border-[#D9E5E3] fade-up-element in-view">
            <div className="mx-auto w-24 h-24 mb-6 relative flex justify-center items-center">
              <div className="absolute inset-0 bg-[#0f766e]/20 rounded-full animate-ping"></div>
              <HourglassMedium size={64} weight="duotone" className="text-[#0f766e] relative z-10 animate-pulse" />
            </div>
            
            <h1 className="font-['Syne'] text-3xl font-bold text-[#0f766e] mb-2">Application Submitted!</h1>
            <p className="text-[#2F3A3A] font-bold mb-1">Your pharmacy application is under review</p>
            <p className="text-[#6B7C7C] text-sm mb-6">Expected review time: 24-48 hours</p>
            
            <div className="bg-[#ccfbf1]/50 border border-[#99f6e4] rounded-xl p-4 text-left mb-8">
               <p className="text-xs text-[#6B7C7C] mb-3">You will receive an email at <span className="font-bold text-[#2F3A3A]">{formData.email || 'your email'}</span> once activated.</p>
            </div>
            
            <Link to="/" className="text-[#0f766e] font-bold text-sm hover:underline">Return Home →</Link>
         </div>
      </div>
    );
  }

  const passStrengthVal = formData.password.length;
  let strengthLabel = 'Weak', strengthColor = '#ef4444', strengthPct = 25;
  if (passStrengthVal > 7) { strengthLabel = 'Strong'; strengthColor = '#0f766e'; strengthPct = 100; }

  return (
    <div className="min-h-screen bg-[#EEF3F2] py-12 px-6">
      <div className="max-w-[800px] mx-auto relative">
        <Link to="/pharmacist/signin" className="text-[#1F6F6A] hover:underline mb-8 inline-block font-semibold text-sm">
          ← Back to Sign In
        </Link>
        
        <div className={`text-center mb-12 ${mounted ? 'slide-up-stagger slide-up-stagger-1' : 'opacity-0'}`}>
          <h1 className="font-['Syne'] text-4xl text-[#2F3A3A] font-bold mb-3">Pharmacy Registration</h1>
        </div>

        <div className={`mb-12 ${mounted ? 'slide-up-stagger slide-up-stagger-2' : 'opacity-0'}`}>
           <MultiStepProgress steps={steps} currentStep={step} />
        </div>

        <div className={`transition-all duration-500 bg-white rounded-2xl p-8 shadow-sm border border-[#D9E5E3] ${mounted ? 'slide-up-stagger slide-up-stagger-3' : 'opacity-0'}`}>
          
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="col-span-1 md:col-span-2">
                  <h3 className="text-sm font-bold text-[#2F3A3A] mb-4 border-b border-[#D9E5E3] pb-2">PERSONAL DETAILS</h3>
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Pharmacist Full Name</label>
                  <input type="text" className="shared-input" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Email Address</label>
                  <input type="email" className="shared-input" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Phone</label>
                  <input type="tel" className="shared-input" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} />
               </div>
               
               <div className="col-span-1 md:col-span-2 mt-4">
                  <h3 className="text-sm font-bold text-[#2F3A3A] mb-4 border-b border-[#D9E5E3] pb-2">PHARMACY DETAILS</h3>
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Pharmacy Name *</label>
                  <input type="text" className="shared-input" value={formData.pharmacyName} onChange={e=>setFormData({...formData, pharmacyName: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">State Pharmacy Reg. Number *</label>
                  <input type="text" className="shared-input" value={formData.pharmacyReg} onChange={e=>setFormData({...formData, pharmacyReg: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Pharmacy Council of India Lic. *</label>
                  <input type="text" className="shared-input" value={formData.councilLicense} onChange={e=>setFormData({...formData, councilLicense: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Drug License Number *</label>
                  <input type="text" className="shared-input" value={formData.drugLicense} onChange={e=>setFormData({...formData, drugLicense: e.target.value})} />
               </div>
               
               <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Pharmacy Type</label>
                  <div className="flex gap-2 text-sm justify-between">
                     {['Retail Pharmacy', 'Hospital Pharmacy', 'Online Pharmacy'].map(t => (
                        <button key={t} type="button" onClick={() => setFormData({...formData, type: t})}
                          className={`flex-1 py-2 px-1 rounded-lg font-semibold transition-colors border ${formData.type === t ? 'bg-[#1F6F6A] text-white border-[#1F6F6A]' : 'bg-[#EEF3F2] text-[#1F6F6A] border-[#D9E5E3]'}`}>
                          {t}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Street Address</label>
                  <input type="text" className="shared-input" value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})} />
               </div>
               
               <div className="flex gap-4 col-span-1 md:col-span-2">
                  <div className="flex-1">
                     <label className="block text-xs font-bold text-[#2F3A3A] mb-2">State</label>
                     <select className="shared-input" value={formData.state} onChange={e=>setFormData({...formData, state: e.target.value})}>
                        <option>Maharashtra</option><option>Delhi</option>
                     </select>
                  </div>
                  <div className="w-1/3">
                     <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Pincode</label>
                     <input type="text" className="shared-input" value={formData.pin} onChange={e=>setFormData({...formData, pin: e.target.value})} />
                  </div>
               </div>

               <div className="col-span-1 md:col-span-2 flex items-end gap-3 p-4 bg-[#EEF3F2]/50 border border-[#D9E5E3] rounded-xl">
                  <div className="flex-1">
                     <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Operating Hours</label>
                     <div className="flex gap-2 items-center">
                        <input type="time" disabled={formData.open24} className="shared-input py-1.5" value={formData.fromTime} onChange={e=>setFormData({...formData, fromTime: e.target.value})} />
                        <span>to</span>
                        <input type="time" disabled={formData.open24} className="shared-input py-1.5" value={formData.toTime} onChange={e=>setFormData({...formData, toTime: e.target.value})} />
                     </div>
                  </div>
                  <label className="flex items-center gap-2 pb-2">
                     <input type="checkbox" className="w-4 h-4 rounded border-[#D9E5E3] text-[#1F6F6A] focus:ring-[#1F6F6A]" checked={formData.open24} onChange={e=>setFormData({...formData, open24: e.target.checked})} />
                     <span className="text-sm font-bold text-[#2F3A3A]">Open 24 hours</span>
                  </label>
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Pharmacy Phone Number</label>
                  <input type="tel" className="shared-input" value={formData.phPhone} onChange={e=>setFormData({...formData, phPhone: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Pharmacy Email (Optional)</label>
                  <input type="email" className="shared-input" value={formData.phEmail} onChange={e=>setFormData({...formData, phEmail: e.target.value})} />
               </div>
            </div>
          )}

          {step === 1 && (
            <div>
               <div className="text-center mb-10">
                  <h3 className="font-['Syne'] text-xl font-bold text-[#2F3A3A] mb-1">Documents & Account</h3>
               </div>

               <UploadBox label="📄 Pharmacy Registration Certificate" required />
               <UploadBox label="🪪 Pharmacist Degree / License" hint="D.Pharm / B.Pharm certificate" required />
               <UploadBox label="🏪 Drug License Certificate" required />

               <div className="border-t border-[#D9E5E3] pt-8 mb-4">
                  <h3 className="text-sm font-bold text-[#2F3A3A] mb-4">Create Account Password</h3>
                  <div className="mb-4">
                     <input type="password" placeholder="Create Password" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="shared-input" required />
                     <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 h-1 bg-[#EEF3F2] rounded-full overflow-hidden flex">
                           <div className="h-full transition-all duration-300" style={{ width: `${strengthPct}%`, backgroundColor: strengthColor }}></div>
                        </div>
                     </div>
                  </div>
                  <div>
                     <input type="password" placeholder="Confirm Password" value={formData.confirmPassword} onChange={e=>setFormData({...formData, confirmPassword: e.target.value})} className="shared-input" required />
                  </div>
               </div>
            </div>
          )}

        </div>

        {/* Navigation Footer */}
        <div className="mt-8 flex justify-between w-full">
           {step > 0 ? (
             <button type="button" onClick={() => setStep(step - 1)} className="shared-btn-ghost w-40">← Previous</button>
           ) : <div></div>}
           
           {step < steps.length - 1 ? (
             <button type="button" onClick={() => setStep(step + 1)} className="shared-btn-primary w-40">Next →</button>
           ) : (
             <button type="button" onClick={handleSubmit} className="shared-btn-primary w-56 shadow-[0_0_20px_rgba(31,111,106,0.4)]">Register Pharmacy →</button>
           )}
        </div>

      </div>
    </div>
  );
};

export default PharmacistRegister;
