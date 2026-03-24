import './styles/app.css';

/** Netlify: zet in Netlify → Environment (ook bij build) + zelfde secret in function env */
window.__HOHOH_FOLLOWUP_URL__ = import.meta.env.VITE_FOLLOWUP_URL || '';
window.__HOHOH_FOLLOWUP_SECRET__ = import.meta.env.VITE_FOLLOWUP_SECRET || '';
