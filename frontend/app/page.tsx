'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  FiActivity,
  FiShield,
  FiUsers,
  FiBarChart,
  FiMapPin,
  FiTrendingUp,
  FiCheckCircle,
  FiArrowRight,
  FiMenu
} from 'react-icons/fi';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'doctor') router.push('/doctor');
      else if (user.role === 'admin' || user.role === 'authority') router.push('/admin');
      else if (user.role === 'pharmacist') router.push('/pharmacy');
      else router.push('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  if (isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="loading-dots text-primary">
          <span></span><span></span><span></span>
        </div>
      </div>
    );
  }

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-4 md:px-8">
        <div className="mx-auto max-w-7xl glass-morphism rounded-full px-6 py-3 flex justify-between items-center shadow-soft">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <img src="/emblem.png" alt="Gov" className="w-5 h-5 object-contain opacity-80" onError={(e) => e.currentTarget.style.display = 'none'} />
              {/* Fallback icon if image fails */}
              <FiActivity className="w-5 h-5 text-primary" style={{ display: 'none' }} />
            </div>
            <div>
              <span className="text-xl font-display font-bold text-gradient block leading-none">ArogyaTrack</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest block leading-none mt-0.5">Govt. of India</span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-muted-foreground">
            <Link href="#features" className="hover:text-primary transition-colors">Services</Link>
            <Link href="#about" className="hover:text-primary transition-colors">About Mission</Link>
            <Link href="#contact" className="hover:text-primary transition-colors">Contact</Link>
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/login" className="hidden md:block">
              <Button variant="ghost" className="text-muted-foreground hover:text-primary">Official Login</Button>
            </Link>
            <Link href="/signup">
              <Button className="rounded-full shadow-lg hover:shadow-primary/25 transition-all">Register Facility</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-radial from-teal-50/50 to-transparent -z-10 blur-3xl opacity-50 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/3 h-2/3 bg-gradient-radial from-blue-50/50 to-transparent -z-10 blur-3xl opacity-50 pointer-events-none" />

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="text-left space-y-8"
          >
            <motion.div variants={fadeIn}>
              <span className="px-4 py-1.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100/50 text-sm font-semibold tracking-wide uppercase flex items-center w-fit gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                National Digital Health Mission
              </span>
            </motion.div>

            <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl font-display font-bold leading-tight text-foreground">
              Securing India's <br />
              <span className="text-gradient">Health Future</span> <br />
            </motion.h1>

            <motion.p variants={fadeIn} className="text-xl text-muted-foreground max-w-lg leading-relaxed">
              A unified national platform for real-time disease surveillance, resource management, and predictive healthcare analytics.
            </motion.p>

            <motion.div variants={fadeIn} className="flex flex-wrap gap-4 pt-4">
              <Link href="/signup">
                <Button size="lg" className="h-14 px-8 text-lg shadow-xl shadow-primary/20 hover:shadow-primary/40 btn-lift">
                  Access Portal <FiArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link href="#status">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-2 hover:bg-accent/50">
                  Public Dashboard
                </Button>
              </Link>
            </motion.div>

            <motion.div variants={fadeIn} className="flex items-center gap-8 pt-8 opacity-80">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`w-10 h-10 rounded-full border-2 border-background bg-gray-200 flex items-center justify-center text-xs font-bold ${i === 4 ? 'bg-primary text-white' : ''}`}>
                    {i === 4 ? '+' : ''}
                  </div>
                ))}
              </div>
              <div className="text-sm font-medium">
                <p className="text-foreground">Connected Hospitals</p>
                <p className="text-muted-foreground">Pan-India Network</p>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden md:block"
          >
            <div className="relative z-10 bg-white rounded-[2.5rem] shadow-2xl p-6 border border-gray-100 rotate-2 hover:rotate-0 transition-transform duration-500">
              {/* Mock Dashboard UI */}
              <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-50 rounded-[2.5rem] -z-10" />
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold">National Status</h3>
                  <p className="text-sm text-gray-500">Real-time Aggregation</p>
                </div>
                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span> Live
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50/50 p-4 rounded-2xl">
                  <p className="text-sm text-gray-500 mb-1">Total Screenings</p>
                  <p className="text-2xl font-bold text-blue-700">1.2Cr+</p>
                </div>
                <div className="bg-purple-50/50 p-4 rounded-2xl">
                  <p className="text-sm text-gray-500 mb-1">Recovery Rate</p>
                  <p className="text-2xl font-bold text-purple-700">98.2%</p>
                </div>
              </div>
              <div className="h-40 rounded-xl relative overflow-hidden">
                <Image src="/image.png" alt="Health chart" fill className="object-cover object-top rounded-xl" />
              </div>
            </div>

            {/* Floating Elements */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-6 -right-6 bg-white p-4 rounded-2xl shadow-xl border border-gray-50 z-20"
            >
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full">
                  <FiShield className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Security Level</p>
                  <p className="font-bold text-green-600">Tier-4 GovCloud</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-4 bg-secondary/5 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">Integrated Health Infrastructure</h2>
            <p className="text-muted-foreground text-lg">
              Empowering the nation with a unified, transparent, and efficient digital health ecosystem.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: FiActivity,
                title: "National Surveillance",
                desc: "Real-time monitoring of disease vectors across districts and states using advanced telemetry.",
                color: "text-blue-600",
                bg: "bg-blue-50"
              },
              {
                icon: FiShield,
                title: "Data Sovereignty",
                desc: "End-to-end encrypted patient data stored securely within national borders.",
                color: "text-purple-600",
                bg: "bg-purple-50"
              },
              {
                icon: FiTrendingUp,
                title: "Predictive AI Models",
                desc: "Government-approved algorithms for early outbreak detection and resource allocation.",
                color: "text-amber-600",
                bg: "bg-amber-50"
              },
              {
                icon: FiMapPin,
                title: "Geo-Spatial Mapping",
                desc: "District-level granularity for heatmap generation and hotspot identification.",
                color: "text-rose-600",
                bg: "bg-rose-50"
              },
              {
                icon: FiUsers,
                title: "Unified Stakeholders",
                desc: "Connecting Doctors, Pharmacists, and District Admins on a single secure platform.",
                color: "text-emerald-600",
                bg: "bg-emerald-50"
              },
              {
                icon: FiBarChart,
                title: "Policy Analytics",
                desc: "Actionable insights for policymakers to draft effective public health strategies.",
                color: "text-cyan-600",
                bg: "bg-cyan-50"
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="h-full border-none shadow-soft hover:shadow-card-hover transition-all duration-300">
                  <CardHeader>
                    <div className={`w-14 h-14 ${feature.bg} rounded-2xl flex items-center justify-center mb-4 transition-colors`}>
                      <feature.icon className={`w-7 h-7 ${feature.color}`} />
                    </div>
                    <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {feature.desc}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-primary rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />

            <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-6 relative z-10">
              Partner with the Mission
            </h2>
            <p className="text-white/80 text-lg md:text-xl max-w-2xl mx-auto mb-10 relative z-10">
              Join the National Digital Health Mission to build a healthier, safer India.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
              <Link href="/signup">
                <Button size="lg" className="bg-white text-primary hover:bg-gray-100 border-none shadow-lg w-full sm:w-auto h-14 text-lg px-8">
                  Register Facility
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:text-white w-full sm:w-auto h-14 text-lg px-8">
                  Contact Support
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <FiActivity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-lg font-bold text-foreground block leading-none">ArogyaTrack</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest block leading-none mt-0.5">Govt. of India</span>
            </div>
          </div>
          <div className="flex gap-8 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-primary">Privacy Policy</Link>
            <Link href="#" className="hover:text-primary">Terms of Use</Link>
            <Link href="#" className="hover:text-primary">Grievance Redressal</Link>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Ministry of Health. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
