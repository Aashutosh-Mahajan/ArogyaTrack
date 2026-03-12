// NEW: ABHA FEATURE - Mock ABHA ID verification API for hackathon demo
import mockAbhaDatabase from './data/mockAbhaDatabase.js'; // NEW: ABHA FEATURE

// NEW: ABHA FEATURE - Verifies ABHA ID against mock database
export const verifyAbhaId = (abha_id) => {
  // NEW: ABHA FEATURE - strips spaces and dashes, matches against mock DB
  const cleaned = abha_id.replace(/[-\s]/g, ""); // NEW: ABHA FEATURE
  const patient = mockAbhaDatabase.find(p => // NEW: ABHA FEATURE
    p.abha_id.replace(/[-\s]/g, "") === cleaned // NEW: ABHA FEATURE
  ); // NEW: ABHA FEATURE
  if (patient) return { success: true, patient }; // NEW: ABHA FEATURE
  return { success: false, message: "ABHA ID not found" }; // NEW: ABHA FEATURE
};
// NOTE: Replace with real NHA ABHA API call in production
