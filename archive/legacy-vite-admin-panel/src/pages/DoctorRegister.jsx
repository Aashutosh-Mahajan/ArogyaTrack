import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MultiStepProgress from '../components/MultiStepProgress';
import ChipSelect from '../components/ChipSelect';
import UploadBox from '../components/UploadBox';
import { Plus, Trash, HourglassMedium, Info } from '@phosphor-icons/react';

const DoctorRegister = () => {
  const [step, setStep] = useState(0);
  const steps = ["Personal Info", "Credentials", "Documents"];
  const [mounted, setMounted] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', dob: '', gender: 'Male',
    clinicName: '', clinicPhone: '', clinicAddress: '', city: '', state: 'Maharashtra', pin: '',
    experience: 0, languages: [],
    licenseNo: '', councilType: 'State Medical Council', stateCouncil: '', councilNo: '',
    degrees: [{ degree: 'MBBS', institution: '', year: '2015' }],
    specialization: 'General Medicine', subSpecialization: '', consultationFee: '',
    password: '', confirmPassword: ''
  });

  const langOptions = ["Hindi", "English", "Marathi", "Tamil", "Telugu", "Bengali", "Kannada", "Malayalam", "Gujarati", "Other"];
  const degOptions = ["MBBS", "MD", "MS", "DM", "MCh", "DNB", "BAMS", "BDS", "MDS", "BHMS", "Other"];
  const specOptions = ["General Medicine", "Cardiology", "Neurology", "Orthopedics", "Pediatrics", "Gynecology & Obstetrics", "Psychiatry", "Dermatology", "Oncology", "Radiology", "Anesthesiology", "Ophthalmology", "ENT", "Urology", "Nephrology", "Gastroenterology", "Endocrinology", "Pulmonology", "Emergency Medicine"];

  const handleAddDegree = () => {
    setFormData({...formData, degrees: [...formData.degrees, { degree: 'MBBS', institution: '', year: '' }]});
  };
  const handleRemoveDegree = (index) => {
    setFormData({...formData, degrees: formData.degrees.filter((_, i) => i !== index)});
  };
  const handleDegreeChange = (i, field, val) => {
    const d = [...formData.degrees];
    d[i][field] = val;
    setFormData({...formData, degrees: d});
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#EEF3F2] flex flex-col items-center justify-center p-6 text-center">
         <div className="bg-white rounded-2xl p-12 max-w-lg w-full shadow-2xl border border-[#D9E5E3] fade-up-element in-view">
            <div className="mx-auto w-24 h-24 mb-6 relative flex justify-center items-center">
              <div className="absolute inset-0 bg-[#f59e0b]/20 rounded-full animate-ping"></div>
              <HourglassMedium size={64} weight="duotone" className="text-[#1F6F6A] relative z-10 animate-pulse" />
            </div>
            
            <h1 className="font-['Syne'] text-3xl font-bold text-[#1F6F6A] mb-2">Application Submitted!</h1>
            <p className="text-[#2F3A3A] font-bold mb-1">Your application is under review</p>
            <p className="text-[#6B7C7C] text-sm mb-6">Expected review time: 24-48 hours</p>
            
            <div className="bg-[#EEF3F2] border border-[#D9E5E3] rounded-xl p-4 text-left mb-8">
               <p className="text-xs text-[#6B7C7C] mb-3">You will receive an email at <span className="font-bold text-[#2F3A3A]">{formData.email || 'your email'}</span> once your account is activated.</p>
               <ol className="text-xs text-[#1F6F6A] font-medium flex flex-col gap-2 pl-4 list-decimal marker:text-[#1F6F6A]">
                 <li>Document review by admin</li>
                 <li>License verification</li>
                 <li>Account activation</li>
                 <li>Access granted</li>
               </ol>
            </div>
            
            <button className="text-[#1F6F6A] font-bold text-sm hover:underline">Track application status →</button>
         </div>
      </div>
    );
  }

  const passStrengthVal = formData.password.length;
  let strengthLabel = 'Weak', strengthColor = '#ef4444', strengthPct = 25;
  if (passStrengthVal > 5) { strengthLabel = 'Fair'; strengthColor = '#f59e0b'; strengthPct = 50; }
  if (passStrengthVal > 8) { strengthLabel = 'Strong'; strengthColor = '#3b82f6'; strengthPct = 75; }
  if (passStrengthVal > 11) { strengthLabel = 'Very Strong'; strengthColor = '#1F6F6A'; strengthPct = 100; }

  return (
    <div className="min-h-screen bg-[#EEF3F2] py-12 px-6">
      <div className="max-w-[800px] mx-auto relative">
        <Link to="/doctor/signin" className="text-[#1F6F6A] hover:underline mb-8 inline-block font-semibold text-sm">
          ← Back to Sign In
        </Link>
        
        <div className={`mb-8 ${mounted ? 'slide-up-stagger slide-up-stagger-1' : 'opacity-0'}`}>
          <h1 className="font-['Syne'] text-4xl text-[#2F3A3A] font-bold mb-6 text-center">Doctor Registration</h1>
          
          <div className="bg-[#f59e0b]/10 border border-[#f59e0b] rounded-[10px] p-4 flex items-start gap-3">
             <span className="text-lg leading-none">⚠️</span>
             <p className="text-sm text-[#f59e0b] font-medium leading-tight">
               Your account requires admin verification before activation. This takes 24-48 hours.
             </p>
          </div>
        </div>

        <div className={`mb-12 ${mounted ? 'slide-up-stagger slide-up-stagger-2' : 'opacity-0'}`}>
           <MultiStepProgress steps={steps} currentStep={step} />
        </div>

        <div className={`transition-all duration-500 bg-white rounded-2xl p-8 shadow-sm border border-[#D9E5E3] ${mounted ? 'slide-up-stagger slide-up-stagger-3' : 'opacity-0'}`}>
          
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="col-span-1 md:col-span-2">
                  <UploadBox label="Profile Photo" hint="Professional headshot recommended (Square)" />
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Full Name</label>
                  <input type="text" className="shared-input" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Email Address</label>
                  <input type="email" className="shared-input" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Phone Number</label>
                  <div className="flex gap-2">
                     <span className="flex items-center justify-center bg-[#EEF3F2] border border-[#D9E5E3] rounded-lg px-3 text-[#1F6F6A] font-bold text-sm">+91</span>
                     <input type="tel" className="shared-input flex-1" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} />
                  </div>
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Date of Birth</label>
                  <input type="date" className="shared-input text-[#2F3A3A]" value={formData.dob} onChange={e=>setFormData({...formData, dob: e.target.value})} />
               </div>
               
               <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Gender</label>
                  <div className="flex gap-2 max-w-sm">
                     {['Male', 'Female', 'Other'].map(g => (
                        <button key={g} type="button" onClick={() => setFormData({...formData, gender: g})}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors border ${formData.gender === g ? 'bg-[#1F6F6A] text-white border-[#1F6F6A]' : 'bg-[#EEF3F2] text-[#1F6F6A] border-[#D9E5E3]'}`}>
                          {g}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="col-span-1 md:col-span-2 border-t border-[#D9E5E3] pt-6 mt-2">
                  <h3 className="font-bold text-[#2F3A3A] mb-4">Clinic / Hospital Details</h3>
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Clinic / Hospital Name</label>
                  <input type="text" className="shared-input" value={formData.clinicName} onChange={e=>setFormData({...formData, clinicName: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Clinic Phone</label>
                  <input type="tel" className="shared-input" value={formData.clinicPhone} onChange={e=>setFormData({...formData, clinicPhone: e.target.value})} />
               </div>
               
               <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Clinic Address</label>
                  <textarea rows={2} className="shared-input resize-y" value={formData.clinicAddress} onChange={e=>setFormData({...formData, clinicAddress: e.target.value})}></textarea>
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">City</label>
                  <input type="text" className="shared-input" value={formData.city} onChange={e=>setFormData({...formData, city: e.target.value})} />
               </div>
               <div className="flex gap-4">
                  <div className="flex-1">
                     <label className="block text-xs font-bold text-[#2F3A3A] mb-2">State</label>
                     <select className="shared-input" value={formData.state} onChange={e=>setFormData({...formData, state: e.target.value})}>
                        <option>Maharashtra</option><option>Delhi</option><option>Karnataka</option>
                     </select>
                  </div>
                  <div className="w-1/3">
                     <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Pincode</label>
                     <input type="text" className="shared-input px-2" value={formData.pin} onChange={e=>setFormData({...formData, pin: e.target.value})} />
                  </div>
               </div>

               <div className="col-span-1 md:col-span-2 border-t border-[#D9E5E3] pt-6 mt-2">
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-2">Years of Experience</label>
                  <div className="flex items-center gap-4 w-40">
                     <button type="button" onClick={() => setFormData({...formData, experience: Math.max(0, formData.experience - 1)})} className="w-10 h-10 rounded bg-[#EEF3F2] border border-[#D9E5E3] text-[#1F6F6A] font-bold text-xl flex items-center justify-center hover:bg-[#DEEEED]">-</button>
                     <span className="font-bold text-xl">{formData.experience}</span>
                     <button type="button" onClick={() => setFormData({...formData, experience: formData.experience + 1})} className="w-10 h-10 rounded bg-[#EEF3F2] border border-[#D9E5E3] text-[#1F6F6A] font-bold text-xl flex items-center justify-center hover:bg-[#DEEEED]">+</button>
                  </div>
               </div>

               <div className="col-span-1 md:col-span-2 mt-2">
                  <label className="block text-xs font-bold text-[#2F3A3A] mb-3">Languages Spoken</label>
                  <ChipSelect options={langOptions} selected={formData.languages} onChange={(v) => setFormData({...formData, languages: v})} multi />
               </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-8">
               <div>
                  <label className="flex items-center gap-1.5 text-sm font-bold text-[#2F3A3A] mb-2">
                     Medical License Number <span className="text-[#ef4444]">*</span>
                     <div className="group relative cursor-help">
                        <Info size={16} className="text-[#9CA8A8] group-hover:text-[#1F6F6A]" />
                        <div className="absolute hidden group-hover:block w-48 bg-[#2F3A3A] text-white text-[10px] p-2 rounded -top-10 left-6 z-10">
                           Found on your license certificate issued by your Medical Council
                        </div>
                     </div>
                  </label>
                  <input type="text" className="shared-input" required />
               </div>

               <div>
                  <label className="block text-sm font-bold text-[#2F3A3A] mb-2">Medical Council Registration <span className="text-[#ef4444]">*</span></label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                     <select className="shared-input" value={formData.councilType} onChange={e=>setFormData({...formData, councilType: e.target.value})}>
                        <option>State Medical Council</option>
                        <option>National Medical Commission (NMC)</option>
                     </select>
                     {formData.councilType === 'State Medical Council' && (
                        <select className="shared-input">
                           <option>Maharashtra Medical Council</option>
                           <option>Delhi Medical Council</option>
                        </select>
                     )}
                  </div>
                  <input type="text" placeholder="Council Registration Number" className="shared-input mb-1" required />
                  <p className="text-[11px] text-[#1F6F6A] font-medium">Council registration number is used for verification</p>
               </div>

               <div className="border-t border-[#D9E5E3] pt-8">
                  <label className="block text-sm font-bold text-[#2F3A3A] mb-4">Academic Qualifications <span className="text-[#ef4444]">*</span></label>
                  {formData.degrees.map((deg, i) => (
                     <div key={i} className="flex flex-col md:flex-row gap-3 mb-4 p-4 border border-[#D9E5E3] rounded-xl bg-[#EEF3F2]/30">
                        <select className="shared-input md:w-1/4" value={deg.degree} onChange={e=>handleDegreeChange(i, 'degree', e.target.value)}>
                           {degOptions.map(o => <option key={o}>{o}</option>)}
                        </select>
                        <input type="text" placeholder="Institution Name" className="shared-input md:flex-1" value={deg.institution} onChange={e=>handleDegreeChange(i, 'institution', e.target.value)} />
                        <input type="number" placeholder="Year" className="shared-input md:w-[100px]" value={deg.year} onChange={e=>handleDegreeChange(i, 'year', e.target.value)} />
                        {i > 0 && <button type="button" onClick={()=>handleRemoveDegree(i)} className="text-[#ef4444] p-3 hover:bg-[#ef4444]/10 rounded-lg"><Trash size={20} /></button>}
                     </div>
                  ))}
                  <button type="button" onClick={handleAddDegree} className="shared-btn-ghost w-full py-2.5 text-sm border-dashed">
                     <Plus weight="bold" /> Add Another Degree
                  </button>
               </div>

               <div className="border-t border-[#D9E5E3] pt-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className="block text-sm font-bold text-[#2F3A3A] mb-2">Specialization</label>
                        <select className="shared-input">
                           {specOptions.map(o => <option key={o}>{o}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-[#2F3A3A] mb-2">Sub-specialization (Optional)</label>
                        <input type="text" placeholder="Any sub-specialization" className="shared-input" />
                     </div>
                     <div className="md:col-span-2 w-1/2">
                        <label className="block text-sm font-bold text-[#2F3A3A] mb-2">Consultation Fees (Optional)</label>
                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1F6F6A] font-bold">₹</span>
                           <input type="number" placeholder="0" className="shared-input pl-8" />
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {step === 2 && (
            <div>
               <div className="text-center mb-10">
                  <h3 className="font-['Syne'] text-xl font-bold text-[#2F3A3A] mb-1">Verification Documents</h3>
                  <p className="text-sm text-[#6B7C7C]">All documents must be clear and readable</p>
               </div>

               <UploadBox label="📄 Medical License Certificate" required />
               <UploadBox label="🎓 Medical Degree Certificate(s)" hint="Upload your highest qualification. PDF/JPG/PNG — max 5MB" required />
               <UploadBox label="🪪 Government ID Proof" hint="Aadhar Card / Passport / Driving License" required />
               <UploadBox label="📋 Medical Council Registration Certificate" required />

               <div className="flex justify-center mb-10">
                  <div className="bg-[#ECF5F4] border border-[#1F6F6A] text-[#185E59] px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2">
                     <span>✓</span> 4/4 documents uploaded
                  </div>
               </div>

               <div className="border-t border-[#D9E5E3] pt-8 mb-4">
                  <h3 className="text-sm font-bold text-[#2F3A3A] mb-4">Create Account Password</h3>
                  <div className="mb-4">
                     <input type="password" placeholder="Create Password" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="shared-input" required />
                     <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 h-1 bg-[#EEF3F2] rounded-full overflow-hidden flex">
                           <div className="h-full transition-all duration-300" style={{ width: `${strengthPct}%`, backgroundColor: strengthColor }}></div>
                        </div>
                        <span className="text-[10px] font-bold uppercase w-20 text-right" style={{ color: strengthColor }}>{strengthLabel}</span>
                     </div>
                  </div>
                  <div>
                     <input type="password" placeholder="Confirm Password" value={formData.confirmPassword} onChange={e=>setFormData({...formData, confirmPassword: e.target.value})} className="shared-input" required />
                     {formData.confirmPassword && formData.password === formData.confirmPassword && (
                        <p className="text-[#1F6F6A] text-xs font-bold mt-1">✓ Passwords match</p>
                     )}
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
             <button type="button" onClick={handleSubmit} className="shared-btn-primary w-56 shadow-[0_0_20px_rgba(31,111,106,0.4)]">Submit for Verification →</button>
           )}
        </div>
      </div>
    </div>
  );
};

export default DoctorRegister;
