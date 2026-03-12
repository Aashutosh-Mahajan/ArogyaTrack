import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Stethoscope, Pill, ShieldCheck, ArrowRight } from '@phosphor-icons/react';
import './RoleSelector.css';

const RoleSelector = () => {
  const navigate = useNavigate();

  const roles = [
    {
      id: 'patient',
      title: 'Patient',
      subtitle: 'Access your health records & prescriptions',
      pillText: 'Personal Healthcare',
      pillColor: '#4ade80',
      pillBg: 'rgba(74,222,128,0.12)',
      icon: <User weight="fill" size={32} color="#4ade80" />,
      circleBg: 'rgba(74,222,128,0.15)',
      route: '/patient/signin'
    },
    {
      id: 'doctor',
      title: 'Doctor',
      subtitle: 'Manage patients, write prescriptions',
      pillText: 'Requires Verification',
      pillColor: '#34d399',
      pillBg: 'rgba(52,211,153,0.12)',
      icon: <Stethoscope weight="fill" size={32} color="#34d399" />,
      circleBg: 'rgba(52,211,153,0.15)',
      route: '/doctor/signin',
      extraBadge: { text: '⚠️ Admin Verified', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    },
    {
      id: 'pharmacist',
      title: 'Pharmacist',
      subtitle: 'Validate & dispense prescriptions',
      pillText: 'Licensed Pharmacy',
      pillColor: '#2dd4bf',
      pillBg: 'rgba(45,212,191,0.12)',
      icon: <Pill weight="fill" size={32} color="#2dd4bf" />,
      circleBg: 'rgba(45,212,191,0.15)',
      route: '/pharmacist/signin'
    },
    {
      id: 'admin',
      title: 'Admin',
      subtitle: 'Surveillance dashboard & system control',
      pillText: 'Access Key Required',
      pillColor: '#86efac',
      pillBg: 'rgba(134,239,172,0.12)',
      icon: <ShieldCheck weight="fill" size={32} color="#86efac" />,
      circleBg: 'rgba(134,239,172,0.15)',
      route: '/admin/signin',
      extraBadge: { text: '⛔ Restricted', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
    }
  ];

  return (
    <div className="role-selector-page">
      <div className="role-glow"></div>
      
      <div className="role-top">
        <Link to="/" className="role-logo">
            <div className="logo-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
            </div>
            <div className="role-logo-text">
                <span className="role-logo-title">ArogyaTrack</span>
                <span className="role-logo-badge">GOVT. OF INDIA</span>
            </div>
        </Link>
      </div>

      <div className="role-content">
        <h1 className="role-heading fade-up-0">Who are you?</h1>
        <p className="role-subtitle fade-up-0">Select your role to access the platform</p>

        <div className="role-cards-container">
          {roles.map((role, index) => (
            <div key={role.id} className={`fade-up-${index + 1}`} style={{ display: 'flex' }}>
              <Link 
                to={role.route}
                className="role-select-card idle-anim"
              >
              {role.extraBadge && (
                <div className="extra-badge" style={{ color: role.extraBadge.color, background: role.extraBadge.bg }}>
                  {role.extraBadge.text}
                </div>
              )}
              
              <div className="role-icon-circle" style={{ background: role.circleBg }}>
                {role.icon}
              </div>
              
              <h3 className="role-card-title">{role.title}</h3>
              <p className="role-card-subtitle">{role.subtitle}</p>
              
              <div className="role-card-bottom">
                <div className="role-pill" style={{ color: role.pillColor, background: role.pillBg }}>
                  {role.pillText}
                </div>
                <ArrowRight size={16} weight="bold" color={role.pillColor} className="arrow-icon" />
              </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="role-footer">
         <div className="ecg-line" style={{position: 'absolute', top: 0}}></div>
         <p>Ministry of Health & Family Welfare | Govt. of India</p>
      </div>
    </div>
  );
};

export default RoleSelector;
