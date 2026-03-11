'use client';

import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PatientRegistrationData } from '@/types';
import toast from 'react-hot-toast';
import { verifyAbhaId } from '@/lib/abhaApi';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiArrowLeft, FiCheckCircle, FiUser, FiMail, FiPhone, FiMapPin, FiLock, FiEye, FiEyeOff, FiUploadCloud, FiX, FiHeart, FiActivity, FiPlus } from 'react-icons/fi';
import MultiStepProgress from '@/components/auth/MultiStepProgress';

const STEPS = ['Personal Info', 'Medical History', 'Contact & Address', 'Security & Upload'];

const CONDITION_OPTIONS = ['Diabetes', 'Hypertension', 'Heart Disease', 'Asthma', 'Thyroid Disorder', 'Kidney Disease', 'Liver Disease', 'Cancer', 'None'];
const ALLERGY_OPTIONS = ['Penicillin', 'Aspirin', 'Sulfa Drugs', 'NSAIDs', 'Latex', 'Peanuts', 'Shellfish', 'None'];

export default function PatientRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<PatientRegistrationData>>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: 'male',
    phone: '',
    blood_group: '',
    address: '',
    district: '',
    state: '',
    country: 'India',
    pincode: '',
    terms_accepted: false,
    consent_store_data: false,
    consent_doctor_access: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // ABHA
  const [abhaId, setAbhaId] = useState('');
  const [abhaStatus, setAbhaStatus] = useState<'idle' | 'verified' | 'not_found'>('idle');
  const [abhaHidden, setAbhaHidden] = useState(false);
  const [abhaVerifying, setAbhaVerifying] = useState(false);

  // Medical history
  const [conditions, setConditions] = useState<string[]>([]);
  const [customCondition, setCustomCondition] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState('');
  const [pastSurgeries, setPastSurgeries] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');

  const calcStrength = (p: string): 'weak' | 'medium' | 'strong' => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^a-zA-Z0-9]/.test(p)) s++;
    return s <= 2 ? 'weak' : s === 3 ? 'medium' : 'strong';
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (name === 'password') setPasswordStrength(calcStrength(value));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) { toast.error('Only JPG, PNG, PDF allowed'); return; }
    setFormData((prev) => ({ ...prev, aadhar_id_proof: file }));
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleAbhaVerify = () => {
    if (!abhaId.trim()) { toast.error('Enter ABHA ID'); return; }
    setAbhaVerifying(true);
    const result = verifyAbhaId(abhaId);
    if (result.success && result.patient) {
      const p = result.patient;
      const [first, ...rest] = p.name.split(' ');
      setFormData((prev) => ({
        ...prev,
        first_name: first || '',
        last_name: rest.join(' ') || '',
        date_of_birth: p.date_of_birth || '',
        gender: p.gender.toLowerCase() as 'male' | 'female' | 'other',
        blood_group: p.blood_group,
        phone: p.phone,
        email: p.email || '',
        address: p.address || '',
        district: p.district || '',
        state: p.state || '',
        pincode: p.pincode || '',
      }));
      setAbhaStatus('verified');
      toast.success('ABHA verified - fields auto-filled');
    } else {
      setAbhaStatus('not_found');
    }
    setAbhaVerifying(false);
  };

  const validateStep = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!formData.first_name) e.first_name = 'Required';
      if (!formData.last_name) e.last_name = 'Required';
      if (!formData.date_of_birth) e.date_of_birth = 'Required';
      if (!formData.blood_group) e.blood_group = 'Required';
    } else if (step === 1) {
      // Medical history - no required fields, all optional
    } else if (step === 2) {
      if (!formData.email) e.email = 'Required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Invalid email';
      if (!formData.phone) e.phone = 'Required';
      else if (!/^[6-9]\d{9}$/.test(formData.phone)) e.phone = '10 digits starting 6-9';
      if (!formData.address) e.address = 'Required';
      if (!formData.district) e.district = 'Required';
      if (!formData.state) e.state = 'Required';
      if (!formData.pincode) e.pincode = 'Required';
    } else if (step === 3) {
      if (!formData.password) e.password = 'Required';
      else if (formData.password.length < 8) e.password = 'Min 8 characters';
      if (!formData.aadhar_id_proof && abhaStatus !== 'verified') e.aadhar_id_proof = 'ID proof required';
      if (!formData.terms_accepted) e.terms_accepted = 'Must accept terms';
      if (!formData.consent_store_data) e.consent_store_data = 'Required';
      if (!formData.consent_doctor_access) e.consent_doctor_access = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => { if (validateStep()) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep()) { toast.error('Fix errors before submitting'); return; }
    setLoading(true);
    try {
      const submitData = {
        ...formData,
        abha_verified: abhaStatus === 'verified',
        existing_conditions: conditions.join(', '),
        known_allergies: allergies.join(', '),
        past_surgeries: pastSurgeries,
        current_medications: currentMedications,
      };
      await api.auth.registerPatientWithDocuments(submitData as PatientRegistrationData);
      toast.success('Registration successful!');
      if (abhaStatus === 'verified') {
        router.push('/login');
      } else {
        router.push(`/verify-email?email=${encodeURIComponent(formData.email || '')}&role=patient`);
      }
    } catch (error: any) {
      if (error.response?.data?.errors) {
        const backendErrors: Record<string, string> = {};
        Object.entries(error.response.data.errors).forEach(([key, value]) => {
          backendErrors[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setErrors(backendErrors);
      } else {
        toast.error(error.response?.data?.detail || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const strengthColor = passwordStrength === 'weak' ? 'bg-red-500' : passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500';
  const strengthWidth = passwordStrength === 'weak' ? '33%' : passwordStrength === 'medium' ? '66%' : '100%';

  const inputClass = (field: string) =>
    `mt-1 block w-full h-11 rounded-xl border ${errors[field] ? 'border-red-400' : 'border-slate-200'} bg-white px-4 text-sm focus:border-teal-500 focus:ring-teal-500/20 transition-all ${abhaStatus === 'verified' ? 'bg-slate-50' : ''}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/30 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-700 to-emerald-600 flex items-center justify-center">
              <FiActivity className="w-4 h-4 text-white" />
            </div>
            <span className="font-syne font-bold text-lg text-slate-900">ArogyaTrack</span>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 font-syne mb-1">Patient Registration</h1>
          <p className="text-sm text-slate-500 font-dm">Create your secure healthcare account</p>
        </div>

        <MultiStepProgress steps={STEPS} current={step} />

        {/* Live Preview Card */}
        {(formData.first_name || formData.last_name) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                <FiUser className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{formData.first_name} {formData.last_name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {formData.blood_group && <span className="flex items-center gap-1"><FiHeart className="w-3 h-3 text-red-400" />{formData.blood_group}</span>}
                  {formData.email && <span className="flex items-center gap-1"><FiMail className="w-3 h-3" />{formData.email}</span>}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <AnimatePresence mode="wait">
              {/* ── Step 1: Personal Info ── */}
              {step === 0 && (
                <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  {/* ABHA */}
                  {!abhaHidden && (
                    <div className="p-5 rounded-xl bg-blue-50 border border-blue-200">
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">ABHA ID Verification</h3>
                      <p className="text-xs text-slate-500 mb-3">Auto-fill details with your national health ID</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={abhaId}
                          onChange={(e) => { setAbhaId(e.target.value); setAbhaStatus('idle'); }}
                          placeholder="12-3456-7890-1234"
                          className="flex-1 h-10 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-500"
                        />
                        <button type="button" onClick={handleAbhaVerify} disabled={abhaVerifying} className="px-4 h-10 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
                          {abhaVerifying ? 'Verifying…' : 'Verify'}
                        </button>
                      </div>
                      {abhaStatus === 'verified' && <p className="text-green-600 text-xs mt-2 font-medium">✓ ABHA verified &ndash; fields auto-filled</p>}
                      {abhaStatus === 'not_found' && <p className="text-red-500 text-xs mt-2 font-medium">✗ ABHA not found &ndash; fill manually</p>}
                      <button type="button" onClick={() => setAbhaHidden(true)} className="text-xs text-blue-600 hover:underline mt-2">Skip &amp; fill manually</button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">First Name <span className="text-red-500">*</span></label>
                      <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className={inputClass('first_name')} />
                      {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Last Name <span className="text-red-500">*</span></label>
                      <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className={inputClass('last_name')} />
                      {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Date of Birth <span className="text-red-500">*</span></label>
                      <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className={inputClass('date_of_birth')} />
                      {errors.date_of_birth && <p className="text-xs text-red-500 mt-1">{errors.date_of_birth}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Gender</label>
                      <select name="gender" value={formData.gender} onChange={handleChange} className={inputClass('gender')}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Blood Group <span className="text-red-500">*</span></label>
                    <select name="blood_group" value={formData.blood_group} onChange={handleChange} className={inputClass('blood_group')}>
                      <option value="">Select</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                    {errors.blood_group && <p className="text-xs text-red-500 mt-1">{errors.blood_group}</p>}
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Medical History ── */}
              {step === 1 && (
                <motion.div key="s1med" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900">Help doctors understand you better</h3>

                  {/* Existing Medical Conditions */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Existing Medical Conditions</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {CONDITION_OPTIONS.map((opt) => {
                        const active = conditions.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              if (opt === 'None') { setConditions(active ? [] : ['None']); return; }
                              if (conditions.includes('None')) setConditions((c) => c.filter((x) => x !== 'None'));
                              setConditions((c) => active ? c.filter((x) => x !== opt) : [...c, opt]);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              active ? 'bg-teal-600 text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customCondition}
                        onChange={(e) => setCustomCondition(e.target.value)}
                        placeholder="Add custom condition..."
                        className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm focus:border-teal-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); if (customCondition.trim()) { setConditions((c) => [...c, customCondition.trim()]); setCustomCondition(''); } }
                        }}
                      />
                      <button type="button" onClick={() => { if (customCondition.trim()) { setConditions((c) => [...c, customCondition.trim()]); setCustomCondition(''); } }} className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100">
                        <FiPlus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Known Allergies */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Known Allergies</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {ALLERGY_OPTIONS.map((opt) => {
                        const active = allergies.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              if (opt === 'None') { setAllergies(active ? [] : ['None']); return; }
                              if (allergies.includes('None')) setAllergies((a) => a.filter((x) => x !== 'None'));
                              setAllergies((a) => active ? a.filter((x) => x !== opt) : [...a, opt]);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              active ? 'bg-teal-600 text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customAllergy}
                        onChange={(e) => setCustomAllergy(e.target.value)}
                        placeholder="Add custom allergy..."
                        className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm focus:border-teal-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); if (customAllergy.trim()) { setAllergies((a) => [...a, customAllergy.trim()]); setCustomAllergy(''); } }
                        }}
                      />
                      <button type="button" onClick={() => { if (customAllergy.trim()) { setAllergies((a) => [...a, customAllergy.trim()]); setCustomAllergy(''); } }} className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100">
                        <FiPlus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Past Surgeries */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Past Surgeries / Hospitalizations</label>
                    <textarea
                      value={pastSurgeries}
                      onChange={(e) => setPastSurgeries(e.target.value)}
                      rows={3}
                      placeholder="E.g. Appendectomy 2019, Hospitalized for pneumonia 2022..."
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-teal-500 focus:ring-teal-500/20"
                    />
                  </div>

                  {/* Current Medications */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Current Medications</label>
                    <textarea
                      value={currentMedications}
                      onChange={(e) => setCurrentMedications(e.target.value)}
                      rows={2}
                      placeholder="E.g. Metformin 500mg twice daily, Amlodipine 5mg once daily..."
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-teal-500 focus:ring-teal-500/20"
                    />
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: Contact & Address ── */}
              {step === 2 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@email.com" className={`${inputClass('email')} pl-10`} />
                      </div>
                      {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Phone <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="9876543210" className={`${inputClass('phone')} pl-10`} />
                      </div>
                      {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Full Address <span className="text-red-500">*</span></label>
                    <textarea name="address" value={formData.address} onChange={handleChange} rows={2} className={`mt-1 block w-full rounded-xl border ${errors.address ? 'border-red-400' : 'border-slate-200'} bg-white px-4 py-3 text-sm focus:border-teal-500 focus:ring-teal-500/20`} />
                    {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">District <span className="text-red-500">*</span></label>
                      <input type="text" name="district" value={formData.district} onChange={handleChange} className={inputClass('district')} />
                      {errors.district && <p className="text-xs text-red-500 mt-1">{errors.district}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">State <span className="text-red-500">*</span></label>
                      <input type="text" name="state" value={formData.state} onChange={handleChange} className={inputClass('state')} />
                      {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Pincode <span className="text-red-500">*</span></label>
                      <input type="text" name="pincode" value={formData.pincode} onChange={handleChange} maxLength={6} className={inputClass('pincode')} />
                      {errors.pincode && <p className="text-xs text-red-500 mt-1">{errors.pincode}</p>}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 4: Security & Upload ── */}
              {step === 3 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className={`${inputClass('password')} pl-10 pr-10`}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                    {formData.password && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full ${strengthColor} transition-all`} style={{ width: strengthWidth }} />
                        </div>
                        <span className="text-[10px] font-medium capitalize text-slate-500">{passwordStrength}</span>
                      </div>
                    )}
                  </div>

                  {/* Aadhar Upload */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Aadhar / ID Proof <span className="text-red-500">*</span></label>
                    {!(formData as any).aadhar_id_proof ? (
                      <div
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition-colors ${errors.aadhar_id_proof ? 'border-red-400' : 'border-slate-300'}`}
                        onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.jpg,.jpeg,.png,.pdf'; i.onchange = handleFileChange as any; i.click(); }}
                      >
                        <FiUploadCloud className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-sm text-slate-500">Drag &amp; drop or <span className="text-teal-600 font-medium">browse</span></p>
                        <p className="text-xs text-slate-400 mt-1">JPG, PNG, PDF (max 5MB)</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <FiCheckCircle className="w-5 h-5 text-emerald-600" />
                        <span className="text-sm text-emerald-800 truncate flex-1">{((formData as any).aadhar_id_proof as File).name}</span>
                        <button type="button" onClick={() => { setFormData((p) => ({ ...p, aadhar_id_proof: undefined })); setPreviewUrl(null); }} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-full">
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {previewUrl && <img src={previewUrl} alt="Preview" className="mt-3 w-32 h-auto rounded-lg border" />}
                    {errors.aadhar_id_proof && <p className="text-xs text-red-500 mt-1">{errors.aadhar_id_proof}</p>}
                  </div>

                  {/* Consents */}
                  <div className="space-y-3 pt-2">
                    {[
                      { name: 'terms_accepted', label: 'I accept the Terms of Service & Privacy Policy' },
                      { name: 'consent_store_data', label: 'I consent to secure storage of my health data' },
                      { name: 'consent_doctor_access', label: 'I consent to doctor access of my medical records' },
                    ].map((c) => (
                      <label key={c.name} className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          name={c.name}
                          checked={(formData as any)[c.name] || false}
                          onChange={handleChange}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className={`text-sm ${errors[c.name] ? 'text-red-500' : 'text-slate-600'}`}>{c.label}</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
              {step > 0 ? (
                <button type="button" onClick={prevStep} className="flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                  <FiArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <Link href="/signup" className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600">
                  <FiArrowLeft className="w-4 h-4" /> Role selection
                </Link>
              )}

              {step < STEPS.length - 1 ? (
                <button type="button" onClick={nextStep} className="flex items-center gap-2 px-6 h-11 rounded-xl text-sm font-medium bg-teal-700 text-white hover:bg-teal-800 shadow-lg shadow-teal-700/20 transition-all">
                  Next <FiArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 h-11 rounded-xl text-sm font-medium bg-teal-700 text-white hover:bg-teal-800 shadow-lg shadow-teal-700/20 transition-all disabled:opacity-60">
                  {loading ? 'Creating account…' : 'Create Account'} <FiCheckCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link href="/patient/signin" className="text-teal-700 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
