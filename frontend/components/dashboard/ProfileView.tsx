'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { Profile, PatientProfile } from '@/types';
import {
  FiUser, FiCalendar, FiPhone, FiMapPin, FiDroplet, FiEdit2,
  FiSave, FiX, FiShield, FiAlertCircle, FiCheckCircle, FiPlus, FiTrash2,
} from 'react-icons/fi';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="bg-gray-100 p-2 rounded-lg mt-0.5">
        <Icon className="h-4 w-4 text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-900 mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );
}

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export function ProfileView() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({});

  // ── Queries ────────────────────────────────
  const { data: profile, isLoading: loadingProfile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.patients.getProfile(),
  });

  const { data: patientProfile, isLoading: loadingPatientProfile } = useQuery<PatientProfile>({
    queryKey: ['patient-profile'],
    queryFn: () => api.patients.getPatientProfile(),
    retry: false,
  });

  // ── Mutations ──────────────────────────────
  const updateProfile = useMutation({
    mutationFn: (data: Partial<Profile>) => api.patients.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
    },
  });

  // ── Handlers ───────────────────────────────
  function startEditing() {
    if (!profile) return;
    setForm({
      name: profile.name,
      phone: profile.phone,
      date_of_birth: profile.date_of_birth,
      blood_group: profile.blood_group,
      address: profile.address,
      district: profile.district,
      state: profile.state,
      pincode: profile.pincode,
    });
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setForm({});
  }

  function handleSave() {
    updateProfile.mutate(form);
  }

  function onChange(field: keyof Profile, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ── Loading ────────────────────────────────
  if (loadingProfile || loadingPatientProfile) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          <FiAlertCircle className="mx-auto h-10 w-10 mb-3 text-gray-400" />
          <p className="text-lg font-medium">No profile found</p>
          <p className="text-sm mt-1">Please create a profile to get started.</p>
        </CardContent>
      </Card>
    );
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Personal Information ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FiUser className="h-5 w-5 text-primary-600" />
              Personal Information
            </CardTitle>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <FiEdit2 className="h-4 w-4 mr-1" /> Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={cancelEditing}>
                  <FiX className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateProfile.isPending}>
                  <FiSave className="h-4 w-4 mr-1" /> {updateProfile.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {updateProfile.isError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Failed to update profile. Please try again.
            </div>
          )}

          {!editing ? (
            /* ── Read-only view ── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              <InfoRow icon={FiUser} label="Full Name" value={profile.name} />
              <InfoRow icon={FiCalendar} label="Date of Birth" value={formatDate(profile.date_of_birth)} />
              <InfoRow icon={FiUser} label="Age" value={profile.age ? `${profile.age} years` : undefined} />
              <InfoRow icon={FiUser} label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : undefined} />
              <InfoRow icon={FiDroplet} label="Blood Group" value={profile.blood_group} />
              <InfoRow icon={FiPhone} label="Phone" value={profile.phone} />
              <InfoRow icon={FiUser} label="Relationship" value={profile.relationship ? profile.relationship.charAt(0).toUpperCase() + profile.relationship.slice(1) : undefined} />
            </div>
          ) : (
            /* ── Edit form ── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Full Name</label>
                <Input value={form.name || ''} onChange={(e) => onChange('name', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Date of Birth</label>
                <Input type="date" value={form.date_of_birth || ''} onChange={(e) => onChange('date_of_birth', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Blood Group</label>
                <Input value={form.blood_group || ''} onChange={(e) => onChange('blood_group', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Phone</label>
                <Input value={form.phone || ''} onChange={(e) => onChange('phone', e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Address ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiMapPin className="h-5 w-5 text-primary-600" />
            Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              <InfoRow icon={FiMapPin} label="Address" value={profile.address} />
              <InfoRow icon={FiMapPin} label="District" value={profile.district} />
              <InfoRow icon={FiMapPin} label="State" value={profile.state} />
              <InfoRow icon={FiMapPin} label="Country" value={profile.country} />
              <InfoRow icon={FiMapPin} label="Pin Code" value={profile.pincode} />
              <InfoRow icon={FiMapPin} label="Region" value={profile.region} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Address</label>
                <Input value={form.address || ''} onChange={(e) => onChange('address', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">District</label>
                <Input value={form.district || ''} onChange={(e) => onChange('district', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">State</label>
                <Input value={form.state || ''} onChange={(e) => onChange('state', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Pin Code</label>
                <Input value={form.pincode || ''} onChange={(e) => onChange('pincode', e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Privacy & Consent ── */}
      {patientProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiShield className="h-5 w-5 text-primary-600" />
              Privacy &amp; Consent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ConsentRow
                label="Terms & Conditions"
                accepted={patientProfile.terms_accepted}
                date={patientProfile.terms_accepted_at}
              />
              <ConsentRow
                label="Data Storage Consent"
                accepted={patientProfile.consent_store_data}
                date={patientProfile.consent_store_data_at}
              />
              <ConsentRow
                label="Doctor Access Consent"
                accepted={patientProfile.consent_doctor_access}
                date={patientProfile.consent_doctor_access_at}
              />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">Data Sharing</p>
                  <p className="text-xs text-gray-500">Allow anonymized data for public health research</p>
                </div>
                <Badge variant={patientProfile.data_sharing_enabled ? 'success' : 'outline'}>
                  {patientProfile.data_sharing_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              {patientProfile.last_consent_update && (
                <p className="text-xs text-gray-400 pt-2 border-t">
                  Last consent update: {formatDate(patientProfile.last_consent_update)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Account Details ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiCalendar className="h-5 w-5 text-primary-600" />
            Account Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
            <InfoRow icon={FiCalendar} label="Profile Created" value={formatDate(profile.created_at)} />
            <InfoRow icon={FiCalendar} label="Last Updated" value={formatDate(profile.updated_at)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────
// Consent Row sub-component
// ──────────────────────────────────────────────

function ConsentRow({ label, accepted, date }: { label: string; accepted: boolean; date?: string | null }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {accepted ? (
          <FiCheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <FiAlertCircle className="h-4 w-4 text-gray-400" />
        )}
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {date && <p className="text-xs text-gray-500">Accepted on {formatDate(date)}</p>}
        </div>
      </div>
      <Badge variant={accepted ? 'success' : 'destructive'}>
        {accepted ? 'Accepted' : 'Pending'}
      </Badge>
    </div>
  );
}
