'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { 
  FiActivity, 
  FiShield, 
  FiUsers, 
  FiBarChart, 
  FiMapPin, 
  FiTrendingUp,
  FiCheckCircle,
  FiArrowRight
} from 'react-icons/fi';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Redirect to appropriate dashboard based on role
      if (user.role === 'doctor') {
        router.push('/doctor');
      } else if (user.role === 'admin' || user.role === 'authority') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, user, router]);

  if (isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <FiActivity className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Health Surveillance</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-extrabold text-gray-900 mb-6">
            Advanced Health Surveillance
            <span className="block text-blue-600 mt-2">For Better Public Health</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Monitor, track, and predict disease outbreaks with our comprehensive healthcare surveillance system. 
            Empowering healthcare professionals and authorities with real-time insights.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8">
                Get Started <FiArrowRight className="ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Comprehensive Healthcare Management</h2>
          <p className="text-lg text-gray-600">Everything you need to monitor and manage public health</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="border-2 hover:border-blue-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <FiActivity className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Real-time Monitoring</CardTitle>
              <CardDescription>
                Track disease outbreaks and health metrics in real-time with advanced analytics
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-purple-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <FiShield className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Secure & Compliant</CardTitle>
              <CardDescription>
                HIPAA-compliant system with enterprise-grade security and data protection
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <FiUsers className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>Patient Management</CardTitle>
              <CardDescription>
                Comprehensive patient records, medication tracking, and adherence monitoring
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-yellow-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <FiBarChart className="w-6 h-6 text-yellow-600" />
              </div>
              <CardTitle>Advanced Analytics</CardTitle>
              <CardDescription>
                Machine learning-powered predictions and detailed statistical analysis
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-red-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <FiMapPin className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle>Geographic Tracking</CardTitle>
              <CardDescription>
                Interactive maps showing disease distribution and hotspot identification
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-indigo-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <FiTrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              <CardTitle>Predictive Models</CardTitle>
              <CardDescription>
                AI-powered outbreak prediction and risk assessment for proactive intervention
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold mb-6">Why Choose Our System?</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <FiCheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg">Early Detection</h3>
                  <p className="text-blue-100">Identify potential outbreaks before they spread widely</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FiCheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg">Data-Driven Decisions</h3>
                  <p className="text-blue-100">Make informed healthcare decisions backed by comprehensive data</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FiCheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg">Improved Outcomes</h3>
                  <p className="text-blue-100">Better patient adherence and treatment success rates</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FiCheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg">Seamless Integration</h3>
                  <p className="text-blue-100">Easy integration with existing healthcare systems</p>
                </div>
              </div>
            </div>
            <div className="mt-8">
              <Link href="/signup">
                <Button size="lg" variant="secondary" className="text-lg px-8">
                  Start Your Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <FiActivity className="w-6 h-6 text-blue-600" />
              <span className="text-lg font-bold text-gray-900">Health Surveillance System</span>
            </div>
            <p className="text-gray-600">© 2026 Health Surveillance. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
