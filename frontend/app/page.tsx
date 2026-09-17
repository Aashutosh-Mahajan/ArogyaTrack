'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import MLModelStack from '@/components/landing/MLModelStack';
import { ThemeToggle } from '@/components/ThemeToggle';

/* ───────────────────────── helpers ───────────────────────── */

function useCountUp(end: number, duration = 2000, trigger = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const step = end / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(id); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [end, duration, trigger]);
  return val;
}

function SectionReveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay, ease: [.22, 1, .36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

/* ───── inline SVGs ───── */
const EcgLine = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 1200 60" fill="none" className={className} preserveAspectRatio="none">
    <path d="M0 30 L200 30 L230 10 L260 50 L290 5 L320 55 L350 30 L1200 30" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const LogoIcon = () => (
  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#6fae87] to-[#4a8a6f] flex items-center justify-center flex-shrink-0">
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  </div>
);

/* ───────────────────────── MAIN ───────────────────────── */

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ─── animation variants ─── */
  const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.6, ease: [.22, 1, .36, 1] } }) };

  const marqueeItems = [
    '🏥 Active Hospitals: 2,847',
    '👨\u200D⚕️ Verified Doctors: 12,500+',
    '💊 Prescriptions Issued: 8.2M',
    '🦠 Diseases Tracked: 847',
    '📊 Daily Reports: 45,000+',
    '⚡ Avg Response Time: 2.3 hrs',
  ];

  return (
    <div className="min-h-screen bg-background font-dm selection:bg-primary/20 overflow-x-hidden">

      {/* ═══════════════════ NAVBAR (fluid island) ═══════════════════ */}
      <nav className={`fixed top-4 sm:top-5 left-0 right-0 z-[100] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] px-4 ${scrolled ? '' : ''}`}>
        <div className={`max-w-5xl mx-auto h-14 flex items-center justify-between rounded-full pl-4 pr-2 sm:pl-5 sm:pr-2.5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${scrolled ? 'fluid-nav shadow-glass' : 'bg-card/40 backdrop-blur-md border border-foreground/10'}`}>
          <Link href="/" className="flex items-center gap-2.5">
            <LogoIcon />
            <div className="leading-none hidden sm:block">
              <span className="font-syne font-extrabold text-base text-foreground block">ArogyaTrack</span>
              <span className="text-[8px] font-semibold tracking-[0.2em] text-emerald-600 uppercase block mt-0.5">Govt. of India</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            {['Home', 'Features', 'Surveillance', 'About', 'Contact'].map(l => (
              <Link key={l} href={`#${l.toLowerCase()}`} className="hover:text-foreground transition-colors">{l}</Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="text-foreground" />
            <Link href="/login">
              <button className="hidden sm:inline-flex px-4 py-2 rounded-full text-sm font-semibold text-foreground hover:bg-foreground/8 transition-colors">Login</button>
            </Link>
            <Link href="/signup">
              <button className="group magnetic-btn pl-4 pr-1.5 py-1.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#6fae87] to-[#4a8a6f] shadow-button flex items-center gap-2 active:scale-[0.98]">
                Get Started
                <span className="btn-icon-wrap">
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8h8M9 4l4 4-4 4" /></svg>
                </span>
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section id="home" className="relative min-h-screen flex items-center pt-24 bg-[#151109] overflow-hidden">
        {/* dot grid overlay */}
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        {/* radial glow */}
        <div className="absolute top-1/2 right-0 w-[700px] h-[700px] -translate-y-1/2 translate-x-1/4 rounded-full bg-emerald-400/15 blur-[120px] pointer-events-none" />
        {/* ecg line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 text-emerald-500/10 h-16">
          <EcgLine className="w-full h-full" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full grid lg:grid-cols-[55%_45%] gap-12 items-center py-20 lg:py-0">
          {/* LEFT */}
          <motion.div initial="hidden" animate="visible" className="relative z-10 space-y-8">
            <motion.div custom={0} variants={fadeUp} className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-400/20">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 text-sm font-medium">Live Disease Surveillance Active</span>
            </motion.div>

            <motion.h1 custom={1} variants={fadeUp} className="font-syne font-extrabold text-5xl sm:text-6xl lg:text-[4.25rem] leading-[1.08] text-white">
              Protecting{' '}
              <span className="bg-gradient-to-r from-[#6fae87] to-[#8fc4a8] bg-clip-text text-transparent">India&apos;s</span>
              <br />Public Health
              <br />Intelligence
            </motion.h1>

            <motion.p custom={2} variants={fadeUp} className="text-white/60 text-lg sm:text-xl max-w-xl leading-relaxed">
              An enterprise-grade disease surveillance platform combining AI-powered outbreak detection, digital health records, and real-time public health intelligence — protecting 1.4 billion people.
            </motion.p>

            <motion.div custom={3} variants={fadeUp} className="flex flex-wrap gap-4 pt-2">
              <Link href="/signup">
                <button className="group magnetic-btn pl-7 pr-2 py-2 rounded-full text-base font-bold text-white bg-gradient-to-r from-[#6fae87] to-[#4a8a6f] shadow-xl shadow-emerald-600/30 flex items-center gap-3 active:scale-[0.98]">
                  Get Started
                  <span className="btn-icon-wrap w-10 h-10">
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8h8M9 4l4 4-4 4" /></svg>
                  </span>
                </button>
              </Link>
              <Link href="#features">
                <button className="magnetic-btn px-7 py-3.5 rounded-full text-base font-bold text-white border border-white/25 hover:bg-white/10 active:scale-[0.98]">
                  View Live Dashboard
                </button>
              </Link>
            </motion.div>

            <motion.div custom={4} variants={fadeUp} className="flex flex-wrap gap-8 pt-6">
              {[{ n: '1.4B+', l: 'Citizens Protected' }, { n: '500+', l: 'Districts Monitored' }, { n: '99.9%', l: 'Uptime' }].map(s => (
                <div key={s.l}>
                  <p className="font-syne font-extrabold text-2xl text-emerald-400">{s.n}</p>
                  <p className="text-white/50 text-sm mt-0.5">{s.l}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* RIGHT — dashboard mockup */}
          <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.4, ease: [.22, 1, .36, 1] }} className="relative hidden lg:block">
            {/* glow behind card */}
            <div className="absolute inset-0 bg-emerald-500/10 rounded-[30px] blur-[60px] scale-90" />

            {/* main card — double-bezel: outer shell + inner core */}
            <div className="relative bezel-shell-dark shadow-2xl">
            <div className="bezel-core-dark p-6">
              {/* topbar dots */}
              <div className="flex gap-2 mb-5">
                <span className="w-3 h-3 rounded-full bg-red-400/70" /><span className="w-3 h-3 rounded-full bg-yellow-400/70" /><span className="w-3 h-3 rounded-full bg-green-400/70" />
              </div>
              {/* health score ring */}
              <div className="flex items-center gap-6 mb-6">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#2a8a7e" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="url(#ring-grad)" strokeWidth="8" strokeDasharray={`${94 * 2.64} ${(100 - 94) * 2.64}`} strokeLinecap="round" />
                    <defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6fae87" /><stop offset="100%" stopColor="#8fc4a8" /></linearGradient></defs>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-syne font-extrabold text-2xl text-white">94</span>
                </div>
                <div>
                  <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">Health Score</p>
                  <p className="text-white/50 text-xs mt-1">National composite index</p>
                </div>
              </div>
              {/* sparklines */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                {[{ label: 'Cases Trend', color: '#6fae87' }, { label: 'Recovery Rate', color: '#8fc4a8' }].map((c, i) => (
                  <div key={i} className="bg-[#2b241c] rounded-xl p-3">
                    <p className="text-white/40 text-[11px] mb-2">{c.label}</p>
                    <svg viewBox="0 0 120 30" className="w-full h-8">
                      <polyline fill="none" stroke={c.color} strokeWidth="2" strokeLinecap="round" points={i === 0 ? '0,25 15,20 30,22 45,12 60,18 75,8 90,15 105,5 120,10' : '0,20 15,18 30,12 45,15 60,8 75,10 90,5 105,8 120,3'} />
                    </svg>
                  </div>
                ))}
              </div>
              {/* stat pills */}
              <div className="flex gap-3 mb-4">
                {[{ v: '12.5K', l: 'Active' }, { v: '847', l: 'Tracked' }, { v: '99.2%', l: 'Accuracy' }].map(p => (
                  <div key={p.l} className="flex-1 bg-[#2b241c] rounded-xl px-3 py-2.5 text-center">
                    <p className="text-white font-bold text-sm">{p.v}</p>
                    <p className="text-white/40 text-[10px]">{p.l}</p>
                  </div>
                ))}
              </div>
              {/* nominal badge */}
              <div className="flex justify-center">
                <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wider">● SYSTEM NOMINAL</span>
              </div>
            </div>
            </div>

            {/* floating alert top-right */}
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="absolute -top-5 -right-5 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2.5 rounded-2xl shadow-xl border border-red-400/40 z-20">
              <p className="text-xs font-bold">🚨 Outbreak Alert</p>
              <p className="text-[10px] text-white/80">Delhi NCR — Dengue spike</p>
            </motion.div>

            {/* floating update bottom-left */}
            <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} className="absolute -bottom-4 -left-4 bg-emerald-500/90 backdrop-blur-sm text-white px-4 py-2.5 rounded-2xl shadow-xl border border-emerald-400/40 z-20">
              <p className="text-xs font-bold">✅ 2,847 Records Updated</p>
              <p className="text-[10px] text-white/80">Last sync 3 min ago</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════ MARQUEE STATS BAR ═══════════════════ */}
      <div className="bg-[#211c16] py-4 overflow-hidden">
        <div className="marquee-track flex gap-12 whitespace-nowrap text-white/90 text-sm font-medium">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span key={i} className="flex-shrink-0">{item}</span>
          ))}
        </div>
      </div>

      {/* ═══════════════════ ABOUT PLATFORM ═══════════════════ */}
      <section id="about" className="py-28 px-4 bg-background">
        <div className="max-w-6xl mx-auto text-center">
          <SectionReveal>
            <span className="eyebrow bg-emerald-500/10 text-emerald-700 mb-5">About the Platform</span>
            <h2 className="font-syne font-extrabold text-4xl sm:text-5xl text-foreground mb-5">One Platform. Complete Health Intelligence.</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-16">A Government of India initiative to unify disease surveillance, health record management, and outbreak prevention under a single intelligent platform.</p>
          </SectionReveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '🔍', title: 'Early Outbreak Detection', desc: 'AI detects disease spikes before they become epidemics using real-time data from 500+ districts.' },
              { icon: '🔐', title: 'Privacy-First Architecture', desc: 'K-anonymity ensures no individual patient can ever be identified in surveillance datasets.' },
              { icon: '⚡', title: 'Real-Time Intelligence', desc: 'Live data from 500+ districts processed and updated every hour for instant situational awareness.' },
            ].map((c, i) => (
              <SectionReveal key={i} delay={i * 0.15}>
                <div className="bezel-shell h-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5">
                  <div className="bezel-core p-8 text-center shadow-ambient">
                    <span className="text-4xl block mb-4">{c.icon}</span>
                    <h3 className="font-syne font-bold text-xl text-foreground mb-3">{c.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{c.desc}</p>
                  </div>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ KEY FEATURES (dark bento) ═══════════════════ */}
      <section id="features" className="py-28 px-4 bg-[#151109]">
        <div className="max-w-6xl mx-auto">
          <SectionReveal>
            <div className="text-center mb-16">
              <span className="eyebrow bg-emerald-500/15 text-emerald-300 mb-4">Features</span>
              <h2 className="font-syne font-extrabold text-4xl sm:text-5xl text-white">Everything the healthcare system needs</h2>
            </div>
          </SectionReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 grid-flow-dense">
            {/* LARGE — AI Surveillance (spans 2 rows) */}
            <SectionReveal delay={0} className="lg:row-span-2">
              <div className="h-full bezel-shell-dark transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5">
              <div className="bezel-core-dark p-7 flex flex-col h-full">
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold w-fit mb-5">4 ML Models</span>
                <h3 className="font-syne font-bold text-2xl text-white mb-3">AI-Powered Disease Surveillance</h3>
                <p className="text-white/50 mb-6 leading-relaxed">Prophet forecasting, DBSCAN geographic clustering, Isolation Forest anomaly detection, and XGBoost risk scoring — fused into a single decision engine.</p>
                {/* mini chart visual */}
                <div className="mt-auto bg-[#134744] rounded-xl p-4">
                  <div className="flex justify-between text-[10px] text-white/40 mb-2"><span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span></div>
                  <svg viewBox="0 0 200 60" className="w-full h-16">
                    <defs><linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6fae87" stopOpacity="0.4" /><stop offset="100%" stopColor="#6fae87" stopOpacity="0" /></linearGradient></defs>
                    <path d="M0,50 L33,40 L66,45 L100,25 L133,30 L166,15 L200,20 L200,60 L0,60Z" fill="url(#cg1)" />
                    <polyline fill="none" stroke="#6fae87" strokeWidth="2.5" strokeLinecap="round" points="0,50 33,40 66,45 100,25 133,30 166,15 200,20" />
                  </svg>
                </div>
              </div>
              </div>
            </SectionReveal>

            {/* Smart QR */}
            <SectionReveal delay={0.1}>
              <div className="bezel-shell-dark h-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5">
              <div className="bezel-core-dark p-7">
                <h3 className="font-syne font-bold text-xl text-white mb-2">Smart QR Health Cards</h3>
                <p className="text-white/50 text-sm mb-5">JWT-encoded, cryptographically signed QR codes for instant secure patient identification.</p>
                <div className="bg-[#134744] rounded-xl p-5 flex items-center justify-center">
                  <div className="w-20 h-20 bg-white rounded-lg p-1.5">
                    <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-0.5">
                      {Array.from({ length: 25 }).map((_, i) => <div key={i} className={`rounded-[1px] ${[0,1,2,4,5,6,8,10,12,14,16,18,20,22,23,24].includes(i) ? 'bg-[#151109]' : 'bg-gray-200'}`} />)}
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </SectionReveal>

            {/* E-Prescription */}
            <SectionReveal delay={0.15}>
              <div className="bezel-shell-dark h-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5">
              <div className="bezel-core-dark p-7">
                <h3 className="font-syne font-bold text-xl text-white mb-2">E-Prescription System</h3>
                <p className="text-white/50 text-sm mb-5">HMAC-SHA256 secured prescriptions with automated drug interaction checking.</p>
                <div className="bg-[#134744] rounded-xl p-4 space-y-2">
                  {['Tab Paracetamol 500mg', 'Syp Amoxicillin 250mg', 'Cap Omeprazole 20mg'].map((rx, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-white/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{rx}
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </SectionReveal>

            {/* Multi-Role */}
            <SectionReveal delay={0.2}>
              <div className="bezel-shell-dark h-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5">
              <div className="bezel-core-dark p-7">
                <h3 className="font-syne font-bold text-xl text-white mb-4">Multi-Role Access</h3>
                <div className="flex gap-3 flex-wrap">
                  {[{ emoji: '🧑‍⚕️', label: 'Patient' }, { emoji: '👨‍⚕️', label: 'Doctor' }, { emoji: '💊', label: 'Pharmacist' }, { emoji: '🛡️', label: 'Admin' }].map(r => (
                    <span key={r.label} className="px-3 py-2 bg-[#134744] rounded-xl text-xs text-white/70 flex items-center gap-1.5">
                      <span className="text-base">{r.emoji}</span>{r.label}
                    </span>
                  ))}
                </div>
              </div>
              </div>
            </SectionReveal>

            {/* Audit Trail — completes the 2x2 block next to the tall card (no dead grid cell) */}
            <SectionReveal delay={0.22}>
              <div className="bezel-shell-dark h-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5">
              <div className="bezel-core-dark p-7">
                <h3 className="font-syne font-bold text-xl text-white mb-2">Full Audit Trail</h3>
                <p className="text-white/50 text-sm mb-5">Every record access, prescription, and dispense event logged for security and compliance review.</p>
                <div className="bg-[#134744] rounded-xl p-3 space-y-1.5">
                  {['Record accessed · Dr. Rao', 'Prescription dispensed', 'Health card scanned'].map((ev, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-white/50">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />{ev}
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </SectionReveal>

            {/* Environmental Correlation — full width */}
            <SectionReveal delay={0.25} className="lg:col-span-3">
              <div className="bezel-shell-dark transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1">
              <div className="bezel-core-dark p-7">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1">
                    <h3 className="font-syne font-bold text-xl text-white mb-2">Real-time Environmental Correlation</h3>
                    <p className="text-white/50 text-sm">Temperature, Humidity, Rainfall, and AQI correlated with disease outbreaks for predictive intelligence.</p>
                  </div>
                  <div className="flex gap-3">
                    {[{ label: 'Temp', v: 34, color: '#ef4444' }, { label: 'Humidity', v: 72, color: '#3b82f6' }, { label: 'Rainfall', v: 45, color: '#8b5cf6' }, { label: 'AQI', v: 88, color: '#f59e0b' }].map(b => (
                      <div key={b.label} className="text-center">
                        <div className="w-10 bg-[#134744] rounded-full overflow-hidden h-24 flex flex-col justify-end mx-auto mb-1.5">
                          <div className="rounded-full transition-all duration-700" style={{ height: `${b.v}%`, backgroundColor: b.color }} />
                        </div>
                        <p className="text-[10px] text-white/40">{b.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section className="py-28 px-4 bg-secondary">
        <div className="max-w-6xl mx-auto">
          <SectionReveal>
            <h2 className="font-syne font-extrabold text-4xl sm:text-5xl text-foreground text-center mb-20">From Registration to Outbreak Prevention</h2>
          </SectionReveal>
          <div className="grid md:grid-cols-4 gap-0 relative">
            {/* connecting line */}
            <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400" />
            {[
              { step: '1', title: 'Patient Registers', desc: 'Secure registration with QR health card generation for instant identification.' },
              { step: '2', title: 'Doctor Consults', desc: 'Time-limited QR access, e-prescriptions with drug safety checks.' },
              { step: '3', title: 'Data Aggregates', desc: 'K-anonymous data flows into the surveillance pipeline automatically.' },
              { step: '4', title: 'AI Detects Outbreaks', desc: 'ML models forecast, cluster, and alert health authorities in real-time.' },
            ].map((s, i) => (
              <SectionReveal key={i} delay={i * 0.15}>
                <div className="flex flex-col items-center text-center px-4 relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#6fae87] to-[#4a8a6f] flex items-center justify-center text-white font-syne font-extrabold text-lg shadow-lg shadow-emerald-500/30 relative z-10 mb-5">
                    {s.step}
                  </div>
                  <h3 className="font-syne font-bold text-lg text-foreground mb-2">{s.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ ML INTELLIGENCE (GSAP scroll-stack) ═══════════════════ */}
      <section id="surveillance" className="py-28 md:py-40 px-4 bg-[#151109] overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <MLModelStack />
        </div>
      </section>

      {/* ═══════════════════ ROLE BASED ACCESS ═══════════════════ */}
      <section className="py-28 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <SectionReveal>
            <h2 className="font-syne font-extrabold text-4xl sm:text-5xl text-foreground text-center mb-16">Built for Every Healthcare Stakeholder</h2>
          </SectionReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { role: 'Patient', color: '#5FB3AC', features: ['View health records', 'Family profiles', 'Medication reminders'], link: '/login' },
              { role: 'Doctor', color: '#4DA6A0', features: ['QR patient lookup', 'E-prescriptions', 'Drug interaction alerts'], link: '/login' },
              { role: 'Pharmacist', color: '#3D9A95', features: ['Prescription validation', 'Inventory management', 'Dispensing workflow'], link: '/login' },
              { role: 'Admin', color: '#79C2BD', features: ['Surveillance dashboard', 'ML alerts', 'Regional analytics'], link: '/login' },
            ].map((r, i) => (
              <SectionReveal key={i} delay={i * 0.1}>
                <div className="bezel-shell h-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5">
                  <div className="bezel-core overflow-hidden shadow-ambient flex flex-col h-full">
                    <div className="h-1.5" style={{ backgroundColor: r.color }} />
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="font-syne font-bold text-xl text-foreground mb-4">{r.role}</h3>
                      <ul className="space-y-2.5 flex-1 mb-6">
                        {r.features.map(f => (
                          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />{f}
                          </li>
                        ))}
                      </ul>
                      <Link href={r.link}>
                        <button className="magnetic-btn active:scale-[0.98] w-full py-2.5 rounded-full text-sm font-semibold border-2 hover:text-white transition-colors" style={{ borderColor: r.color, color: r.color }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = r.color; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = r.color; }}>
                          Login as {r.role}
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ SECURITY ═══════════════════ */}
      <section className="py-28 px-4 bg-gradient-to-b from-[#211c16] to-[#151109]">
        <div className="max-w-5xl mx-auto text-center">
          <SectionReveal>
            <h2 className="font-syne font-extrabold text-4xl sm:text-5xl text-white mb-16">Enterprise-Grade Security</h2>
          </SectionReveal>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: '🔒', label: 'HIPAA Ready' },
              { icon: '📋', label: 'ICD-10 Coded' },
              { icon: '🛡️', label: 'K-Anonymity (k≥5)' },
              { icon: '🔐', label: 'JWT + HMAC-SHA256' },
              { icon: '📱', label: '2FA Support' },
              { icon: '✅', label: 'Full Audit Trail' },
            ].map((s, i) => (
              <SectionReveal key={i} delay={i * 0.08}>
                <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-6 hover:bg-white/15 transition-all">
                  <span className="text-3xl block mb-3">{s.icon}</span>
                  <p className="text-white font-semibold text-sm">{s.label}</p>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer id="contact" className="bg-[#151109] border-t border-emerald-500/10 pt-16 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-5 gap-12 mb-12">
            {/* logo col */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <LogoIcon />
                <div className="leading-none">
                  <span className="font-syne font-extrabold text-lg text-white block">ArogyaTrack</span>
                  <span className="text-[9px] font-semibold tracking-[0.2em] text-emerald-400 uppercase block mt-0.5">Govt. of India</span>
                </div>
              </div>
              <p className="text-white/40 text-sm leading-relaxed max-w-xs">Enterprise-grade public health surveillance and healthcare management platform for the nation.</p>
            </div>
            {/* link cols */}
            {[
              { heading: 'Platform', links: ['Features', 'Surveillance', 'Security', 'API Docs'] },
              { heading: 'For Doctors', links: ['E-Prescriptions', 'Patient Lookup', 'Drug Alerts', 'CDSS'] },
              { heading: 'Legal', links: ['Privacy Policy', 'Terms of Use', 'Data Policy', 'Grievance'] },
            ].map(col => (
              <div key={col.heading}>
                <p className="text-white font-semibold text-sm mb-4">{col.heading}</p>
                <ul className="space-y-2.5">
                  {col.links.map(l => (
                    <li key={l}><Link href="#" className="text-white/40 text-sm hover:text-emerald-400 transition-colors">{l}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {/* bottom bar */}
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/30 text-sm text-center md:text-left">© 2026 ArogyaTrack — Government of India · Ministry of Health &amp; Family Welfare</p>
            <div className="flex gap-4">
              {['M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z',
                'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z',
                'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 2a2 2 0 100 4 2 2 0 000-4z',
              ].map((d, i) => (
                <a key={i} href="#" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-emerald-500/30 transition-colors">
                  <svg className="w-4 h-4 text-white/50" fill="currentColor" viewBox="0 0 24 24"><path d={d} /></svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
