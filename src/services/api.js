// API Client for Caller Reputation service

export const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function wsUrl(path) {
  const base = API_BASE.replace(/^http/i, 'ws');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseError(res) {
  const data = await res.json().catch(() => ({}));
  const message =
    data?.error?.message || data?.detail || `Server returned error (${res.status})`;
  const err = new Error(message);
  err.status = res.status;
  err.code = data?.error?.code;
  err.detail = data?.detail;
  throw err;
}

/**
 * Live-stream health: STT backend and model flags.
 */
export async function fetchLiveHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) await parseError(res);
  return await res.json();
}

/**
 * Upload a consented audio file for chunked STT + scam analysis.
 */
export async function uploadLiveCall(file, { consent = true, realtime = false } = {}) {
  const form = new FormData();
  form.append('file', file, file.name || 'live-call.wav');
  form.append('consent_confirmed', consent ? 'true' : 'false');
  form.append('realtime', realtime ? 'true' : 'false');

  const res = await fetch(`${API_BASE}/calls/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) await parseError(res);
  return await res.json();
}

export async function fetchLiveTranscript(callId) {
  const res = await fetch(`${API_BASE}/calls/${encodeURIComponent(callId)}/transcript`);
  if (!res.ok) await parseError(res);
  return await res.json();
}

export async function fetchLiveAnalysis(callId) {
  const res = await fetch(`${API_BASE}/calls/${encodeURIComponent(callId)}/analysis`);
  if (!res.ok) await parseError(res);
  return await res.json();
}

export async function analyzeTranscript(transcript) {
  const res = await fetch(`${API_BASE}/analyze/transcript`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, consent_confirmed: true }),
  });
  if (!res.ok) await parseError(res);
  return await res.json();
}

/**
 * Get or create a persistent anonymous reporter ID stored in localStorage.
 * Hashed server-side; raw ID never stores user identity.
 */
export function getOrCreateReporterId() {
  const KEY = 'sentinel_reporter_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = 'anon_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Check caller reputation by phone number.
 */
export async function checkNumberReputation(number, viaInternational = false) {
  const cleanNumber = number.trim();
  // URL encode the number (especially leading + sign)
  const encoded = encodeURIComponent(cleanNumber);
  const url = `${API_BASE}/reputation/${encoded}${viaInternational ? '?via_international=true' : ''}`;
  
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server returned error (${res.status})`);
  }
  return await res.json();
}

/**
 * Report a suspicious number.
 */
export async function reportNumber(number, category = 'other') {
  const reporterId = getOrCreateReporterId();
  const url = `${API_BASE}/report`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: number.trim(),
      category: category,
      reporter_id: reporterId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || `Failed to report number (${res.status})`);
    err.status = res.status;
    err.detail = data.detail;
    throw err;
  }
  return data;
}

/**
 * Fetch database summary stats.
 */
export async function fetchDatabaseStats() {
  const url = `${API_BASE}/stats`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load stats (${res.status})`);
  }
  return await res.json();
}

/**
 * Humanize snake_case signal keys into readable badges.
 */
export function humanizeSignal(signal) {
  if (!signal) return '';
  if (signal.startsWith('foreign_number:')) {
    const region = signal.split(':')[1] || '';
    return `Foreign Number (${region})`;
  }
  if (signal.startsWith('third_party_fraud_score:')) {
    const score = signal.split(':')[1] || '';
    return `IPQS Fraud Score: ${Math.round(parseFloat(score) * 100)}%`;
  }
  if (signal.startsWith('reported_') && signal.includes('_times')) {
    const parts = signal.match(/reported_(\d+)_times/);
    if (parts) return `Reported ${parts[1]} times`;
  }
  if (signal.startsWith('last_reported_') && signal.includes('d_ago')) {
    const parts = signal.match(/last_reported_(\d+)d_ago/);
    if (parts) {
      const days = parseInt(parts[1], 10);
      return days === 0 ? 'Reported Today' : `Reported ${days}d ago`;
    }
  }

  const map = {
    trai_140_promotional_series: 'TRAI 140 Promotional Series',
    trai_160_service_series: 'TRAI 160 Service/Transactional Series',
    voip_number: 'VoIP Telephony Line',
    premium_rate_number: 'Premium Rate Number',
    high_risk_origin_region: 'High-Risk Origin Region',
    possible_spoofing_91_via_international_route: 'Possible +91 Spoofing (International Gateway)',
    invalid_number: 'Invalid Number Plan',
    unparseable_number: 'Unparseable Number Structure',
    whitelisted_official_number: 'Verified Official Line',
  };

  if (map[signal]) return map[signal];

  // Generic humanization
  return signal
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Humanize category slug to title.
 */
export function humanizeCategory(category) {
  const map = {
    bank_impersonation: 'Bank / KYC Impersonation',
    kyc: 'KYC Expiry Urgency',
    lottery: 'Lottery / KBC Draw',
    digital_arrest: 'Digital Arrest / CBI Impersonation',
    investment: 'Investment / Crypto Scheme',
    courier: 'Customs & Courier Seizure',
    tech_support: 'Remote Tech Support',
    telemarketer: 'TRAI Registered Telemarketer',
    whitelisted: 'Verified Official Entity',
    other: 'Other Suspicious Vector',
    unknown: 'Unclassified / Organic',
  };
  return map[category] || (category ? category.replace(/_/g, ' ') : 'Unknown');
}

/**
 * Format ISO datetime to relative string.
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const days = Math.floor(diffSec / 86400);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  } catch {
    return isoString;
  }
}
