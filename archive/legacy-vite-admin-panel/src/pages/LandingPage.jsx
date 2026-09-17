import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  useEffect(() => {
    // 1. Navbar Scroll Effect
    const navbar = document.getElementById('navbar');
    const handleScroll = () => {
        if (window.scrollY > 50) {
            navbar?.classList.add('scrolled');
        } else {
            navbar?.classList.remove('scrolled');
        }
    };
    window.addEventListener('scroll', handleScroll);

    // 2. Intersection Observer for Fade-Up Animations
    const fadeElements = document.querySelectorAll('.fade-up-element');
    const fadeObserverOptions = { root: null, rootMargin: '0px', threshold: 0.1 };

    const fadeObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                if (entry.target.closest('.how-it-works')) {
                    document.querySelector('.steps-flow')?.classList.add('active');
                }
                observer.unobserve(entry.target);
            }
        });
    }, fadeObserverOptions);
    fadeElements.forEach(el => fadeObserver.observe(el));

    // 3. Staggered Hero Heading Animation
    const heroHeading = document.querySelector('.hero-heading');
    if (heroHeading && !heroHeading.hasAttribute('data-wrapped')) {
        heroHeading.setAttribute('data-wrapped', 'true');
        wrapWordsWithSpans(heroHeading);
        const words = heroHeading.querySelectorAll('.word-anim');
        words.forEach((word, index) => {
            word.style.animationDelay = `${index * 0.15}s`;
        });
    }

    function wrapWordsWithSpans(element) {
        const nodes = Array.from(element.childNodes);
        element.innerHTML = '';
        nodes.forEach(node => {
            if (node.nodeType === 3) { // TEXT_NODE
                const words = node.textContent.trim().split(/\s+/);
                if (words.length > 0 && words[0] !== "") {
                    words.forEach((w, i) => {
                        const span = document.createElement('span');
                        span.className = 'word-anim';
                        span.textContent = w + (i < words.length - 1 ? ' ' : '');
                        element.appendChild(span);
                        if (i < words.length - 1) element.appendChild(document.createTextNode(' '));
                    });
                }
            } else if (node.nodeType === 1 && node.tagName !== 'BR') { // ELEMENT_NODE
                const clone = node.cloneNode(true);
                clone.style.display = 'inline-block';
                clone.classList.add('word-anim');
                element.appendChild(clone);
            } else if (node.tagName === 'BR') {
                element.appendChild(node.cloneNode());
            }
        });
    }

    // 4. Stat Counter Animation
    const stats = document.querySelectorAll('.stat-number');
    let hasAnimatedStats = false;
    
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const isFloat = end.toString().includes('.');
            const currentVal = progress * (end - start) + start;
            obj.innerHTML = isFloat ? currentVal.toFixed(1) : Math.floor(currentVal);
            if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }

    const statsSection = document.querySelector('.hero-stats');
    if (statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !hasAnimatedStats) {
                    hasAnimatedStats = true;
                    stats.forEach(stat => {
                        const target = parseFloat(stat.getAttribute('data-target'));
                        animateValue(stat, 0, target, 2000);
                    });
                }
            });
        }, { threshold: 0.5 });
        statsObserver.observe(statsSection);
    }

    // Marquee copy
    const marqueeContent = document.querySelector('.marquee-content');
    if (marqueeContent && marqueeContent.children.length <= 12) {
        const items = Array.from(marqueeContent.children);
        items.forEach(item => {
            const clone = item.cloneNode(true);
            marqueeContent.appendChild(clone);
        });
    }

    return () => {
        window.removeEventListener('scroll', handleScroll);
        fadeObserver.disconnect();
    };
  }, []);

  return (
    <div className="landing-page-wrap">
      {/* Navbar */}
      <nav className="navbar" id="navbar">
        <div className="nav-container container">
            <div className="nav-left">
                <div className="logo">
                    <div className="logo-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                        </svg>
                    </div>
                    <div className="logo-text">
                        <span className="logo-title">ArogyaTrack</span>
                        <span className="logo-badge">GOVT. OF INDIA</span>
                    </div>
                </div>
            </div>
            <div className="nav-links">
                <a href="#home">Home</a>
                <a href="#features">Features</a>
                <a href="#surveillance">Surveillance</a>
                <a href="#about">About</a>
                <a href="#contact">Contact</a>
            </div>
            <div className="nav-actions">
                <Link to="/role-selector" className="btn btn-ghost">Login</Link>
                <Link to="/role-selector" className="btn btn-primary">Get Started</Link>
            </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero" id="home">
        <div className="hero-bg-overlay"></div>
        <div className="hero-glow"></div>
        <div className="container hero-container">
            <div className="hero-content fade-up-element">
                <div className="live-badge">
                    <span className="pulsing-dot"></span>
                    Live Disease Surveillance Active
                </div>
                <h1 className="hero-heading">
                    Protecting <span className="text-gradient">India's</span><br/>
                    Public Health<br/>
                    Intelligence
                </h1>
                <p className="hero-subtitle">
                    An enterprise-grade disease surveillance platform combining AI-powered outbreak detection, digital health records, and real-time public health intelligence — protecting 1.4 billion people.
                </p>
                <div className="hero-ctas">
                    <Link to="/role-selector" className="btn btn-primary btn-large">Get Started &rarr;</Link>
                    <Link to="/role-selector" className="btn btn-outline-white btn-large">View Live Dashboard</Link>
                </div>
                <div className="hero-stats">
                    <div className="stat-item">
                        <span className="stat-number" data-target="1.4">0</span><span className="stat-suffix">B+</span>
                        <span className="stat-label">Citizens Protected</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-number" data-target="500">0</span><span className="stat-suffix">+</span>
                        <span className="stat-label">Districts Monitored</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-number" data-target="99.9">0</span><span className="stat-suffix">%</span>
                        <span className="stat-label">Uptime</span>
                    </div>
                </div>
            </div>
            <div className="hero-visual fade-up-element delay-200">
                <div className="floating-alert red-alert float-anim">
                    <i className="ph-fill ph-warning-circle"></i> Outbreak Alert — Delhi NCR
                </div>
                <div className="dashboard-mockup float-anim-delayed">
                    <div className="mockup-topbar">
                        <div className="dots">
                            <span></span><span></span><span></span>
                        </div>
                        <div className="system-badge">SYSTEM NOMINAL</div>
                    </div>
                    <div className="mockup-body">
                        <div className="health-score">
                            <svg viewBox="0 0 36 36" className="circular-chart green">
                                <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="circle" strokeDasharray="94, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <div className="score-text">94</div>
                        </div>
                        <div className="sparklines">
                            <div className="sparkline-item">
                                <div className="spark-label">Infection Rate</div>
                                <div className="spark-chart up"></div>
                            </div>
                            <div className="sparkline-item">
                                <div className="spark-label">Recovery Rate</div>
                                <div className="spark-chart down"></div>
                            </div>
                        </div>
                        <div className="mini-stats">
                            <div className="mini-pill">AI Models: 4/4</div>
                            <div className="mini-pill">Nodes: 50A</div>
                            <div className="mini-pill">Sync: Live</div>
                        </div>
                    </div>
                </div>
                <div className="floating-alert green-alert float-anim-slow">
                    <i className="ph-fill ph-check-circle"></i> 2,847 Records Updated
                </div>
            </div>
        </div>
        <div className="ecg-line"></div>
      </section>

      {/* Marquee */}
      <div className="marquee-section">
        <div className="marquee-content" id="marquee">
            <span className="marquee-item">🏥 Active Hospitals: 2,847</span>
            <span className="marquee-item">👨‍⚕️ Verified Doctors: 12,500+</span>
            <span className="marquee-item">💊 Prescriptions Issued: 8.2M</span>
            <span className="marquee-item">🦠 Diseases Tracked: 847</span>
            <span className="marquee-item">📊 Daily Reports: 45,000+</span>
            <span className="marquee-item">⚡ Avg Response Time: 2.3 hrs</span>
            <span className="marquee-item">🏥 Active Hospitals: 2,847</span>
            <span className="marquee-item">👨‍⚕️ Verified Doctors: 12,500+</span>
            <span className="marquee-item">💊 Prescriptions Issued: 8.2M</span>
            <span className="marquee-item">🦠 Diseases Tracked: 847</span>
            <span className="marquee-item">📊 Daily Reports: 45,000+</span>
            <span className="marquee-item">⚡ Avg Response Time: 2.3 hrs</span>
        </div>
      </div>

      {/* About */}
      <section className="about-section" id="about">
        <div className="container fade-up-element">
            <div className="section-header">
                <span className="section-label">ABOUT THE PLATFORM</span>
                <h2 className="section-heading">One Platform. Complete Health Intelligence.</h2>
                <p className="section-subtitle">A modern Government of India initiative to digitize health records and proactively prevent disease outbreaks across the nation.</p>
            </div>
            <div className="features-3col">
                <div className="feature-card">
                    <div className="icon-wrapper"><i className="ph-fill ph-magnifying-glass"></i></div>
                    <h3>Early Outbreak Detection</h3>
                    <p>AI detects disease spikes before they become epidemics.</p>
                </div>
                <div className="feature-card">
                    <div className="icon-wrapper"><i className="ph-fill ph-lock-key"></i></div>
                    <h3>Privacy-First Architecture</h3>
                    <p>K-anonymity ensures no patient can ever be identified.</p>
                </div>
                <div className="feature-card">
                    <div className="icon-wrapper"><i className="ph-fill ph-lightning"></i></div>
                    <h3>Real-Time Intelligence</h3>
                    <p>Live data from 500+ districts updated every hour.</p>
                </div>
            </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="bento-section" id="features">
        <div className="container fade-up-element">
            <div className="section-header align-left">
                <span className="section-label">FEATURES</span>
                <h2 className="section-heading text-white">Everything the healthcare system needs</h2>
            </div>
            <div className="bento-grid">
                <div className="bento-card bento-large">
                    <div className="bento-content">
                        <span className="bento-badge">4 ML Models</span>
                        <h3>AI-Powered Disease Surveillance</h3>
                        <p>Prophet forecasting + DBSCAN clustering dynamically maps spreading patterns.</p>
                    </div>
                    <div className="bento-visual">
                        <div className="abstract-chart">
                            <div className="bar h-1"></div>
                            <div className="bar h-3"></div>
                            <div className="bar h-2"></div>
                            <div className="bar h-5 highlight"></div>
                            <div className="bar h-4"></div>
                        </div>
                    </div>
                </div>
                <div className="bento-card bento-medium top-right">
                    <div className="bento-content">
                        <h3>Smart QR Health Cards</h3>
                        <p>JWT-encoded, cryptographically signed universal IDs.</p>
                    </div>
                    <div className="bento-visual qr-visual">
                        <i className="ph ph-qr-code"></i>
                    </div>
                </div>
                <div className="bento-card bento-medium mid-right">
                    <div className="bento-content">
                        <h3>E-Prescription System</h3>
                        <p>HMAC-SHA256 secured, with automated drug interaction checks.</p>
                    </div>
                    <div className="bento-visual rx-visual">
                        <i className="ph ph-prescription"></i>
                    </div>
                </div>
                <div className="bento-card bento-small bottom-right">
                    <h3>Multi-Role Access</h3>
                    <div className="role-icons">
                        <i className="ph-fill ph-user" title="Patient"></i>
                        <i className="ph-fill ph-stethoscope" title="Doctor"></i>
                        <i className="ph-fill ph-pill" title="Pharmacist"></i>
                        <i className="ph-fill ph-shield-check" title="Admin"></i>
                    </div>
                </div>
                <div className="bento-card bento-wide fade-up-element">
                    <div className="bento-content-wide">
                        <div className="text-content">
                            <h3>Real-time Environmental Correlation</h3>
                            <p>Correlates Temperature, Humidity, Rainfall, and AQI with localized disease risks.</p>
                        </div>
                        <div className="visual-content env-chart">
                            <div className="env-item"><span className="label">AQI</span><div className="track"><div className="fill" style={{width:"70%", background: "#fbbf24"}}></div></div></div>
                            <div className="env-item"><span className="label">TEMP</span><div className="track"><div className="fill" style={{width:"85%", background: "#ef4444"}}></div></div></div>
                            <div className="env-item"><span className="label">RISK</span><div className="track"><div className="fill" style={{width:"80%", background: "#15803d"}}></div></div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works" id="surveillance-flow">
        <div className="container fade-up-element">
            <h2 className="section-heading centered">From Registration to Outbreak Prevention</h2>
            <div className="steps-flow">
                <div className="connecting-line"></div>
                <div className="step-card fade-up-element delay-100">
                    <div className="step-number">1</div>
                    <div className="step-icon"><i className="ph-fill ph-user-plus"></i></div>
                    <h3>Patient Registers</h3>
                    <p>Secure registration with QR health card generation.</p>
                </div>
                <div className="step-arrow"><i className="ph-bold ph-arrow-right"></i></div>
                <div className="step-card fade-up-element delay-200">
                    <div className="step-number">2</div>
                    <div className="step-icon"><i className="ph-fill ph-stethoscope"></i></div>
                    <h3>Doctor Consults</h3>
                    <p>Time-limited QR access, e-prescriptions with drug safety checks.</p>
                </div>
                <div className="step-arrow"><i className="ph-bold ph-arrow-right"></i></div>
                <div className="step-card fade-up-element delay-300">
                    <div className="step-number">3</div>
                    <div className="step-icon"><i className="ph-fill ph-database"></i></div>
                    <h3>Data Aggregates</h3>
                    <p>K-anonymous data flows into surveillance pipeline.</p>
                </div>
                <div className="step-arrow"><i className="ph-bold ph-arrow-right"></i></div>
                <div className="step-card fade-up-element delay-400">
                    <div className="step-number">4</div>
                    <div className="step-icon"><i className="ph-fill ph-brain"></i></div>
                    <h3>AI Detects Outbreaks</h3>
                    <p>ML models forecast, cluster and alert health authorities in real-time.</p>
                </div>
            </div>
        </div>
      </section>

      {/* ML Intelligence */}
      <section className="ml-section">
        <div className="container fade-up-element">
            <h2 className="section-heading text-white centered">Powered by 4 AI Models</h2>
            <div className="ml-grid">
                <div className="ml-card accent-green">
                    <div className="ml-icon">📈</div>
                    <h3>Prophet Forecasting</h3>
                    <p>7, 14, 30 day forecasts, 95% confidence intervals.</p>
                </div>
                <div className="ml-card accent-mint">
                    <div className="ml-icon">🗺️</div>
                    <h3>DBSCAN Clustering</h3>
                    <p>Geographic hotspot detection, 50km radius tracking.</p>
                </div>
                <div className="ml-card accent-cyan">
                    <div className="ml-icon">🔍</div>
                    <h3>Isolation Forest</h3>
                    <p>Anomaly detection, flags unusual health data patterns.</p>
                </div>
                <div className="ml-card accent-sage">
                    <div className="ml-icon">⚡</div>
                    <h3>XGBoost Risk Scoring</h3>
                    <p>20+ features, environmental + demographic combination.</p>
                </div>
            </div>
            <div className="fusion-engine fade-up-element">
                <p>Decision Fusion Engine combines all 4 models</p>
                <div className="underline-glow"></div>
            </div>
        </div>
      </section>

      {/* Role Based Access Preview */}
      <section className="roles-section">
        <div className="container fade-up-element">
            <h2 className="section-heading centered">Built for Every Healthcare Stakeholder</h2>
            <div className="roles-grid">
                <div className="role-card border-green">
                    <div className="role-header">
                        <i className="ph-fill ph-user-circle"></i>
                        <h3>Patient</h3>
                    </div>
                    <ul className="role-features">
                        <li>View health records</li>
                        <li>Family profiles</li>
                        <li>Medication reminders</li>
                    </ul>
                    <Link to="/role-selector" className="btn btn-outline-role">Login as Patient</Link>
                </div>
                <div className="role-card border-emerald">
                    <div className="role-header">
                        <i className="ph-fill ph-stethoscope"></i>
                        <h3>Doctor</h3>
                    </div>
                    <ul className="role-features">
                        <li>QR patient lookup</li>
                        <li>E-prescriptions</li>
                        <li>Drug interaction alerts</li>
                    </ul>
                    <Link to="/role-selector" className="btn btn-outline-role">Login as Doctor</Link>
                </div>
                <div className="role-card border-teal">
                    <div className="role-header">
                        <i className="ph-fill ph-pill"></i>
                        <h3>Pharmacist</h3>
                    </div>
                    <ul className="role-features">
                        <li>Prescription validation</li>
                        <li>Inventory tracking</li>
                        <li>Dispensing workflow</li>
                    </ul>
                    <Link to="/role-selector" className="btn btn-outline-role">Login as Pharmacist</Link>
                </div>
                <div className="role-card border-sage">
                    <div className="role-header">
                        <i className="ph-fill ph-shield-check"></i>
                        <h3>Admin</h3>
                    </div>
                    <ul className="role-features">
                        <li>Surveillance dashboard</li>
                        <li>ML outbreak alerts</li>
                        <li>Regional analytics</li>
                    </ul>
                    <Link to="/role-selector" className="btn btn-outline-role">Login as Admin</Link>
                </div>
            </div>
        </div>
      </section>

      {/* Security */}
      <section className="security-section">
        <div className="container fade-up-element">
            <div className="section-header centered">
                <h2 className="section-heading text-white">Enterprise-Grade Security</h2>
            </div>
            <div className="security-grid">
                <div className="security-badge"><span className="sec-icon">🔒</span><span className="sec-text">HIPAA Ready</span></div>
                <div className="security-badge"><span className="sec-icon">📋</span><span className="sec-text">ICD-10 Coded</span></div>
                <div className="security-badge"><span className="sec-icon">🛡️</span><span className="sec-text">K-Anonymity (k&ge;5)</span></div>
                <div className="security-badge"><span className="sec-icon">🔐</span><span className="sec-text">JWT + HMAC-SHA256</span></div>
                <div className="security-badge"><span className="sec-icon">📱</span><span className="sec-text">2FA Support</span></div>
                <div className="security-badge"><span className="sec-icon">✅</span><span className="sec-text">Full Audit Trail</span></div>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer" id="contact">
        <div className="container">
            <div className="footer-grid">
                <div className="footer-brand">
                    <div className="logo">
                        <div className="logo-icon white">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                            </svg>
                        </div>
                        <div className="logo-text">
                            <span className="logo-title text-white">ArogyaTrack</span>
                        </div>
                    </div>
                    <p className="brand-tagline">Advanced Public Health Intelligence Platform for a safer, healthier nation.</p>
                </div>
                <div className="footer-links">
                    <h4>Platform</h4>
                    <Link to="/surveillance">Surveillance</Link>
                    <Link to="/ai-engine">AI Engine</Link>
                    <Link to="/security">Security</Link>
                </div>
                <div className="footer-links">
                    <h4>For Providers</h4>
                    <Link to="/role-selector">Doctors</Link>
                    <Link to="/role-selector">Pharmacists</Link>
                    <Link to="/clinics">Clinics</Link>
                </div>
                <div className="footer-links">
                    <h4>Legal</h4>
                    <Link to="/privacy">Privacy Policy</Link>
                    <Link to="/terms">Terms of Service</Link>
                    <Link to="/data-protection">Data Protection</Link>
                </div>
            </div>
            <div className="footer-bottom">
                <div className="copyright">
                    &copy; 2026 ArogyaTrack &mdash; Government of India, Ministry of Health &amp; Family Welfare
                </div>
                <div className="social-icons">
                    <a href="#"><i className="ph-fill ph-twitter-logo"></i></a>
                    <a href="#"><i className="ph-fill ph-linkedin-logo"></i></a>
                    <a href="#"><i className="ph-fill ph-github-logo"></i></a>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
