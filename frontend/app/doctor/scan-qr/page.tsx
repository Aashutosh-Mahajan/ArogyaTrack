'use client';

import React, { useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { FiCamera, FiX, FiUser, FiActivity, FiAlertTriangle } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

function ScanQRPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [patientData, setPatientData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startScanning = () => {
    setIsScanning(true);
    const html5QrcodeScanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      false
    );

    html5QrcodeScanner.render(
      (decodedText: string) => {
        handleScan(decodedText);
        html5QrcodeScanner.clear();
        setIsScanning(false);
      },
      (error: any) => {
        // Silent error handling
      }
    );

    setScanner(html5QrcodeScanner);
  };

  const stopScanning = () => {
    if (scanner) {
      scanner.clear();
      setIsScanning(false);
      setScanner(null);
    }
  };

  const handleScan = async (token: string) => {
    setIsLoading(true);
    try {
      const data = await api.medical.scanQR(token);
      setPatientData(data);
      toast.success('Patient data loaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to scan QR code');
      setPatientData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      handleScan(manualToken);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scan Patient QR</h1>
          <p className="text-gray-600 mt-1">
            Scan patient health card to access medical records
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* QR Scanner */}
          <Card>
            <CardHeader>
              <CardTitle>Camera Scanner</CardTitle>
              <CardDescription>
                Use your camera to scan the patient's health card QR code
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isScanning ? (
                <Button 
                  onClick={startScanning}
                  className="w-full"
                  size="lg"
                >
                  <FiCamera className="mr-2" />
                  Start Camera Scanner
                </Button>
              ) : (
                <div className="space-y-4">
                  <div id="qr-reader" className="w-full"></div>
                  <Button 
                    onClick={stopScanning}
                    variant="destructive"
                    className="w-full"
                  >
                    <FiX className="mr-2" />
                    Stop Scanner
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Entry */}
          <Card>
            <CardHeader>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>
                Or enter the token manually
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <Input
                  type="text"
                  placeholder="Enter JWT token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button 
                  type="submit"
                  className="w-full"
                  disabled={!manualToken.trim() || isLoading}
                >
                  {isLoading ? 'Loading...' : 'Access Patient Records'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Patient Data Display */}
        {patientData && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-900">Patient Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Patient Details */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg">
                    <FiUser className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">
                        {patientData.profile.user.first_name} {patientData.profile.user.last_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg">
                    <FiActivity className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-sm text-gray-600">Blood Group</p>
                      <p className="font-medium">{patientData.profile.blood_group}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-lg">
                    <p className="text-sm text-gray-600">Age</p>
                    <p className="font-medium">
                      {new Date().getFullYear() - new Date(patientData.profile.date_of_birth).getFullYear()} years
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-lg">
                    <p className="text-sm text-gray-600">Gender</p>
                    <p className="font-medium">
                      {patientData.profile.gender === 'M' ? 'Male' : patientData.profile.gender === 'F' ? 'Female' : 'Other'}
                    </p>
                  </div>
                </div>

                {/* Allergies Alert */}
                {patientData.allergies && patientData.allergies.length > 0 && (
                  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <FiAlertTriangle className="h-5 w-5 text-red-600" />
                      <p className="font-semibold text-red-900">Allergies</p>
                    </div>
                    <div className="space-y-1">
                      {patientData.allergies.map((allergy: any) => (
                        <p key={allergy.id} className="text-sm text-red-800">
                          • {allergy.allergen} ({allergy.severity})
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chronic Conditions */}
                {patientData.chronic_conditions && patientData.chronic_conditions.length > 0 && (
                  <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
                    <p className="font-semibold text-yellow-900 mb-2">Chronic Conditions</p>
                    <div className="space-y-1">
                      {patientData.chronic_conditions.map((condition: any) => (
                        <p key={condition.id} className="text-sm text-yellow-800">
                          • {condition.condition_name} ({condition.status})
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={() => router.push(`/doctor/patients/${patientData.profile.id}`)}
                    className="flex-1"
                  >
                    View Full Medical History
                  </Button>
                  <Button 
                    onClick={() => router.push(`/doctor/patients/${patientData.profile.id}/new-record`)}
                    variant="outline"
                    className="flex-1"
                  >
                    Add New Record
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export default withAuth(ScanQRPage, ['doctor']);
