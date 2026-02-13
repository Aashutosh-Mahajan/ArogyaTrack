'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DoctorRegistrationData } from '@/types';
import toast from 'react-hot-toast';

export default function DoctorSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');
  const [filePreviews, setFilePreviews] = useState<{
    license_certificate?: string;
    degree_certificate?: string;
    government_id?: string;
  }>({});

  const [formData, setFormData] = useState<Partial<DoctorRegistrationData>>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    phone: '',
    medical_license: '',
    degree: 'MBBS',
    degree_other: '',
    specialization: '',
    experience_years: 0,
    clinic_name: '',
    clinic_address: '',
    consultation_fee: 0,
    terms_accepted: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));

    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (10MB max for certificates)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only JPG, PNG, and PDF files are allowed');
        return;
      }

      setFormData((prev) => ({ ...prev, [fieldName]: file }));

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreviews((prev) => ({ ...prev, [fieldName]: reader.result as string }));
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreviews((prev) => ({ ...prev, [fieldName]: `📄 ${file.name}` }));
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
    if (!formData.medical_license) newErrors.medical_license = 'Medical license is required';
    if (!formData.degree) newErrors.degree = 'Degree is required';
    if (formData.degree === 'Other' && !formData.degree_other) {
      newErrors.degree_other = 'Please specify your degree';
    }
    if (!formData.specialization) newErrors.specialization = 'Specialization is required';
    if (!formData.experience_years) newErrors.experience_years = 'Experience is required';
    if (!formData.license_certificate) newErrors.license_certificate = 'License certificate is required';
    if (!formData.degree_certificate) newErrors.degree_certificate = 'Degree certificate is required';
    if (!formData.government_id) newErrors.government_id = 'Government ID is required';

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

    // Age validation (must be 23+)
    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 23) {
        newErrors.date_of_birth = 'Doctors must be at least 23 years old';
      } else if (age > 80) {
        newErrors.date_of_birth = 'Invalid date of birth';
      }
    }

    // Experience validation
    if (formData.experience_years && formData.experience_years < 0) {
      newErrors.experience_years = 'Experience cannot be negative';
    }

    // Terms validation
    if (!formData.terms_accepted) newErrors.terms_accepted = 'You must accept the terms';

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
      const response = await api.auth.registerDoctorWithDocuments(formData as DoctorRegistrationData);
      toast.success('Registration successful! Your application is under review.');
      // Show approval pending message
      router.push(`/verify-email?email=${encodeURIComponent(formData.email || '')}&role=doctor`);
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.response?.data?.errors) {
        // Handle field-specific errors from backend
        const backendErrors: Record<string, string> = {};
        Object.entries(error.response.data.errors).forEach(([key, value]) => {
          backendErrors[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setErrors(backendErrors);
        toast.error('Please fix the errors highlighted in the form');
      } else {
        toast.error(error.response?.data?.detail || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Doctor Registration</h1>
            <p className="mt-2 text-gray-600">
              Join our healthcare network - Your application will be reviewed within 24-48 hours
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                    } focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2`}
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
                    } focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2`}
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
                    } focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2`}
                  />
                  {errors.date_of_birth && <p className="text-red-500 text-xs mt-1">{errors.date_of_birth}</p>}
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
                    } focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2`}
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>

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
                    } focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2`}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Professional Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Medical License Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="medical_license"
                    value={formData.medical_license}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md border shadow-sm ${
                      errors.medical_license ? 'border-red-500' : 'border-gray-300'
                    } focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2`}
                  />
                  {errors.medical_license && <p className="text-red-500 text-xs mt-1">{errors.medical_license}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Degree <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="degree"
                    value={formData.degree}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md border shadow-sm ${
                      errors.degree ? 'border-red-500' : 'border-gray-300'
                    } focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2`}
                  >
                    <option value="MBBS">MBBS</option>
                    <option value="MD">MD</option>
                    <option value="MS">MS</option>
                    <option value="DNB">DNB</option>
                    <option value="BDS">BDS</option>
                    <option value="BAMS">BAMS</option>
                    <option value="BHMS">BHMS</option>
                    <option value="BUMS">BUMS</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.degree && <p className="text-red-500 text-xs mt-1">{errors.degree}</p>}
                </div>

                {formData.degree === 'Other' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Specify Degree <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="degree_other"
                      value={formData.degree_other}
                      onChange={handleChange}
                      className={`mt-1 block w-full rounded-md border shadow-sm ${
                        errors.degree_other ? 'border-red-500' : 'border-gray-300'
                      } focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2`}
                    />
                    {errors.degree_other && <p className="text-red-500 text-xs mt-1">{errors.degree_other}</p>}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Specialization <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleChange}
                    placeholder="e.g., Cardiology, Pediatrics"
                    className={`mt-1 block w-full rounded-md border shadow-sm ${
                      errors.specialization ? 'border-red-500' : 'border-gray-300'
                    } focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2`}
                  />
                  {errors.specialization && <p className="text-red-500 text-xs mt-1">{errors.specialization}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Years of Experience <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="experience_years"
                    value={formData.experience_years}
                    onChange={handleChange}
                    min="0"
                    max="60"
                    className={`mt-1 block w-full rounded-md border shadow-sm ${
                      errors.experience_years ? 'border-red-500' : 'border-gray-300'
                    } focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2`}
                  />
                  {errors.experience_years && <p className="text-red-500 text-xs mt-1">{errors.experience_years}</p>}
                </div>
              </div>
            </div>

            {/* Clinic Details (Optional) */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Clinic Information (Optional)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Clinic Name</label>
                  <input
                    type="text"
                    name="clinic_name"
                    value={formData.clinic_name}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Consultation Fee (₹)</label>
                  <input
                    type="number"
                    name="consultation_fee"
                    value={formData.consultation_fee}
                    onChange={handleChange}
                    min="0"
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Clinic Address</label>
                  <textarea
                    name="clinic_address"
                    value={formData.clinic_address}
                    onChange={handleChange}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Document Uploads */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Verification</h2>
              <p className="text-sm text-gray-600 mb-4">Upload clear, legible copies of your certificates (JPG, PNG, or PDF, max 10MB each)</p>
              
              <div className="space-y-4">
                {/* License Certificate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Medical License Certificate <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => handleFileChange(e, 'license_certificate')}
                    className={`mt-1 block w-full text-sm text-gray-500 border rounded-md px-3 py-2 ${
                      errors.license_certificate ? 'border-red-500' : 'border-gray-300'
                    } file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100`}
                  />
                  {errors.license_certificate && <p className="text-red-500 text-xs mt-1">{errors.license_certificate}</p>}
                  {filePreviews.license_certificate && (
                    <div className="mt-2">
                      {filePreviews.license_certificate.startsWith('http') || filePreviews.license_certificate.startsWith('data:') ? (
                        <img src={filePreviews.license_certificate} alt="License Preview" className="max-w-xs rounded shadow" />
                      ) : (
                        <p className="text-sm text-gray-600">{filePreviews.license_certificate}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Degree Certificate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Degree Certificate <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => handleFileChange(e, 'degree_certificate')}
                    className={`mt-1 block w-full text-sm text-gray-500 border rounded-md px-3 py-2 ${
                      errors.degree_certificate ? 'border-red-500' : 'border-gray-300'
                    } file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100`}
                  />
                  {errors.degree_certificate && <p className="text-red-500 text-xs mt-1">{errors.degree_certificate}</p>}
                  {filePreviews.degree_certificate && (
                    <div className="mt-2">
                      {filePreviews.degree_certificate.startsWith('http') || filePreviews.degree_certificate.startsWith('data:') ? (
                        <img src={filePreviews.degree_certificate} alt="Degree Preview" className="max-w-xs rounded shadow" />
                      ) : (
                        <p className="text-sm text-gray-600">{filePreviews.degree_certificate}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Government ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Government ID (Aadhar/PAN/Passport) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => handleFileChange(e, 'government_id')}
                    className={`mt-1 block w-full text-sm text-gray-500 border rounded-md px-3 py-2 ${
                      errors.government_id ? 'border-red-500' : 'border-gray-300'
                    } file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100`}
                  />
                  {errors.government_id && <p className="text-red-500 text-xs mt-1">{errors.government_id}</p>}
                  {filePreviews.government_id && (
                    <div className="mt-2">
                      {filePreviews.government_id.startsWith('http') || filePreviews.government_id.startsWith('data:') ? (
                        <img src={filePreviews.government_id} alt="ID Preview" className="max-w-xs rounded shadow" />
                      ) : (
                        <p className="text-sm text-gray-600">{filePreviews.government_id}</p>
                      )}
                    </div>
                  )}
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
                  } focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2`}
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

            {/* Terms Acceptance */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Terms & Conditions</h2>
              <div className="flex items-start">
                <input
                  type="checkbox"
                  name="terms_accepted"
                  checked={formData.terms_accepted}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  I accept the <a href="#" className="text-emerald-600 hover:underline">Terms and Conditions</a>{' '}
                  and agree to professional code of conduct <span className="text-red-500">*</span>
                </label>
              </div>
              {errors.terms_accepted && <p className="text-red-500 text-xs mt-1">{errors.terms_accepted}</p>}
            </div>

            {/* Submit Button */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-amber-700">
                    Your application will be reviewed by our admin team within <strong>24-48 hours</strong>. 
                    You will receive an email notification once your account is approved.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Already have an account? Login
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {loading ? 'Submitting Application...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
