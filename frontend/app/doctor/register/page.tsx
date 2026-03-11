'use client';

import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DoctorRegistrationData } from '@/types';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiArrowLeft, FiCheckCircle, FiAlertTriangle, FiActivity, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import MultiStepProgress from '@/components/auth/MultiStepProgress';
import ChipSelect from '@/components/auth/ChipSelect';
import UploadBox from '@/components/auth/UploadBox';

const STEPS = ['Personal Info', 'Professional Details', 'Documents & Account'];

const DEGREES = ['MBBS', 'MD', 'MS', 'BDS', 'MDS', 'BAMS', 'BHMS', 'BPT', 'DNB', 'DM', 'MCh'];
const SPECIALIZATIONS = [
  'General Medicine', 'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics',
  'Dermatology', 'Ophthalmology', 'ENT', 'Psychiatry', 'Radiology',
  'Anesthesiology', 'Surgery', 'Obstetrics & Gynecology', 'Pulmonology', 'Gastroenterology',
];

export default function DoctorRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

  const [formData, setFormData] = useState<Record<string, any>>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    license_number: '',
    degree: '',
    specialization: '',
    experience_years: '',
    hospital_name: '',
    hospital_address: '',
    terms_accepted: false,
  });

  const [specializations, setSpecializations] = useState<string[]>([]);
  const [files, setFiles] = useState<{ license_doc: File | null; degree_cert: File | null; id_proof: File | null }>({
    license_doc: null,
    degree_cert: null,
    id_proof: null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validateStep = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!formData.first_name) e.first_name = 'Required';
      if (!formData.last_name) e.last_name = 'Required';
      if (!formData.email) e.email = 'Required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Invalid email';
      if (!formData.phone) e.phone = 'Required';
      else if (!/^[6-9]\d{9}$/.test(formData.phone)) e.phone = '10 digits starting 6-9';
    } else if (step === 1) {
      if (!formData.license_number) e.license_number = 'Required';
      if (!formData.degree) e.degree = 'Required';
      if (specializations.length === 0) e.specialization = 'Select at least one';
      if (!formData.experience_years) e.experience_years = 'Required';
      if (!formData.hospital_name) e.hospital_name = 'Required';
    } else if (step === 2) {
      if (!formData.password) e.password = 'Required';
      else if (formData.password.length < 8) e.password = 'Min 8 characters';
      if (!files.license_doc) e.license_doc = 'License document required';
      if (!files.degree_cert) e.degree_cert = 'Degree certificate required';
      if (!files.id_proof) e.id_proof = 'ID proof required';
      if (!formData.terms_accepted) e.terms_accepted = 'Must accept terms';
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
        specialization: specializations.join(', '),
        ...(files.license_doc && { license_document: files.license_doc }),
        ...(files.degree_cert && { degree_certificate: files.degree_cert }),
        ...(files.id_proof && { id_proof: files.id_proof }),
      };
      await api.auth.registerDoctorWithDocuments(submitData as DoctorRegistrationData);
      toast.success('Registration submitted! Awaiting admin verification.');
      router.push(`/verify-email?email=${encodeURIComponent(formData.email || '')}&role=doctor`);
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
    `mt-1 block w-full h-11 rounded-xl border ${errors[field] ? 'border-red-400' : 'border-slate-200'} bg-white px-4 text-sm focus:border-teal-500 focus:ring-teal-500/20 transition-all`;

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
          <h1 className="text-3xl font-bold text-slate-900 font-syne mb-1">Doctor Registration</h1>
          <p className="text-sm text-slate-500 font-dm">Join the ArogyaTrack practitioner network</p>
        </div>

        {/* Amber warning */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
          <FiAlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Admin Verification Required</p>
            <p className="text-xs text-amber-600 mt-0.5">Your account will be reviewed by a medical board administrator before activation.</p>
          </div>
        </div>

        <MultiStepProgress steps={STEPS} current={step} />

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <AnimatePresence mode="wait">
              {/* ── Step 1: Personal Info ── */}
              {step === 0 && (
                <motion.div key="d0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
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

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="doctor@hospital.in" className={inputClass('email')} />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Phone <span className="text-red-500">*</span></label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="9876543210" className={inputClass('phone')} />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Professional Details ── */}
              {step === 1 && (
                <motion.div key="d1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Medical License Number <span className="text-red-500">*</span></label>
                    <input type="text" name="license_number" value={formData.license_number} onChange={handleChange} placeholder="e.g. MCI-12345" className={inputClass('license_number')} />
                    {errors.license_number && <p className="text-xs text-red-500 mt-1">{errors.license_number}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Degree <span className="text-red-500">*</span></label>
                      <select name="degree" value={formData.degree} onChange={handleChange} className={inputClass('degree')}>
                        <option value="">Select degree</option>
                        {DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      {errors.degree && <p className="text-xs text-red-500 mt-1">{errors.degree}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Experience (years) <span className="text-red-500">*</span></label>
                      <input type="number" name="experience_years" value={formData.experience_years} onChange={handleChange} min={0} max={60} className={inputClass('experience_years')} />
                      {errors.experience_years && <p className="text-xs text-red-500 mt-1">{errors.experience_years}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Specialization(s) <span className="text-red-500">*</span></label>
                    <ChipSelect options={SPECIALIZATIONS} selected={specializations} onChange={setSpecializations} />
                    {errors.specialization && <p className="text-xs text-red-500 mt-2">{errors.specialization}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Hospital / Clinic Name <span className="text-red-500">*</span></label>
                    <input type="text" name="hospital_name" value={formData.hospital_name} onChange={handleChange} className={inputClass('hospital_name')} />
                    {errors.hospital_name && <p className="text-xs text-red-500 mt-1">{errors.hospital_name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Hospital Address</label>
                    <textarea name="hospital_address" value={formData.hospital_address} onChange={handleChange} rows={2} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-teal-500 focus:ring-teal-500/20" />
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: Documents & Account ── */}
              {step === 2 && (
                <motion.div key="d2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
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

                  <div className="space-y-4">
                    <UploadBox
                      label="Medical License Document *"
                      file={files.license_doc}
                      onFileChange={(f) => setFiles((p) => ({ ...p, license_doc: f }))}
                      error={errors.license_doc}
                    />
                    <UploadBox
                      label="Degree Certificate *"
                      file={files.degree_cert}
                      onFileChange={(f) => setFiles((p) => ({ ...p, degree_cert: f }))}
                      error={errors.degree_cert}
                    />
                    <UploadBox
                      label="Government ID Proof *"
                      file={files.id_proof}
                      onFileChange={(f) => setFiles((p) => ({ ...p, id_proof: f }))}
                      error={errors.id_proof}
                    />
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      name="terms_accepted"
                      checked={formData.terms_accepted || false}
                      onChange={handleChange}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className={`text-sm ${errors.terms_accepted ? 'text-red-500' : 'text-slate-600'}`}>
                      I accept the Terms of Service &amp; confirm the accuracy of submitted documents
                    </span>
                  </label>
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
                  {loading ? 'Submitting…' : 'Submit for Verification'} <FiCheckCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already registered?{' '}
          <Link href="/doctor/signin" className="text-teal-700 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
