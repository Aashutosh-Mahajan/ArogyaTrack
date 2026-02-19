'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PharmacistRegistrationData } from '@/types';
import toast from 'react-hot-toast';

export default function PharmacistSignupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [filePreviews, setFilePreviews] = useState<{
        license_certificate?: string;
    }>({});

    const [formData, setFormData] = useState<Partial<PharmacistRegistrationData>>({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        license_number: '',
        degree: 'B.Pharm',
        pharmacy_name: '',
        terms_accepted: false,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));

        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>, fieldName: string) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error('File size must be less than 10MB');
                return;
            }

            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                toast.error('Only JPG, PNG, and PDF files are allowed');
                return;
            }

            setFormData((prev) => ({ ...prev, [fieldName]: file }));

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

        if (!formData.first_name) newErrors.first_name = 'First name is required';
        if (!formData.last_name) newErrors.last_name = 'Last name is required';
        if (!formData.email) newErrors.email = 'Email is required';
        if (!formData.password) newErrors.password = 'Password is required';
        if (!formData.license_number) newErrors.license_number = 'License number is required';
        if (!formData.degree) newErrors.degree = 'Degree is required';
        if (!formData.license_certificate) newErrors.license_certificate = 'License certificate is required';

        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }

        if (formData.password && formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }

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
            await api.auth.registerPharmacist(formData as PharmacistRegistrationData);
            toast.success('Registration successful! Your application is under review.');
            router.push(`/verify-email?email=${encodeURIComponent(formData.email || '')}&role=pharmacist`);
        } catch (error: any) {
            console.error('Registration error:', error);

            // Handle structured errors from backend
            if (error.response?.data) {
                const data = error.response.data;
                const backendErrors: Record<string, string> = {};

                // If 'errors' key exists (common DRF pattern)
                if (data.errors) {
                    Object.entries(data.errors).forEach(([key, value]) => {
                        backendErrors[key] = Array.isArray(value) ? value[0] : String(value);
                    });
                }
                // Flatten direct field errors
                else {
                    Object.entries(data).forEach(([key, value]) => {
                        if (key !== 'detail' && key !== 'message') {
                            backendErrors[key] = Array.isArray(value) ? value[0] : String(value);
                        }
                    });
                }

                if (Object.keys(backendErrors).length > 0) {
                    setErrors(backendErrors);
                    toast.error('Please fix the errors highlighted in the form');
                } else {
                    toast.error(data.detail || data.message || 'Registration failed. Please try again.');
                }
            } else {
                toast.error('Registration failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">Pharmacist Registration</h1>
                        <p className="mt-2 text-gray-600">
                            Join our pharmacy network - Your application will be reviewed within 24-48 hours
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
                                        className={`mt-1 block w-full rounded-md border shadow-sm ${errors.first_name ? 'border-red-500' : 'border-gray-300'
                                            } focus:border-purple-500 focus:ring-purple-500 px-3 py-2`}
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
                                        className={`mt-1 block w-full rounded-md border shadow-sm ${errors.last_name ? 'border-red-500' : 'border-gray-300'
                                            } focus:border-purple-500 focus:ring-purple-500 px-3 py-2`}
                                    />
                                    {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className={`mt-1 block w-full rounded-md border shadow-sm ${errors.email ? 'border-red-500' : 'border-gray-300'
                                            } focus:border-purple-500 focus:ring-purple-500 px-3 py-2`}
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
                                        Pharmacy Council License Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="license_number"
                                        value={formData.license_number}
                                        onChange={handleChange}
                                        className={`mt-1 block w-full rounded-md border shadow-sm ${errors.license_number ? 'border-red-500' : 'border-gray-300'
                                            } focus:border-purple-500 focus:ring-purple-500 px-3 py-2`}
                                    />
                                    {errors.license_number && <p className="text-red-500 text-xs mt-1">{errors.license_number}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Degree <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="degree"
                                        value={formData.degree}
                                        onChange={handleChange}
                                        className={`mt-1 block w-full rounded-md border shadow-sm ${errors.degree ? 'border-red-500' : 'border-gray-300'
                                            } focus:border-purple-500 focus:ring-purple-500 px-3 py-2`}
                                    >
                                        <option value="B.Pharm">B.Pharm</option>
                                        <option value="M.Pharm">M.Pharm</option>
                                        <option value="Pharm.D">Pharm.D</option>
                                        <option value="D.Pharm">D.Pharm</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    {errors.degree && <p className="text-red-500 text-xs mt-1">{errors.degree}</p>}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Pharmacy Name (Optional)</label>
                                    <input
                                        type="text"
                                        name="pharmacy_name"
                                        value={formData.pharmacy_name}
                                        onChange={handleChange}
                                        placeholder="If you own or manage a pharmacy"
                                        className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 px-3 py-2"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Document Uploads */}
                        <div className="bg-gray-50 rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Verification</h2>

                            <div className="space-y-4">
                                {/* License Certificate */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Pharmacy License Certificate <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        onChange={(e) => handleFileChange(e, 'license_certificate')}
                                        className={`mt-1 block w-full text-sm text-gray-500 border rounded-md px-3 py-2 ${errors.license_certificate ? 'border-red-500' : 'border-gray-300'
                                            } file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100`}
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
                            </div>
                        </div>

                        {/* Password */}
                        <div className="bg-gray-50 rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Security</h2>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={`mt-1 block w-full rounded-md border shadow-sm ${errors.password ? 'border-red-500' : 'border-gray-300'
                                            } focus:border-purple-500 focus:ring-purple-500 px-3 py-2 pr-10`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
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
                                    className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                />
                                <label className="ml-2 text-sm text-gray-700">
                                    I accept the <a href="#" className="text-purple-600 hover:underline">Terms and Conditions</a>{' '}
                                    and agree to the Pharmacy Act and regulations <span className="text-red-500">*</span>
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
                                className="text-purple-600 hover:text-purple-700 font-medium"
                            >
                                Already have an account? Login
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
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
