'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardSummary } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmergencyModal } from '@/components/dashboard/EmergencyModal';
import {
  FiShield,
  FiAlertTriangle,
  FiClock,
  FiActivity,
  FiHeart,
  FiAlertCircle,
} from 'react-icons/fi';

function riskColor(level: string) {
  switch (level) {
    case 'High':
      return { badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', ring: 'ring-red-500/20' };
    case 'Medium':
      return { badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500', ring: 'ring-orange-500/20' };
    default:
      return { badge: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500', ring: 'ring-green-500/20' };
  }
}

function formatLastLogin(dt: string | null): string {
  if (!dt) return 'First login';
  const d = new Date(dt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DashboardHeader() {
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.dashboard.getSummary(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-8 w-64 bg-gray-200 rounded mb-3" />
          <div className="h-4 w-48 bg-gray-100 rounded mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const risk = riskColor(summary.calculated_risk_level);

  const snapshots = [
    {
      label: 'Risk Score',
      value: summary.calculated_risk_score,
      icon: FiShield,
      color: risk.dot === 'bg-red-500' ? 'text-red-600' : risk.dot === 'bg-orange-500' ? 'text-orange-600' : 'text-green-600',
      bg: risk.dot === 'bg-red-500' ? 'bg-red-50' : risk.dot === 'bg-orange-500' ? 'bg-orange-50' : 'bg-green-50',
    },
    {
      label: 'Active Alerts',
      value: summary.total_alerts,
      icon: FiAlertTriangle,
      color: summary.total_alerts > 0 ? 'text-amber-600' : 'text-gray-500',
      bg: summary.total_alerts > 0 ? 'bg-amber-50' : 'bg-gray-50',
    },
    {
      label: 'Adherence',
      value: `${Math.round(summary.adherence_percentage)}%`,
      icon: FiHeart,
      color: summary.adherence_percentage >= 80 ? 'text-green-600' : summary.adherence_percentage >= 50 ? 'text-orange-600' : 'text-red-600',
      bg: summary.adherence_percentage >= 80 ? 'bg-green-50' : summary.adherence_percentage >= 50 ? 'bg-orange-50' : 'bg-red-50',
    },
    {
      label: 'Last Login',
      value: formatLastLogin(summary.last_login),
      icon: FiClock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <>
      <Card className="overflow-hidden border-0 shadow-lg">
        {/* Top gradient bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        <CardContent className="p-6">
          {/* Welcome Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Welcome back, {summary.patient_name}!
              </h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <FiClock className="h-3.5 w-3.5" />
                  {summary.last_login
                    ? `Last login: ${new Date(summary.last_login).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}`
                    : 'Welcome to Health Surveillance'}
                </span>

                {/* Risk Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${risk.badge}`}
                >
                  <span className={`h-2 w-2 rounded-full ${risk.dot} animate-pulse`} />
                  {summary.calculated_risk_level} Risk
                </span>
              </div>
            </div>

            {/* Emergency Button */}
            <Button
              variant="destructive"
              size="lg"
              className="gap-2 shadow-md hover:shadow-lg transition-shadow shrink-0"
              onClick={() => setEmergencyOpen(true)}
            >
              <FiAlertCircle className="h-5 w-5" />
              <span className="hidden sm:inline">Emergency</span>
              <span className="sm:hidden">SOS</span>
            </Button>
          </div>

          {/* Health Snapshot Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {snapshots.map((item, i) => (
              <div
                key={i}
                className={`${item.bg} rounded-xl p-4 transition-transform hover:scale-[1.02]`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {item.label}
                  </span>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${item.color}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Modal */}
      <EmergencyModal
        open={emergencyOpen}
        onOpenChange={setEmergencyOpen}
        healthId={summary.health_id}
        bloodGroup={summary.blood_group}
        emergencyContactName={summary.emergency_contact_name}
        emergencyContactPhone={summary.emergency_contact_phone}
        emergencyContactRelationship={summary.emergency_contact_relationship}
        patientName={summary.patient_name}
      />
    </>
  );
}
