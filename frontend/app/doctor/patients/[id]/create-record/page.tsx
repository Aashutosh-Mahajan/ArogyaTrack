"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function CreateVisitRecordPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    diagnosis: "",
    tests_performed: "",
    prescription: "",
    doctor_notes: "",
    visit_date: new Date().toISOString().split("T")[0],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createRecordMutation = useMutation({
    mutationFn: (data: any) => api.medical.createVisitRecord(patientId, data),
    onSuccess: () => {
      // Invalidate all relevant queries so the patient dashboard updates
      queryClient.invalidateQueries({ queryKey: ['dashboard-recent-records'] });
      queryClient.invalidateQueries({ queryKey: ['medical-records-all'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-lab-monitoring'] });
      queryClient.invalidateQueries({ queryKey: ['visit-records-list'] });
      
      alert("✅ Visit record created successfully!");
      router.push("/doctor/my-patients");
    },
    onError: (error: any) => {
      console.error("Error creating visit record:", error);
      if (error.response?.data) {
        setErrors(error.response.data);
      }
      
      const errorDetail = error.response?.data?.detail || "";
      if (errorDetail.includes("do not have access") || errorDetail.includes("add them to your patients list")) {
        alert(
          "⚠️ Access Required!\n\n" +
          "You need to add this patient to \"My Patients\" list before creating a visit record.\n\n" +
          "Please:\n" +
          "1. Go to \"Scan Patient QR\"\n" +
          "2. Scan the patient's QR code\n" +
          "3. Click \"Add to My Patients\"\n" +
          "4. Then create the visit record"
        );
        router.push("/doctor/scan-qr");
      } else {
        alert(errorDetail || "Failed to create visit record. Please try again.");
      }
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.diagnosis.trim()) {
      newErrors.diagnosis = "Diagnosis is required";
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createRecordMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                Create Visit Record
              </h1>
              <p className="text-gray-600">
                Add consultation details for this patient
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8">
          <div className="space-y-6">
            {/* Visit Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Visit Date *
              </label>
              <input
                type="date"
                name="visit_date"
                value={formData.visit_date}
                onChange={handleChange}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Diagnosis */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Diagnosis * 🏥
              </label>
              <textarea
                name="diagnosis"
                value={formData.diagnosis}
                onChange={handleChange}
                rows={4}
                placeholder="Enter the diagnosis, symptoms observed, and clinical findings..."
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.diagnosis ? "border-red-500" : "border-gray-300"
                }`}
                required
              />
              {errors.diagnosis && (
                <p className="mt-1 text-sm text-red-600">{errors.diagnosis}</p>
              )}
            </div>

            {/* Tests Performed */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tests Performed 🔬
              </label>
              <textarea
                name="tests_performed"
                value={formData.tests_performed}
                onChange={handleChange}
                rows={3}
                placeholder="List all tests, investigations, and procedures performed (e.g., Blood Test, X-Ray, ECG...)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional - Leave blank if no tests were performed
              </p>
            </div>

            {/* Prescription */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Prescription 💊
              </label>
              <textarea
                name="prescription"
                value={formData.prescription}
                onChange={handleChange}
                rows={5}
                placeholder="Enter medication details, dosage, frequency, and duration...&#10;Example:&#10;• Tab. Paracetamol 500mg - 1 tablet twice daily - 5 days&#10;• Syp. Cough Relief - 10ml thrice daily - 7 days"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional - Including medicine name, strength, dosage, and duration
              </p>
            </div>

            {/* Doctor Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Doctor's Notes 📝
              </label>
              <textarea
                name="doctor_notes"
                value={formData.doctor_notes}
                onChange={handleChange}
                rows={4}
                placeholder="Important observations, follow-up instructions, or special notes...&#10;• Patient advised bed rest&#10;• Follow-up after 7 days&#10;• Avoid cold beverages"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-yellow-50"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional - Any important observations or instructions for the patient
              </p>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">ℹ️</span>
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">
                    Important Information
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Only diagnosis is mandatory, all other fields are optional</li>
                    <li>• Visit records are immediately accessible to the patient</li>
                    <li>• You can attach reports/documents after creating the record</li>
                    <li>• Doctor's notes are highlighted for quick reference</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
                disabled={createRecordMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createRecordMutation.isPending}
                className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createRecordMutation.isPending
                  ? "Creating..."
                  : "✅ Create Visit Record"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
