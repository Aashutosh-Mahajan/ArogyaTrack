import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MultiStepProgress from '../components/MultiStepProgress';
import ChipSelect from '../components/ChipSelect';
import UploadBox from '../components/UploadBox';
import { User, CalendarBlank, Droplet, Phone, EnvelopeSimple, LockKey, Eye, EyeSlash, Plus, Trash } from '@phosphor-icons/react';

const PatientRegister = () => {
  const [step, setStep] = useState(0);
  const steps = ["Basic Info", "Health History", "Account Setup"];
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Form State
  const [formData, setFormData] = useState({
    name: '', dob: '', gender: 'Male', bloodGroup: 'A+', phone: '', email: '',
    conditions: [], customCondition: '', allergies: [], customAllergy: '',
    surgeries: '', medications: [], contactName: '', contactPhone: '', contactRelation: 'Parent',
    street: '', district: '', state: 'Maharashtra', pin: '',
    password: '', confirmPassword: '',
    consent1: false, consent2: false, consent3: false
  });

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
  const conditionOptions = ["Diabetes", "Hypertension", "Heart Disease", "Asthma", "Thyroid Disorder", "Kidney Disease", "Liver Disease", "Cancer", "None"];
  const allergyOptions = ["Penicillin", "Aspirin", "Sulfa Drugs", "NSAIDs", "Latex", "Peanuts", "Shellfish", "None"];
  
  const handleMedicationAdd = () => {
    setFormData({...formData, medications: [...formData.medications, { name: '', dosage: '' }]});
  };

  const handleMedicationChange = (index, field, value) => {
    const newMeds = [...formData.medications];
    newMeds[index][field] = value;
    setFormData({...formData, medications: newMeds});
  };

  const handleMedicationRemove = (index) => {
    const newMeds = formData.medications.filter((_, i) => i !== index);
    setFormData({...formData, medications: newMeds});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => {
      navigate('/patient/dashboard'); // Mock redirect
    }, 3000);
  };

  const passStrengthVal = formData.password.length;
  let strengthLabel = 'Weak', strengthColor = '#ef4444', strengthPercent = 25;
  if (passStrengthVal > 5) { strengthLabel = 'Fair'; strengthColor = '#f59e0b'; strengthPercent = 50; }
  if (passStrengthVal > 8) { strengthLabel = 'Strong'; strengthColor = '#3b82f6'; strengthPercent = 75; }
  if (passStrengthVal > 11) { strengthLabel = 'Very Strong'; strengthColor = '#1F6F6A'; strengthPercent = 100; }

  const livePreviewCard = (
    <div className="sticky top-10 bg-[#1A3835] rounded-2xl p-6 border border-[#4DD4CC]/30 shadow-[0_0_30px_rgba(77,212,204,0.15)] overflow-hidden">
      <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-[#4DD4CC]/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-[#1F6F6A] to-[#185E59] flex items-center justify-center">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
          </div>
          <span className="text-[12px] font-bold tracking-widest text-[#4DD4CC]">HEALTH CARD</span>
        </div>
      </div>
      
      <div className="flex gap-5 items-center mb-8 relative z-10">
        <div className="w-20 h-20 rounded-full bg-[#0F2928] border-[3px] border-[#1F6F6A] overflow-hidden flex items-center justify-center flex-shrink-0">
          <User size={36} weight="fill" className="text-[#4DD4CC]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-['Syne'] font-bold text-2xl text-white truncate leading-tight">
            {formData.name || "Your Name"}
          </h3>
          <p className="font-mono text-[#4DD4CC] text-sm mt-1">HS-2026-XXXXXX</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
         <div className="bg-white/5 p-3 rounded-lg border border-white/10">
            <span className="text-[10px] text-white/50 font-bold block mb-1">BLOOD GROUP</span>
            <span className="text-sm text-white font-medium bg-[#dc2626]/20 text-[#fca5a5] border border-[#dc2626]/30 px-2 py-0.5 rounded inline-block">{formData.bloodGroup}</span>
         </div>
         <div className="bg-white/5 p-3 rounded-lg border border-white/10">
            <span className="text-[10px] text-white/50 font-bold block mb-1">GENDER & DOB</span>
            <span className="text-sm text-white font-medium block truncate">{formData.gender} {formData.dob ? `| ${formData.dob}` : ''}</span>
         </div>
      </div>
      
      <div className="flex justify-between items-end border-t border-white/10 pt-5 relative z-10">
        <div className="w-16 h-16 bg-white/10 rounded-lg border border-white/20 flex items-center justify-center">
          <span className="text-[10px] text-white/30 text-center leading-tight font-medium">Scan to<br/>verify</span>
        </div>
        <div className="text-right">
           <p className="text-[10px] text-white/40 font-bold tracking-widest uppercase mb-1">Govt of India</p>
           <p className="text-[9px] text-[#4DD4CC]/60 font-bold tracking-wide">AROGYATRACK VERIFIED</p>
        </div>
      </div>
      
      <p className="text-center text-[11px] text-[#4DD4CC]/60 italic mt-6 relative z-10">
        Your permanent card will be generated upon registration
      </p>
    </div>
  );

  if (success) {
    return (
      <div className="min-h-screen bg-[#EEF3F2] flex flex-col items-center justify-center p-6 text-center">
         <div className="bg-white rounded-2xl p-12 max-w-lg w-full shadow-2xl border border-[#D9E5E3] fade-up-element in-view">
            <div className="w-24 h-24 bg-[#1F6F6A] rounded-full mx-auto flex items-center justify-center mb-6">
               <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h1 className="font-['Syne'] text-3xl font-bold text-[#2F3A3A] mb-2">Account Created Successfully!</h1>
            <p className="text-[#6B7C7C] mb-8">Generating your secure health card profile...</p>
            
            <div className="w-full bg-[#EEF3F2] h-2 rounded-full overflow-hidden mb-4">
               <div className="bg-[#1F6F6A] h-full transition-all duration-1000 ease-out w-full"></div>
            </div>
            <p className="text-xs text-[#1F6F6A] font-bold animate-pulse">Redirecting to dashboard in 3s...</p>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF3F2] py-12 px-6 overflow-x-hidden">
      <div className="max-w-[960px] mx-auto relative">
        <Link to="/patient/signin" className="text-[#1F6F6A] hover:underline mb-8 inline-block font-semibold text-sm">
          ← Back to Sign In
        </Link>
        
        <div className={`text-center mb-12 ${mounted ? 'slide-up-stagger slide-up-stagger-1' : 'opacity-0'}`}>
          <h1 className="font-['Syne'] text-4xl text-[#2F3A3A] font-bold mb-3">Create Your Health Profile</h1>
          <p className="text-[#6B7C7C] text-[15px]">Join 1.4B+ citizens on ArogyaTrack</p>
        </div>

        <div className={mounted ? 'slide-up-stagger slide-up-stagger-2' : 'opacity-0'}>
           <MultiStepProgress steps={steps} currentStep={step} />
        </div>

        <div className={`transition-all duration-500 ${mounted ? 'slide-up-stagger slide-up-stagger-3' : 'opacity-0'}`}>
          {step === 0 && (
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="w-full lg:w-[60%] bg-white rounded-2xl p-8 shadow-sm border border-[#D9E5E3]">
                <form className="flex flex-col gap-5">
                  <UploadBox label="Profile Photo" hint="Square aspect ratio — max 2MB" />
                  
                  <div className="relative">
                    <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1F6F6A]" weight="light" />
                    <input type="text" placeholder="Full Name (as per Govt ID)" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="shared-input pl-11" required />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <CalendarBlank size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1F6F6A]" weight="light" />
                      <input type="date" value={formData.dob} onChange={e=>setFormData({...formData, dob: e.target.value})} className="shared-input pl-11 text-[#2F3A3A]" required />
                    </div>
                    <div>
                      <select value={formData.bloodGroup} onChange={e=>setFormData({...formData, bloodGroup: e.target.value})} className="shared-input font-bold text-[#dc2626]">
                        {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-[#9CA8A8] mb-2 uppercase tracking-wider">Gender</label>
                     <div className="flex gap-2">
                        {['Male', 'Female', 'Other'].map(g => (
                           <button 
                             key={g} type="button" 
                             onClick={() => setFormData({...formData, gender: g})}
                             className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${formData.gender === g ? 'bg-[#1F6F6A] text-white border-[#1F6F6A]' : 'bg-[#EEF3F2] text-[#1F6F6A] border-[#D9E5E3] hover:bg-[#DEEEED]'}`}
                           >
                             {g}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div className="flex gap-2">
                     <span className="flex items-center justify-center bg-[#EEF3F2] border border-[#D9E5E3] rounded-lg px-4 text-[#1F6F6A] font-bold text-sm">+91</span>
                     <input type="tel" placeholder="Mobile Number" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} className="shared-input flex-1" required />
                  </div>
                  
                  <div className="relative">
                    <EnvelopeSimple size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1F6F6A]" weight="light" />
                    <input type="email" placeholder="Email Address (Optional)" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="shared-input pl-11" />
                  </div>
                </form>
              </div>
              <div className="w-full lg:w-[40%]">
                 {livePreviewCard}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#D9E5E3]">
               <h3 className="font-['Syne'] text-xl font-bold text-[#2F3A3A] mb-6">Help doctors understand you better</h3>
               
               <div className="mb-8">
                 <label className="block text-sm font-bold text-[#2F3A3A] mb-3">Existing Medical Conditions</label>
                 <ChipSelect options={conditionOptions} selected={formData.conditions} onChange={(v) => setFormData({...formData, conditions: v})} multi />
                 <div className="flex gap-2 mt-3">
                   <input type="text" placeholder="Add custom condition..." className="shared-input py-2 flex-1" />
                   <button type="button" className="bg-[#EEF3F2] border border-[#D9E5E3] text-[#1F6F6A] px-4 rounded-lg hover:bg-[#DEEEED]"><Plus weight="bold" /></button>
                 </div>
               </div>

               <div className="mb-8">
                 <label className="block text-sm font-bold text-[#2F3A3A] mb-3">Known Allergies</label>
                 <ChipSelect options={allergyOptions} selected={formData.allergies} onChange={(v) => setFormData({...formData, allergies: v})} multi />
                 <div className="flex gap-2 mt-3">
                   <input type="text" placeholder="Add custom allergy..." className="shared-input py-2 flex-1" />
                   <button type="button" className="bg-[#EEF3F2] border border-[#D9E5E3] text-[#1F6F6A] px-4 rounded-lg hover:bg-[#DEEEED]"><Plus weight="bold" /></button>
                 </div>
               </div>

               <div className="mb-8">
                 <label className="block text-sm font-bold text-[#2F3A3A] mb-3">Past Surgeries / Hospitalizations</label>
                 <textarea placeholder="E.g. Appendectomy 2019, Hospitalized for pneumonia 2022..." rows={4} className="shared-input resize-y"></textarea>
               </div>

               <div className="mb-8 p-6 bg-[#EEF3F2]/50 border border-[#D9E5E3] rounded-xl">
                 <label className="block text-sm font-bold text-[#2F3A3A] mb-3 text-center">Current Medications</label>
                 {formData.medications.map((med, index) => (
                    <div key={index} className="flex gap-2 mb-3">
                       <input type="text" placeholder="Medicine Name" value={med.name} onChange={(e) => handleMedicationChange(index, 'name', e.target.value)} className="shared-input py-2 flex-1" />
                       <input type="text" placeholder="Dosage (e.g. 50mg)" value={med.dosage} onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)} className="shared-input py-2 w-[120px]" />
                       <button type="button" onClick={() => handleMedicationRemove(index)} className="text-[#ef4444] p-2 hover:bg-[#ef4444]/10 border border-transparent hover:border-[#ef4444]/30 rounded-lg"><Trash size={20} /></button>
                    </div>
                 ))}
                 <button type="button" onClick={handleMedicationAdd} className="shared-btn-ghost w-full py-2 text-sm mt-2 border-dashed">
                    <Plus weight="bold" /> Add Medication
                 </button>
               </div>

               <div className="mb-2">
                 <label className="block text-sm font-bold text-[#2F3A3A] mb-3 flex items-center gap-2">
                    <Phone size={18} className="text-[#1F6F6A]" weight="bold" /> Emergency Contact
                 </label>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input type="text" placeholder="Contact Name" className="shared-input" />
                    <input type="tel" placeholder="Phone Number" className="shared-input" />
                    <select className="shared-input">
                       <option>Parent</option><option>Spouse</option><option>Sibling</option><option>Child</option><option>Friend</option><option>Other</option>
                    </select>
                 </div>
               </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#D9E5E3] max-w-2xl mx-auto">
               
               <div className="mb-10 text-center">
                  <h3 className="font-['Syne'] text-xl font-bold text-[#2F3A3A] mb-1">Verify Mobile Number</h3>
                  <p className="text-sm text-[#6B7C7C]">We sent a 6-digit code to +91 {formData.phone || "9876543210"}</p>
                  
                  <div className="flex justify-center gap-3 mt-6 mb-4">
                     {[1,2,3,4,5,6].map(i => (
                        <input key={i} type="text" maxLength={1} className="w-12 h-12 text-center text-xl font-bold border-2 border-[#D9E5E3] rounded-lg focus:border-[#1F6F6A] focus:outline-none" />
                     ))}
                  </div>
                  <button type="button" className="text-xs text-[#1F6F6A] font-bold hover:underline">Resend OTP in 30s</button>
               </div>
               
               <div className="border-t border-[#D9E5E3] pt-8 mb-8">
                  <h3 className="text-sm font-bold text-[#2F3A3A] mb-4">Secure Your Account</h3>
                  
                  <div className="mb-4">
                     <div className="relative">
                       <LockKey size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1F6F6A]" weight="light" />
                       <input type={showPass ? "text" : "password"} placeholder="Create Password" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="shared-input pl-11 pr-12" required />
                       <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA8A8] hover:text-[#1F6F6A]">
                         {showPass ? <EyeSlash size={20} /> : <Eye size={20} />}
                       </button>
                     </div>
                     
                     <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-[#EEF3F2] rounded-full overflow-hidden flex">
                           <div className="h-full transition-all duration-300" style={{ width: `${strengthPercent}%`, backgroundColor: strengthColor }}></div>
                        </div>
                        <span className="text-[10px] font-bold uppercase w-20 text-right" style={{ color: strengthColor }}>{strengthLabel}</span>
                     </div>
                  </div>

                  <div className="relative mb-8">
                    <LockKey size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1F6F6A]" weight="light" />
                    <input type={showConfirm ? "text" : "password"} placeholder="Confirm Password" value={formData.confirmPassword} onChange={e=>setFormData({...formData, confirmPassword: e.target.value})} className="shared-input pl-11 pr-12" required />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA8A8] hover:text-[#1F6F6A]">
                      {showConfirm ? <EyeSlash size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-4 mb-8">
                     <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" className="w-5 h-5 mt-0.5 rounded border-[#D9E5E3] text-[#1F6F6A] focus:ring-[#1F6F6A] cursor-pointer" />
                        <span className="text-sm text-[#6B7C7C] leading-tight">I consent to sharing anonymized health data for public health surveillance purposes</span>
                     </label>
                     <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" className="w-5 h-5 mt-0.5 rounded border-[#D9E5E3] text-[#1F6F6A] focus:ring-[#1F6F6A] cursor-pointer" />
                        <span className="text-sm text-[#6B7C7C] leading-tight">I agree to the <a href="#" className="text-[#1F6F6A] font-semibold underline">Terms of Service</a> and <a href="#" className="text-[#1F6F6A] font-semibold underline">Privacy Policy</a></span>
                     </label>
                     <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" className="w-5 h-5 mt-0.5 rounded border-[#D9E5E3] text-[#1F6F6A] focus:ring-[#1F6F6A] cursor-pointer" />
                        <span className="text-sm text-[#6B7C7C] leading-tight">I consent to receive medication reminders via SMS and email</span>
                     </label>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="mt-8 flex justify-between max-w-2xl mx-auto w-full">
           {step > 0 ? (
             <button type="button" onClick={() => setStep(step - 1)} className="shared-btn-ghost w-40">← Previous</button>
           ) : <div></div>}
           
           {step < steps.length - 1 ? (
             <button type="button" onClick={() => setStep(step + 1)} className="shared-btn-primary w-40">Next →</button>
           ) : (
             <button type="button" onClick={handleSubmit} className="shared-btn-primary w-48 shadow-[0_0_20px_rgba(31,111,106,0.4)] hover:shadow-[0_0_25px_rgba(31,111,106,0.6)]">Create My Account</button>
           )}
        </div>
      </div>
    </div>
  );
};

export default PatientRegister;
