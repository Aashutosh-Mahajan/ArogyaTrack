import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import RoleSelector from './pages/RoleSelector';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/role-selector" element={<RoleSelector />} />
        {/* Placeholder routes matching the selector */}
        <Route path="/patient/signin" element={<div className="text-white text-center mt-20" style={{marginTop: '100px', textAlign: 'center', color: 'white', fontFamily: 'Syne, sans-serif'}}>Patient Sign In (Placeholder)</div>} />
        <Route path="/doctor/signin" element={<div className="text-white text-center mt-20" style={{marginTop: '100px', textAlign: 'center', color: 'white', fontFamily: 'Syne, sans-serif'}}>Doctor Sign In (Placeholder)</div>} />
        <Route path="/pharmacist/signin" element={<div className="text-white text-center mt-20" style={{marginTop: '100px', textAlign: 'center', color: 'white', fontFamily: 'Syne, sans-serif'}}>Pharmacist Sign In (Placeholder)</div>} />
        <Route path="/admin/signin" element={<div className="text-white text-center mt-20" style={{marginTop: '100px', textAlign: 'center', color: 'white', fontFamily: 'Syne, sans-serif'}}>Admin Sign In (Placeholder)</div>} />
      </Routes>
    </Router>
  );
}

export default App;
