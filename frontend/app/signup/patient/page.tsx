'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PatientRegistrationData } from '@/types';
import toast from 'react-hot-toast';
import { verifyAbhaId } from '@/lib/abhaApi'; // NEW: ABHA FEATURE

export default function PatientSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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

  // NEW: ABHA FEATURE - state for ABHA lookup
  const [abhaId, setAbhaId] = useState(''); // NEW: ABHA FEATURE
  const [abhaStatus, setAbhaStatus] = useState<'idle' | 'verified' | 'not_found'>('idle'); // NEW: ABHA FEATURE
  const [abhaHidden, setAbhaHidden] = useState(false); // NEW: ABHA FEATURE
  const [abhaVerifying, setAbhaVerifying] = useState(false); // NEW: ABHA FEATURE

  const calculatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    if (strength <= 2) return 'weak';
    if (strength === 3) return 'medium';
    return 'strong';
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only JPG, PNG, and PDF files are allowed');
        return;
      }

      setFormData((prev) => ({ ...prev, aadhar_id_proof: file }));

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required field validation
    if (!formData.first_name) newErrors.first_name = 'First name is required';
    if (!formData.last_name) newErrors.last_name = 'Last name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (!formData.phone) newErrors.phone = 'Phone number is required';
    if (!formData.date_of_birth) newErrors.date_of_birth = 'Date of birth is required';
    if (!formData.blood_group) newErrors.blood_group = 'Blood group is required';
    if (!formData.address) newErrors.address = 'Address is required';
    if (!formData.district) newErrors.district = 'District is required';
    if (!formData.state) newErrors.state = 'State is required';
    if (!formData.pincode) newErrors.pincode = 'Pincode is required';
    if (!formData.aadhar_id_proof && abhaStatus !== 'verified') newErrors.aadhar_id_proof = 'ID proof is required'; // NEW: ABHA FEATURE - skip aadhar when ABHA verified

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Phone validation (10 digits)
    if (formData.phone && !/^[6-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = 'Phone must be 10 digits starting with 6-9';
    }

    // Password validation
    if (formData.password && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    // Consent validation
    if (!formData.terms_accepted) newErrors.terms_accepted = 'You must accept the terms';
    if (!formData.consent_store_data) newErrors.consent_store_data = 'You must consent to data storage';
    if (!formData.consent_doctor_access) newErrors.consent_doctor_access = 'You must consent to doctor access';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      const submitData = { ...formData, abha_verified: abhaStatus === 'verified' }; // NEW: ABHA FEATURE
      const response = await api.auth.registerPatientWithDocuments(submitData as PatientRegistrationData);
      toast.success('Registration successful!' + (abhaStatus === 'verified' ? '' : ' Please verify your email.')); // NEW: ABHA FEATURE
      if (abhaStatus === 'verified') { // NEW: ABHA FEATURE
        router.push('/login'); // NEW: ABHA FEATURE - skip email verification for ABHA verified users
      } else { // NEW: ABHA FEATURE
        router.push(`/verify-email?email=${encodeURIComponent(formData.email || '')}&role=patient`);
      } // NEW: ABHA FEATURE
    } catch (error: any) {
      console.error('Registration error:', error);
      console.error('Response data:', error.response?.data);
      
      if (error.response?.data?.errors) {
        // Handle field-specific errors from backend
        const backendErrors: Record<string, string> = {};
        Object.entries(error.response.data.errors).forEach(([key, value]) => {
          backendErrors[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setErrors(backendErrors);
        
        // Show specific error fields in toast
        const errorFields = Object.keys(backendErrors).join(', ');
        toast.error(`Validation errors in: ${errorFields}`);
      } else {
        toast.error(error.response?.data?.detail || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // NEW: ABHA FEATURE - handle ABHA ID verification and autofill
  const handleAbhaVerify = () => { // NEW: ABHA FEATURE
    if (!abhaId.trim()) { // NEW: ABHA FEATURE
      toast.error('Please enter an ABHA ID'); // NEW: ABHA FEATURE
      return; // NEW: ABHA FEATURE
    } // NEW: ABHA FEATURE
    setAbhaVerifying(true); // NEW: ABHA FEATURE
    const result = verifyAbhaId(abhaId); // NEW: ABHA FEATURE
    if (result.success && result.patient) { // NEW: ABHA FEATURE
      const p = result.patient; // NEW: ABHA FEATURE
      const nameParts = p.name.split(' '); // NEW: ABHA FEATURE
      const firstName = nameParts[0] || ''; // NEW: ABHA FEATURE
      const lastName = nameParts.slice(1).join(' ') || ''; // NEW: ABHA FEATURE
      setFormData((prev) => ({ // NEW: ABHA FEATURE
        ...prev, // NEW: ABHA FEATURE
        first_name: firstName, // NEW: ABHA FEATURE
        last_name: lastName, // NEW: ABHA FEATURE
        date_of_birth: p.date_of_birth || '', // NEW: ABHA FEATURE
        gender: p.gender.toLowerCase() as 'male' | 'female' | 'other', // NEW: ABHA FEATURE
        blood_group: p.blood_group, // NEW: ABHA FEATURE
        phone: p.phone, // NEW: ABHA FEATURE
        email: p.email || '', // NEW: ABHA FEATURE
        address: p.address || '', // NEW: ABHA FEATURE
        district: p.district || '', // NEW: ABHA FEATURE
        state: p.state || '', // NEW: ABHA FEATURE
        pincode: p.pincode || '', // NEW: ABHA FEATURE
      })); // NEW: ABHA FEATURE
      setAbhaStatus('verified'); // NEW: ABHA FEATURE
      toast.success('ABHA ID verified! Fields auto-filled.'); // NEW: ABHA FEATURE
    } else { // NEW: ABHA FEATURE
      setAbhaStatus('not_found'); // NEW: ABHA FEATURE
    } // NEW: ABHA FEATURE
    setAbhaVerifying(false); // NEW: ABHA FEATURE
  }; // NEW: ABHA FEATURE

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Patient Registration</h1>
            <p className="mt-2 text-gray-600">
              Register for secure healthcare access
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* NEW: ABHA FEATURE - ABHA ID Lookup Section */}
            {!abhaHidden && ( // NEW: ABHA FEATURE
              <div className="bg-blue-50 rounded-lg p-6 border border-blue-200"> {/* NEW: ABHA FEATURE */}
                <h2 className="text-xl font-semibold text-gray-900 mb-2">ABHA ID Verification</h2> {/* NEW: ABHA FEATURE */}
                <p className="text-sm text-gray-500 mb-4">Enter your ABHA ID to auto-fill your details</p> {/* NEW: ABHA FEATURE */}
                <div className="flex gap-3 items-start"> {/* NEW: ABHA FEATURE */}
                  <div className="flex-1"> {/* NEW: ABHA FEATURE */}
                    <input // NEW: ABHA FEATURE
                      type="text" // NEW: ABHA FEATURE
                      value={abhaId} // NEW: ABHA FEATURE
                      onChange={(e) => { setAbhaId(e.target.value); setAbhaStatus('idle'); }} // NEW: ABHA FEATURE
                      placeholder="e.g. 12-3456-7890-1234" // NEW: ABHA FEATURE
                      className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2" // NEW: ABHA FEATURE
                    /> {/* NEW: ABHA FEATURE */}
                  </div> {/* NEW: ABHA FEATURE */}
                  <button // NEW: ABHA FEATURE
                    type="button" // NEW: ABHA FEATURE
                    onClick={handleAbhaVerify} // NEW: ABHA FEATURE
                    disabled={abhaVerifying} // NEW: ABHA FEATURE
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors whitespace-nowrap" // NEW: ABHA FEATURE
                  > {/* NEW: ABHA FEATURE */}
                    {abhaVerifying ? 'Verifying...' : 'Verify & Autofill'} {/* NEW: ABHA FEATURE */}
                  </button> {/* NEW: ABHA FEATURE */}
                </div> {/* NEW: ABHA FEATURE */}
                {abhaStatus === 'verified' && ( // NEW: ABHA FEATURE
                  <p className="mt-2 text-green-600 font-medium text-sm">✓ ABHA Verified</p> // NEW: ABHA FEATURE
                )} {/* NEW: ABHA FEATURE */}
                {abhaStatus === 'not_found' && ( // NEW: ABHA FEATURE
                  <p className="mt-2 text-red-600 font-medium text-sm">✗ ABHA ID not found — fill manually below</p> // NEW: ABHA FEATURE
                )} {/* NEW: ABHA FEATURE */}
                <p className="mt-2 text-xs text-gray-400"> {/* NEW: ABHA FEATURE */}
                  Don&apos;t have ABHA ID?{' '} {/* NEW: ABHA FEATURE */}
                  <button // NEW: ABHA FEATURE
                    type="button" // NEW: ABHA FEATURE
                    onClick={() => setAbhaHidden(true)} // NEW: ABHA FEATURE
                    className="text-indigo-600 hover:underline" // NEW: ABHA FEATURE
                  > {/* NEW: ABHA FEATURE */}
                    Skip and fill manually {/* NEW: ABHA FEATURE */}
                  </button> {/* NEW: ABHA FEATURE */}
                </p> {/* NEW: ABHA FEATURE */}
              </div> // NEW: ABHA FEATURE
            )} {/* NEW: ABHA FEATURE */}

            {/* Personal Information */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md border shadow-sm ${
                      errors.first_name ? 'border-red-500' : 'border-gray-300'
                    } focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 ${abhaStatus === 'verified' ? 'bg-gray-100' : ''}`} // NEW: ABHA FEATURE - grey bg when autofilled
                  />
                  {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md border shadow-sm ${
                      errors.last_name ? 'border-red-500' : 'border-gray-300'
                    } focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 ${abhaStatus === 'verified' ? 'bg-gray-100' : ''}`} // NEW: ABHA FEATURE - grey bg when autofilled
                  />
                  {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md border shadow-sm ${
                      errors.date_of_birth ? 'border-red-500' : 'border-gray-300'
                    } focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 ${abhaStatus === 'verified' ? 'bg-gray-100' : ''}`} // NEW: ABHA FEATURE - grey bg when autofilled
                  />
                  {errors.date_of_birth && <p className="text-red-500 text-xs mt-1">{errors.date_of_birth}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 ${abhaStatus === 'verified' ? 'bg-gray-100' : ''}`} // NEW: ABHA FEATURE - grey bg when autofilled
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Blood Group <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="blood_group"
                    value={formData.blood_group}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md border shadow-sm ${
                      errors.blood_group ? 'border-red-500' : 'border-gray-300'
                    } focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 ${abhaStatus === 'verified' ? 'bg-gray-100' : ''}`} // NEW: ABHA FEATURE - grey bg when autofilled
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                  {errors.blood_group && <p className="text-red-500 text-xs mt-1">{errors.blood_group}</p>}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md border shadow-sm ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    } focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 ${abhaStatus === 'verified' ? 'bg-gray-100' : ''}`} // NEW: ABHA FEATURE - grey bg when autofilled
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="10-digit mobile number"
                    className={`mt-1 block w-full rounded-md border shadow-sm ${
                      errors.phone ? 'border-red-500' : 'border-gray-300'
                    } focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 ${abhaStatus === 'verified' ? 'bg-gray-100' : ''}`} // NEW: ABHA FEATURE - grey bg when autofilled
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Address Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Full Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={2}
                    className={`mt-1 block w-full rounded-md border shadow-sm ${
                      errors.address ? 'border-red-500' : 'border-gray-300'
                    } focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 ${abhaStatus === 'verified' ? 'bg-gray-100' : ''}`} // NEW: ABHA FEATURE - grey bg when autofilled
                  />
                  {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      District <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      className={`mt-1 block w-full rounded-md border shadow-sm ${
                        errors.district ? 'border-red-500' : 'border-gray-300'
                      } focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 ${abhaStatus === 'verified' ? 'bg-gray-100' : ''}`} // NEW: ABHA FEATURE - grey bg when autofilled
                    />
                    {errors.district && <p className="text-red-500 text-xs mt-1">{errors.district}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className={`mt-1 block w-full rounded-md border shadow-sm ${
                        errors.state ? 'border-red-500' : 'border-gray-300'
                      } focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 ${abhaStatus === 'verified' ? 'bg-gray-100' : ''}`} // NEW: ABHA FEATURE - grey bg when autofilled
                    />
                    {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Pincode <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleChange}
                      maxLength={6}
                      className={`mt-1 block w-full rounded-md border shadow-sm ${
                        errors.pincode ? 'border-red-500' : 'border-gray-300'
                      } focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 ${abhaStatus === 'verified' ? 'bg-gray-100' : ''}`} // NEW: ABHA FEATURE - grey bg when autofilled
                    />
                    {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Security</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`mt-1 block w-full rounded-md border shadow-sm ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  } focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2`}
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${getPasswordStrengthColor()}`}
                          style={{
                            width: passwordStrength === 'weak' ? '33%' : passwordStrength === 'medium' ? '66%' : '100%'
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium capitalize">{passwordStrength}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Use 8+ characters with uppercase, lowercase, number, and special character
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ID Proof Upload */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Identity Verification</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Aadhar/ID Proof <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className={`mt-1 block w-full text-sm text-gray-500 border rounded-md px-3 py-2 ${
                    errors.aadhar_id_proof ? 'border-red-500' : 'border-gray-300'
                  } file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100`}
                />
                <p className="text-xs text-gray-500 mt-1">Upload JPG, PNG, or PDF (max 5MB)</p>
                {errors.aadhar_id_proof && <p className="text-red-500 text-xs mt-1">{errors.aadhar_id_proof}</p>}
                
                {previewUrl && (
                  <div className="mt-4">
                    <img src={previewUrl} alt="ID Preview" className="max-w-xs rounded-lg shadow" />
                  </div>
                )}
              </div>
            </div>

            {/* Consent Checkboxes */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Consent & Terms</h2>
              <div className="space-y-3">
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    name="terms_accepted"
                    checked={formData.terms_accepted}
                    onChange={handleChange}
                    className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    I accept the <a href="#" className="text-indigo-600 hover:underline">Terms and Conditions</a>{' '}
                    <span className="text-red-500">*</span>
                  </label>
                </div>
                {errors.terms_accepted && <p className="text-red-500 text-xs">{errors.terms_accepted}</p>}

                <div className="flex items-start">
                  <input
                    type="checkbox"
                    name="consent_store_data"
                    checked={formData.consent_store_data}
                    onChange={handleChange}
                    className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    I consent to storing my medical data securely <span className="text-red-500">*</span>
                  </label>
                </div>
                {errors.consent_store_data && <p className="text-red-500 text-xs">{errors.consent_store_data}</p>}

                <div className="flex items-start">
                  <input
                    type="checkbox"
                    name="consent_doctor_access"
                    checked={formData.consent_doctor_access}
                    onChange={handleChange}
                    className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    I consent to authorized doctors accessing my medical records <span className="text-red-500">*</span>
                  </label>
                </div>
                {errors.consent_doctor_access && (
                  <p className="text-red-500 text-xs">{errors.consent_doctor_access}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Already have an account? Login
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
