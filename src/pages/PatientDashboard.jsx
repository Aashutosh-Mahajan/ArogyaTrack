import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts';

/* ─── DATA ─── */
const bpData = [
  { day:'Mon', systolic:128, diastolic:82 },
  { day:'Tue', systolic:132, diastolic:85 },
  { day:'Wed', systolic:126, diastolic:80 },
  { day:'Thu', systolic:134, diastolic:84 },
  { day:'Fri', systolic:130, diastolic:83 },
  { day:'Sat', systolic:127, diastolic:81 },
  { day:'Sun', systolic:124, diastolic:79 },
];
const sugarData = [
  { day:'Mon', value:132 },
  { day:'Tue', value:128 },
  { day:'Wed', value:126 },
  { day:'Thu', value:130 },
  { day:'Fri', value:122 },
  { day:'Sat', value:118 },
  { day:'Sun', value:115 },
];

const navItems = [
  { icon:'▣', label:'Dashboard', active:true },
  { icon:'👤', label:'Patient Card' },
  { icon:'◎', label:'My Profile' },
  { icon:'📋', label:'Medical Records' },
  { icon:'🩺', label:'My Conditions' },
  { icon:'💊', label:'Prescriptions' },
  { icon:'🧪', label:'Medicines' },
  { icon:'✓', label:'Adherence' },
  { icon:'🔔', label:'Alerts', badge:3 },
  { icon:'⬇', label:'Downloads' },
];

const statCards = [
  { icon:'📁', value:12, label:'Medical Records',   trend:'+9%',  up:true,    accent:'#1F6F6A' },
  { icon:'💊', value:2,  label:'Active Prescriptions', trend:'+8%', up:true,  accent:'#7c3aed' },
  { icon:'🧪', value:12, label:'Pending Lab Reports', trend:'+1%', up:true,   accent:'#d97706' },
  { icon:'❤️', value:'84%', label:'Adherence Rate',  trend:'-12%', up:false,  accent:'#ef4444' },
  { icon:'⚠️', value:0,  label:'Health Alerts',      trend:'—',    up:null,   accent:'#1F6F6A' },
  { icon:'⬇️', value:0,  label:'Report Downloads',   trend:'—',    up:null,   accent:'#185E59' },
];

const records = [
  { date:'10 Mar 2026', type:'Lab Report',      doctor:'Dr. Mehra',   status:'Completed', statusColor:'#1F6F6A' },
  { date:'04 Mar 2026', type:'Prescription',     doctor:'Dr. Kapoor',  status:'Active',    statusColor:'#1F6F6A' },
  { date:'28 Feb 2026', type:'Consultation',     doctor:'Dr. Verma',   status:'Follow-up', statusColor:'#d97706' },
  { date:'15 Feb 2026', type:'Blood Test',       doctor:'Dr. Singh',   status:'Completed', statusColor:'#1F6F6A' },
  { date:'02 Feb 2026', type:'X-Ray Report',     doctor:'Dr. Reddy',   status:'Archived',  statusColor:'#6B7C7C' },
];

/* ─── ANIMATED COUNTER HOOK ─── */
function useCounter(target, duration = 1400) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number') { setCount(target); return; }
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(id); }
      else setCount(start);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return count;
}

/* ─── HEALTH SCORE RING ─── */
const HealthScoreRing = () => {
  const score = useCounter(100, 1600);
  const r = 46, c = 2 * Math.PI * r; // 289.03
  const offset = c - (c * score) / 100;
  return (
    <div style={{ position:'relative', width:128, height:128, flexShrink:0 }}>
      <svg width="128" height="128" style={{ transform:'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1F6F6A" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="url(#ringGrad)" strokeWidth="9"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset 1.6s cubic-bezier(0.34,1.56,0.64,1)' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:30, fontWeight:800, color:'#FFF', lineHeight:1, fontFamily:"'Syne',sans-serif" }}>{score}</span>
        <span style={{ fontSize:8, color:'rgba(255,255,255,0.5)', letterSpacing:'0.15em', marginTop:3 }}>HEALTH SCORE</span>
      </div>
    </div>
  );
};

/* ─── ADHERENCE DONUT ─── */
const AdherenceDonut = () => {
  const r = 31, c = 2 * Math.PI * r; // 194.78
  const pct = 84;
  return (
    <div style={{ position:'relative', width:82, height:82, flexShrink:0 }}>
      <svg width="82" height="82" style={{ transform:'rotate(-90deg)' }}>
        <circle cx="41" cy="41" r={r} fill="none" stroke="#D9E5E3" strokeWidth="8" />
        <circle cx="41" cy="41" r={r} fill="none" stroke="#1F6F6A" strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct/100)} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset 1.2s ease' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:'#2F3A3A' }}>84%</span>
      </div>
    </div>
  );
};

/* ─── STAT CARD ─── */
const StatCard = ({ icon, value, label, trend, up, accent }) => {
  const displayVal = useCounter(typeof value === 'number' ? value : 0);
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-accent" style={{ background:`linear-gradient(90deg, ${accent}, ${accent}66)` }} />
      <span style={{ fontSize:18, marginBottom:10, display:'block' }}>{icon}</span>
      <span style={{ fontSize:24, fontWeight:800, color:'#2F3A3A', lineHeight:1, marginBottom:4, fontFamily:"'Syne',sans-serif", display:'block' }}>
        {typeof value === 'number' ? displayVal : value}
      </span>
      <span style={{ fontSize:10, color:'#6B7C7C', fontWeight:500, marginBottom:6, lineHeight:1.3, display:'block' }}>{label}</span>
      <span style={{ fontSize:10, fontWeight:600, color: up === true ? '#1F6F6A' : up === false ? '#ef4444' : '#6B7C7C' }}>
        {trend}{' '}<span style={{ color:'#6B7C7C', fontWeight:400 }}>vs last month</span>
      </span>
    </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ═══════════════════════════════════════════ */
const PatientDashboard = () => {
  const [activeTab, setActiveTab] = useState('bp');

  return (
    <div className="dash-layout">
      {/* ══════════ SIDEBAR ══════════ */}
      <aside className="dash-sidebar">
        {/* decorations */}
        <div className="dash-sb-glow-tl" />
        <div className="dash-sb-glow-br" />
        <div className="dash-sb-dots" />

        {/* logo */}
        <div className="dash-sb-logo">
          <div className="dash-sb-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h3l3-9 4 18 3-9h5" /></svg>
          </div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", color:'#FFF', fontSize:15, fontWeight:700, letterSpacing:'-0.02em' }}>ArogyaTrack</div>
            <div style={{ color:'#4ade80', fontSize:8.5, letterSpacing:'0.14em', fontWeight:600 }}>GOVT. OF INDIA</div>
          </div>
        </div>

        {/* user */}
        <div className="dash-sb-user">
          <div className="dash-sb-avatar">AP</div>
          <div>
            <div style={{ color:'#FFF', fontWeight:600, fontSize:13 }}>Aditya Patra</div>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span className="dash-pulse-dot" />
              <span style={{ color:'#4ade80', opacity:0.8, fontSize:10 }}>Patient Access</span>
            </div>
          </div>
        </div>

        {/* nav */}
        <nav className="dash-sb-nav">
          {navItems.map((n, i) => (
            <div key={i} className={`dash-sb-item ${n.active ? 'nav-active' : ''}`}>
              <span style={{ fontSize:14, opacity: n.active ? 1 : 0.4, width:18, textAlign:'center' }}>{n.icon}</span>
              <span className="dash-sb-label" style={{ fontWeight: n.active ? 600 : 400, color: n.active ? '#FFF' : 'rgba(255,255,255,0.4)' }}>{n.label}</span>
              {n.badge && <span className="dash-sb-badge">{n.badge}</span>}
            </div>
          ))}
        </nav>

        {/* logout */}
        <div className="dash-sb-logout">
          <div className="dash-sb-item">
            <span style={{ fontSize:14, opacity:0.3, width:18, textAlign:'center' }}>↩</span>
            <span className="dash-sb-label" style={{ color:'rgba(255,255,255,0.3)' }}>Logout</span>
          </div>
        </div>
      </aside>

      {/* ══════════ RIGHT PANEL ══════════ */}
      <div className="dash-right">
        {/* ── TOPBAR ── */}
        <header className="dash-topbar">
          <div className="dash-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7C7C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search patients, records, conditions…" />
          </div>
          <select className="dash-lang">
            <option>English</option>
            <option>Hindi</option>
          </select>
          <div className="dash-bell">
            🔔
            <span className="dash-bell-dot" />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:700, fontSize:12.5, color:'#2F3A3A' }}>Aditya Patra</div>
              <div style={{ fontSize:10, color:'#6B7C7C' }}>patient</div>
            </div>
            <div className="dash-topbar-avatar">AP</div>
          </div>
        </header>

        {/* ── SCROLLABLE CONTENT ── */}
        <main className="dash-main">

          {/* ═══ HERO BANNER ═══ */}
          <section className="dash-hero f1">
            <div className="dash-hero-dots" />
            <div className="dash-hero-ecg">
              <svg viewBox="0 0 800 90" preserveAspectRatio="none" style={{ width:'100%', height:'100%' }}>
                <path d="M0,55 L70,55 L85,18 L100,92 L115,18 L130,55 L280,55 L295,32 L310,78 L325,32 L340,55 L500,55 L515,22 L530,88 L545,22 L560,55 L800,55"
                  stroke="#4ade80" strokeWidth="2" fill="none" />
              </svg>
            </div>
            <div className="dash-hero-orb" />

            <div style={{ position:'relative', flex:1 }}>
              <div className="dash-hero-pill">
                <span className="dash-pulse-dot" />
                National Health ID: 48e53f17-b68
              </div>
              <h1 className="dash-hero-heading">Welcome back,<br />Aditya</h1>
              <p className="dash-hero-sub">
                Health surveillance active in <strong style={{ color:'#4ade80' }}>real-time</strong>.
                System status: <strong style={{ color:'#4ade80' }}>Nominal</strong>
              </p>
            </div>

            <div style={{ position:'relative', display:'flex', alignItems:'center', gap:36 }}>
              <HealthScoreRing />
              <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
                {/* risk */}
                <div>
                  <div className="dash-hero-stat-label">RISK LEVEL</div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80', display:'inline-block' }} />
                    <span style={{ color:'#FFF', fontWeight:700, fontSize:15 }}>Low</span>
                  </div>
                </div>
                {/* adherence */}
                <div>
                  <div className="dash-hero-stat-label">ADHERENCE</div>
                  <span style={{ color:'#FFF', fontWeight:700, fontSize:15 }}>84%</span>
                  <div style={{ width:64, height:3, background:'rgba(255,255,255,0.1)', borderRadius:99, marginTop:5 }}>
                    <div style={{ width:'84%', height:'100%', background:'linear-gradient(90deg,#1F6F6A,#4ade80)', borderRadius:99 }} />
                  </div>
                </div>
                {/* conditions */}
                <div>
                  <div className="dash-hero-stat-label">CONDITIONS</div>
                  <span style={{ color:'#FFF', fontWeight:700, fontSize:15 }}>3 Active</span>
                </div>
              </div>
            </div>
          </section>

          {/* ═══ STAT CARDS ═══ */}
          <section className="dash-stats f2">
            {statCards.map((c, i) => <StatCard key={i} {...c} />)}
          </section>

          {/* ═══ CHARTS ROW ═══ */}
          <section className="dash-charts f3">
            {/* Vitals Trend */}
            <div className="dash-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div>
                  <div style={{ fontWeight:700, color:'#2F3A3A', fontSize:14 }}>Vitals Trend</div>
                  <div style={{ color:'#6B7C7C', fontSize:11, marginTop:1 }}>Last 7 days</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className={`dash-tab ${activeTab === 'bp' ? 'active' : ''}`} onClick={() => setActiveTab('bp')}>Blood Pressure</button>
                  <button className={`dash-tab ${activeTab === 'sugar' ? 'active' : ''}`} onClick={() => setActiveTab('sugar')}>Blood Sugar</button>
                </div>
              </div>

              {activeTab === 'bp' && (
                <>
                  <div style={{ display:'flex', gap:16, marginBottom:12 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6B7C7C' }}>
                      <span style={{ width:10, height:3, background:'#1F6F6A', borderRadius:2, display:'inline-block' }} /> Systolic
                    </span>
                    <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6B7C7C' }}>
                      <span style={{ width:10, height:3, background:'#4ade80', borderRadius:2, display:'inline-block' }} /> Diastolic
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={165}>
                    <AreaChart data={bpData}>
                      <defs>
                        <linearGradient id="bpGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1F6F6A" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#1F6F6A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F2" />
                      <XAxis dataKey="day" tick={{ fontSize:10, fill:'#6B7C7C' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[60,150]} tick={{ fontSize:10, fill:'#6B7C7C' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize:11, borderRadius:10, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }} />
                      <Area type="monotone" dataKey="systolic" stroke="#1F6F6A" strokeWidth={2.5} fill="url(#bpGrad)" dot={{ fill:'#1F6F6A', r:3 }} />
                      <Line type="monotone" dataKey="diastolic" stroke="#4ade80" strokeWidth={2} dot={{ fill:'#4ade80', r:3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              )}

              {activeTab === 'sugar' && (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ background:'#EEF3F2', color:'#1F6F6A', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:999 }}>↓ Improving trend</span>
                    <span style={{ fontSize:11, color:'#6B7C7C' }}>mg/dL</span>
                  </div>
                  <ResponsiveContainer width="100%" height={165}>
                    <AreaChart data={sugarData}>
                      <defs>
                        <linearGradient id="sgGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1F6F6A" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#1F6F6A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F2" />
                      <XAxis dataKey="day" tick={{ fontSize:10, fill:'#6B7C7C' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[100,145]} tick={{ fontSize:10, fill:'#6B7C7C' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize:11, borderRadius:10, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }} />
                      <Area type="monotone" dataKey="value" stroke="#185E59" strokeWidth={2.5} fill="url(#sgGrad)" dot={{ fill:'#185E59', r:3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>

            {/* Right column — two stacked cards */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Adherence Ring */}
              <div className="dash-card" style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:'#2F3A3A', fontSize:13, marginBottom:1 }}>Medication Adherence</div>
                <div style={{ color:'#6B7C7C', fontSize:11, marginBottom:14 }}>This month</div>
                <div style={{ display:'flex', alignItems:'center', gap:18 }}>
                  <AdherenceDonut />
                  <div>
                    <div style={{ fontSize:11, color:'#6B7C7C', marginBottom:10 }}>Medicines on time</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:'#1F6F6A', display:'inline-block' }} />
                      <span style={{ fontSize:11.5, fontWeight:600, color:'#2F3A3A' }}>Taken: 21 days</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:'#D9E5E3', display:'inline-block' }} />
                      <span style={{ fontSize:11.5, color:'#6B7C7C' }}>Missed: 4 days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Conditions */}
              <div className="dash-conditions-card">
                <div className="dash-conditions-glow" />
                <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:'0.12em', marginBottom:12 }}>ACTIVE CONDITIONS</div>
                {[
                  { name:'Type 2 Diabetes', color:'#f59e0b' },
                  { name:'Hypertension', color:'#ef4444' },
                  { name:'Dyslipidemia', color:'#4ade80' },
                ].map((c, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom: i < 2 ? 10 : 0 }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:c.color, boxShadow:`0 0 6px ${c.color}`, display:'inline-block', flexShrink:0 }} />
                    <span style={{ color:'#FFF', fontSize:12.5, fontWeight:500 }}>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ RECENT MEDICAL RECORDS ═══ */}
          <section className="f4">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F6F6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h3l3-9 4 18 3-9h5" /></svg>
                  <span style={{ fontWeight:700, color:'#2F3A3A', fontSize:15 }}>Recent Medical Records</span>
                </div>
                <div style={{ color:'#6B7C7C', fontSize:11, marginTop:3 }}>Latest medical history and checkups</div>
              </div>
              <button className="dash-view-all">View All →</button>
            </div>

            <div className="dash-card" style={{ padding:0, overflow:'hidden' }}>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Doctor</th>
                    <th>Status</th>
                    <th style={{ textAlign:'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight:600, color:'#2F3A3A' }}>{r.date}</td>
                      <td>{r.type}</td>
                      <td>{r.doctor}</td>
                      <td>
                        <span className="dash-status-pill" style={{ background:`${r.statusColor}14`, color:r.statusColor, borderColor:`${r.statusColor}30` }}>{r.status}</span>
                      </td>
                      <td style={{ textAlign:'right' }}>
                        <button className="dash-download-btn">⬇ Download</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
};

export default PatientDashboard;
