import React, { useState, useEffect } from 'react';
import {
  checkNumberReputation,
  reportNumber,
  fetchDatabaseStats,
  humanizeSignal,
  humanizeCategory,
  formatRelativeTime,
} from '../services/api';

export default function NumberCheckerView({ onTriggerToast }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [viaInternational, setViaInternational] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('bank_impersonation');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccessData, setReportSuccessData] = useState(null);
  const [reportError, setReportError] = useState(null);

  // Recent Checks (Session / local state)
  const [recentChecks, setRecentChecks] = useState(() => {
    try {
      const saved = sessionStorage.getItem('sentinel_recent_checks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load database stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await fetchDatabaseStats();
      setStats(data);
    } catch (err) {
      console.warn('Could not load database stats:', err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleCheck = async (e) => {
    if (e) e.preventDefault();
    const clean = phoneNumber.trim();
    if (!clean) {
      setError('Please enter a phone number to check.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await checkNumberReputation(clean, viaInternational);
      setResult(data);

      // Add to recent checks
      const newEntry = {
        id: Date.now(),
        masked: data.normalized_number_masked,
        query: clean,
        score: data.score,
        risk_level: data.risk_level,
        category: data.category,
        in_database: data.in_database,
        timestamp: new Date().toISOString(),
      };

      setRecentChecks((prev) => {
        const filtered = prev.filter((item) => item.masked !== data.normalized_number_masked);
        const updated = [newEntry, ...filtered].slice(0, 10);
        try {
          sessionStorage.setItem('sentinel_recent_checks', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      onTriggerToast(`Checked ${data.normalized_number_masked} (${data.risk_level})`);
    } catch (err) {
      setError(err.message || 'Unable to connect to Caller Reputation backend.');
      onTriggerToast('Error checking number reputation');
    } finally {
      setLoading(false);
    }
  };

  const handleRecentClick = (entry) => {
    setPhoneNumber(entry.query);
    handleCheckWithNumber(entry.query);
  };

  const handleCheckWithNumber = async (num) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await checkNumberReputation(num, viaInternational);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReportModal = () => {
    setReportError(null);
    setReportSuccessData(null);
    setReportModalOpen(true);
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setSubmittingReport(true);
    setReportError(null);

    try {
      const data = await reportNumber(phoneNumber.trim(), reportCategory);
      setReportSuccessData(data);
      onTriggerToast('Number report submitted successfully.');
      loadStats(); // refresh database stats
      // Re-check to update result card to in_database: true
      setTimeout(() => {
        handleCheck();
      }, 500);
    } catch (err) {
      if (err.status === 409) {
        setReportError(err.detail || 'You have already reported this number.');
      } else if (err.status === 429) {
        setReportError('Too many reports submitted. Rate limit active, please try again later.');
      } else {
        setReportError(err.message || 'Failed to submit report.');
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  // Helper for risk badge colors
  const getRiskBadge = (level) => {
    switch (level) {
      case 'HIGH_RISK':
        return {
          bg: 'bg-error/10 border-error/20 text-error',
          label: 'HIGH RISK',
          barColor: 'bg-error',
          icon: 'crisis_alert',
        };
      case 'SUSPICIOUS':
        return {
          bg: 'bg-[#FF9500]/10 border-[#FF9500]/30 text-[#FF9500]',
          label: 'SUSPICIOUS',
          barColor: 'bg-[#FF9500]',
          icon: 'warning',
        };
      default:
        return {
          bg: 'bg-tertiary-container/15 border-tertiary-container/30 text-tertiary',
          label: 'SAFE',
          barColor: 'bg-tertiary',
          icon: 'check_circle',
        };
    }
  };

  const isTelemarketer = result && result.category === 'telemarketer';
  const isWhitelisted = result && result.category === 'whitelisted';
  const isInDb = result && result.in_database;
  const isNotInDb = result && !result.in_database && !isWhitelisted && !isTelemarketer;

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-[1440px] w-full mx-auto">
      {/* SECTION 1: HEADER & STATS BADGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-black/[0.04]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">
              Number Checker &amp; Caller Reputation
            </h2>
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container border border-outline-variant/40 font-mono-metric text-mono-metric text-on-surface-variant font-medium">
              TRAI &amp; I4C WATCHDOG
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Real-time telephony intelligence, community threat telemetry, and TRAI carrier verification.
          </p>
        </div>

        {/* Live Service Status */}
        <div className="flex items-center self-start sm:self-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
            </span>
            <span className="font-mono-metric text-mono-metric font-medium text-on-surface text-xs">
              Reputation Engine:
            </span>
            <span className="font-mono-metric text-mono-metric font-semibold text-tertiary text-xs">
              Live &amp; Armed
            </span>
            <button
              onClick={loadStats}
              className="ml-1 p-0.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
              title="Refresh stats"
            >
              <span className="material-symbols-outlined text-sm">sync</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: DATABASE STATS STRIP */}
      {stats && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="apple-glass-card rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-outline text-label-sm font-medium">
              <span>Flagged Scam Numbers</span>
              <span className="material-symbols-outlined text-[16px] text-error">phone_disabled</span>
            </div>
            <div className="mt-2 font-headline-md text-2xl font-bold font-mono-metric text-on-surface">
              {stats.total_scam_numbers.toLocaleString()}
            </div>
            <span className="text-[11px] text-outline mt-1 font-body-md">Active in reputation DB</span>
          </div>

          <div className="apple-glass-card rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-outline text-label-sm font-medium">
              <span>Total Community Reports</span>
              <span className="material-symbols-outlined text-[16px] text-primary">groups</span>
            </div>
            <div className="mt-2 font-headline-md text-2xl font-bold font-mono-metric text-on-surface">
              {stats.total_reports.toLocaleString()}
            </div>
            <span className="text-[11px] text-outline mt-1 font-body-md">Cryptographically salted reports</span>
          </div>

          <div className="apple-glass-card rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-outline text-label-sm font-medium">
              <span>Verified Whitelist</span>
              <span className="material-symbols-outlined text-[16px] text-tertiary">verified</span>
            </div>
            <div className="mt-2 font-headline-md text-2xl font-bold font-mono-metric text-tertiary">
              {stats.whitelist_count.toLocaleString()}
            </div>
            <span className="text-[11px] text-outline mt-1 font-body-md">Official bank &amp; emergency lines</span>
          </div>

          <div className="apple-glass-card rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-outline text-label-sm font-medium">
              <span>Last External Forum Scrape</span>
              <span className="material-symbols-outlined text-[16px] text-secondary">forum</span>
            </div>
            <div className="mt-2 font-headline-md text-2xl font-bold font-mono-metric text-on-surface">
              {formatRelativeTime(stats.last_scrape_time)}
            </div>
            <span className="text-[11px] text-outline mt-1 font-body-md">
              {stats.sources?.['scammer.info'] ? `${stats.sources['scammer.info']} threads synced` : 'scammer.info connected'}
            </span>
          </div>
        </section>
      )}

      {/* SECTION 3: NUMBER INPUT CARD */}
      <section className="bg-surface-container-lowest rounded-2xl border border-black/5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-space-lg backdrop-blur-xl">
        <form onSubmit={handleCheck} className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-title text-title font-bold text-on-surface">
                Verify Inbound / Target Caller
              </h3>
              <p className="font-body-md text-sm text-outline mt-0.5">
                Evaluates number formatting, TRAI telecom allocations, foreign VoIP origins, and historical scammer reports.
              </p>
            </div>

            {/* International Route Toggle */}
            <div className="flex items-center gap-2.5 p-2 px-3 rounded-xl bg-surface-container-low border border-outline-variant/30 self-start sm:self-auto">
              <span className="font-label-md text-xs font-medium text-on-surface">
                Call arrived via international route
              </span>
              <button
                type="button"
                onClick={() => setViaInternational(!viaInternational)}
                className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 ${
                  viaInternational ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
                title="Used to detect +91 CLI spoofing arriving over international trunks"
              >
                <div
                  className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${
                    viaInternational ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Input Box with Action Button */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5 mt-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                dialpad
              </span>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. +91 98201 44820, 09840211982, 1409912345, or +1 800 491 0022"
                className="w-full pl-11 pr-10 py-3 bg-surface-container-low border border-outline-variant/40 rounded-xl font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-base"
              />
              {phoneNumber && (
                <button
                  type="button"
                  onClick={() => setPhoneNumber('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-1"
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !phoneNumber.trim()}
              className="px-6 py-3 bg-primary text-on-primary font-label-md text-label-md font-bold rounded-xl shadow-sm shadow-primary/20 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">search</span>
                  <span>Check Number</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-outline px-1">
            <span>Accepts: Indian Mobile (+91), TRAI 140/160 series, Landline, or International format (+1, +44, etc.)</span>
            <span className="font-mono-metric">HMAC-SHA256 privacy preservation active</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error font-body-md text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}
        </form>
      </section>

      {/* SECTION 4: RESULT CARD */}
      {loading && (
        <section className="bg-surface-container-lowest rounded-2xl border border-black/5 p-6 animate-pulse space-y-4">
          <div className="h-6 bg-surface-container-high rounded-md w-1/4"></div>
          <div className="h-12 bg-surface-container-high rounded-md w-3/4"></div>
          <div className="h-4 bg-surface-container-high rounded-md w-1/2"></div>
        </section>
      )}

      {result && !loading && (
        <section
          aria-live="polite"
          className="bg-surface-container-lowest rounded-2xl border border-black/5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-space-lg backdrop-blur-xl flex flex-col gap-6"
        >
          {/* Card Top: Number Banner & Risk Pill */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-outline-variant/20">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-display-lg text-2xl sm:text-3xl font-bold font-mono-metric text-on-surface">
                  {result.normalized_number_masked}
                </span>
                {/* Risk Pill */}
                {isWhitelisted ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-container/15 border border-tertiary-container/30 text-tertiary font-label-sm text-xs font-semibold">
                    <span className="material-symbols-outlined text-[15px] fill-icon">verified</span>
                    VERIFIED OFFICIAL
                  </span>
                ) : isTelemarketer ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/40 text-on-surface font-label-sm text-xs font-semibold">
                    <span className="material-symbols-outlined text-[15px]">cell_tower</span>
                    TRAI TELEMARKETER
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label-sm text-xs font-bold border ${
                      getRiskBadge(result.risk_level).bg
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px] fill-icon">
                      {getRiskBadge(result.risk_level).icon}
                    </span>
                    {getRiskBadge(result.risk_level).label}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-outline font-mono-metric">
                <span>Hash: {result.number_hash.substring(0, 16)}...</span>
                <span>•</span>
                <span>Category: <strong className="text-on-surface capitalize">{humanizeCategory(result.category)}</strong></span>
                {result.last_reported && (
                  <>
                    <span>•</span>
                    <span>Last Reported: {formatRelativeTime(result.last_reported)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Score Pill / Action Button */}
            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="flex flex-col items-end">
                <span className="text-[11px] text-outline font-mono-metric uppercase">Acoustic Risk Index</span>
                <span
                  className={`text-2xl font-bold font-mono-metric ${
                    result.score >= 0.70
                      ? 'text-error'
                      : result.score >= 0.40
                      ? 'text-[#FF9500]'
                      : 'text-tertiary'
                  }`}
                >
                  {Math.round(result.score * 100)}%
                </span>
              </div>
              <button
                onClick={handleOpenReportModal}
                className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface font-label-md text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px] text-error">flag</span>
                <span>Report Number</span>
              </button>
            </div>
          </div>

          {/* STATE SPECIFIC CALLOUT BANNERS */}
          {/* State 1: In Database */}
          {isInDb && (
            <div className="p-4 rounded-xl bg-error/5 border border-error/20 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-error font-semibold text-sm">
                <span className="material-symbols-outlined text-[18px]">report</span>
                <span>Confirmed Scam Number Recorded in Community &amp; Watchdog Database</span>
              </div>
              <p className="font-body-md text-sm text-on-surface-variant">
                This number has been actively flagged <strong>{result.report_count} times</strong> across Indian telecommunication watchlists. High probability of social engineering or credential harvesting.
              </p>
            </div>
          )}

          {/* State 2: Not in Database */}
          {isNotInDb && (
            <div className="p-4 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/25 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[#FF9500] font-semibold text-sm">
                <span className="material-symbols-outlined text-[18px]">info</span>
                <span>No Community Reports Found in Database</span>
              </div>
              <p className="font-body-md text-sm text-on-surface-variant">
                This number has zero historical incident reports logged yet. Current score is derived from <strong>offline number heuristics</strong> (carrier prefix, route, VoIP status).
                <strong className="block text-error mt-1">
                  ⚠️ Note: An absence of reports does NOT guarantee this caller is safe or genuine. New scam lines rotate daily.
                </strong>
              </p>
            </div>
          )}

          {/* State 3: Whitelisted */}
          {isWhitelisted && (
            <div className="p-4 rounded-xl bg-tertiary-container/15 border border-tertiary/25 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-tertiary font-semibold text-sm">
                <span className="material-symbols-outlined text-[18px] fill-icon">verified</span>
                <span>Verified Official Financial / Emergency Authority Number</span>
              </div>
              <p className="font-body-md text-sm text-on-surface-variant">
                This phone line is cryptographically matched against the official institutional whitelist (Government Helplines, National Banks, Carrier Emergency Trunks).
              </p>
            </div>
          )}

          {/* State 4: Telemarketer */}
          {isTelemarketer && (
            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-on-surface font-semibold text-sm">
                <span className="material-symbols-outlined text-[18px]">campaign</span>
                <span>TRAI Registered Commercial Communication Line</span>
              </div>
              <p className="font-body-md text-sm text-on-surface-variant">
                Allocated under the Telecom Regulatory Authority of India (TRAI) 140 / 160 national numbering plan for telemarketing and service transactions. Not classified as a vishing threat.
              </p>
            </div>
          )}

          {/* Detailed Metric Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Score Progress Bar */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
              <span className="text-xs font-label-sm text-outline uppercase font-semibold">Reputation Threat Level</span>
              <div className="mt-2">
                <div className="flex justify-between text-xs font-mono-metric font-bold mb-1">
                  <span>Score: {Math.round(result.score * 100)}%</span>
                  <span className="text-outline">Max: 100%</span>
                </div>
                <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      getRiskBadge(result.risk_level).barColor
                    }`}
                    style={{ width: `${Math.max(5, result.score * 100)}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-[11px] text-outline mt-2">
                {result.score >= 0.70
                  ? 'Exceeds 70% automated carrier killswitch threshold'
                  : result.score >= 0.40
                  ? 'Elevated risk, suspicious acoustic cadence'
                  : 'Within standard baseline tolerance'}
              </span>
            </div>

            {/* Report Volume */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
              <span className="text-xs font-label-sm text-outline uppercase font-semibold">Incident Reports Volume</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono-metric text-on-surface">{result.report_count}</span>
                <span className="text-xs text-outline font-medium">community flags</span>
              </div>
              <span className="text-[11px] text-outline mt-2">
                {result.report_count > 0 ? 'Saturating exponential volume curve applied' : 'Zero reports recorded'}
              </span>
            </div>

            {/* Sources Trace */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
              <span className="text-xs font-label-sm text-outline uppercase font-semibold">Intelligence Sources</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {result.sources && result.sources.length > 0 ? (
                  result.sources.map((src, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-surface-container-highest text-on-surface font-mono-metric text-xs font-semibold"
                    >
                      {src}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-outline font-mono-metric">Heuristics Engine Only</span>
                )}
              </div>
              <span className="text-[11px] text-outline mt-2">Corroborated across federated feeds</span>
            </div>
          </div>

          {/* Detected Signals Chips */}
          <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/15">
            <span className="text-xs font-label-sm text-outline uppercase font-semibold">
              Forensic Signals &amp; Heuristic Vectors
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {result.signals && result.signals.length > 0 ? (
                result.signals.map((sig, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface border border-outline-variant/30 text-xs font-medium font-body-md"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    {humanizeSignal(sig)}
                  </span>
                ))
              ) : (
                <span className="text-xs text-outline italic">No anomalous acoustic or route signals triggered.</span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 5: RECENT CHECKS LIST */}
      {recentChecks.length > 0 && (
        <section className="bg-surface-container-lowest rounded-xl border border-black/[0.06] overflow-hidden apple-table-shadow">
          <div className="p-4 border-b border-black/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-outline text-[18px]">history</span>
              <h3 className="font-label-md font-bold text-on-surface">Recent Caller Checks</h3>
            </div>
            <button
              onClick={() => {
                setRecentChecks([]);
                sessionStorage.removeItem('sentinel_recent_checks');
              }}
              className="text-xs text-outline hover:text-on-surface"
            >
              Clear History
            </button>
          </div>

          <div className="divide-y divide-black/[0.03]">
            {recentChecks.map((item) => (
              <div
                key={item.id}
                onClick={() => handleRecentClick(item)}
                className="p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-black/[0.02] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono-metric font-bold text-sm text-on-surface">{item.masked}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      getRiskBadge(item.risk_level).bg
                    }`}
                  >
                    {getRiskBadge(item.risk_level).label}
                  </span>
                  <span className="text-xs text-outline capitalize">{humanizeCategory(item.category)}</span>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  <span className="font-mono-metric text-xs font-bold text-on-surface">
                    {Math.round(item.score * 100)}%
                  </span>
                  <span className="text-xs text-outline font-mono-metric">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                  <span className="material-symbols-outlined text-outline text-base">chevron_right</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* REPORT MODAL */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-surface-container-lowest/95 backdrop-blur-2xl border border-outline-variant/30 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-error/10 text-error flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">flag</span>
                </div>
                <div>
                  <h3 className="font-title text-title font-bold text-on-surface">Report Suspicious Caller</h3>
                  <span className="text-xs text-outline font-mono-metric">Salted Privacy Preservation</span>
                </div>
              </div>
              <button
                onClick={() => setReportModalOpen(false)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {reportSuccessData ? (
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-2xl bg-tertiary-container/15 border border-tertiary/25 text-on-surface flex items-start gap-3">
                  <span className="material-symbols-outlined text-tertiary text-2xl shrink-0">check_circle</span>
                  <div>
                    <h4 className="font-bold text-sm text-tertiary">Report Recorded in National Defense Mesh</h4>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Thank you for contributing. This number has been flagged in the local reputation index.
                    </p>
                  </div>
                </div>

                {/* Government Official Reporting Links */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-outline uppercase">
                    Official Government Portals:
                  </span>
                  <div className="grid grid-cols-1 gap-2 text-sm font-label-md">
                    <a
                      href="https://sancharsaathi.gov.in/sfc/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-between border border-outline-variant/20 text-primary font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">verified</span>
                        Chakshu Portal (DoT / Sanchar Saathi)
                      </span>
                      <span className="material-symbols-outlined text-base">open_in_new</span>
                    </a>

                    <a
                      href="https://cybercrime.gov.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-between border border-outline-variant/20 text-primary font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">shield</span>
                        National Cybercrime Portal (cybercrime.gov.in)
                      </span>
                      <span className="material-symbols-outlined text-base">open_in_new</span>
                    </a>

                    <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between border border-outline-variant/20 text-on-surface">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="material-symbols-outlined text-base text-error">call</span>
                        National Cybercrime Helpline
                      </span>
                      <span className="font-mono-metric font-bold text-error">Dial 1930</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setReportModalOpen(false)}
                  className="w-full mt-2 py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-bold"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="py-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-outline uppercase block mb-1">
                    Target Phone Number
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant/40 rounded-xl font-mono-metric text-sm"
                    placeholder="+91 XXXXXXXXXX"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-outline uppercase block mb-1">
                    Detected Scam Category
                  </label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant/40 rounded-xl text-sm font-body-md"
                  >
                    <option value="bank_impersonation">Bank / KYC Impersonation (SBI, HDFC, YONO)</option>
                    <option value="digital_arrest">Digital Arrest / CBI / Police Coercion</option>
                    <option value="kyc">KYC Expiry / Document Suspension Threat</option>
                    <option value="lottery">Lottery / KBC Draw / Prize Claim</option>
                    <option value="investment">Investment Scheme / Daily Crypto Profit</option>
                    <option value="courier">Customs Parcel Seizure / FedEx Drugs Notice</option>
                    <option value="tech_support">Remote Tech Support / AnyDesk Access</option>
                    <option value="other">Other Suspicious Vishing Pattern</option>
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-surface-container-low text-xs text-outline leading-relaxed border border-outline-variant/20">
                  🔒 <strong>Privacy Guarantee:</strong> Raw phone numbers and personal credentials are never stored. Reports are indexed exclusively via one-way HMAC-SHA256 salted hashes.
                </div>

                {reportError && (
                  <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs">
                    {reportError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-on-surface font-label-md text-sm font-semibold hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReport || !phoneNumber.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-error text-on-error font-label-md text-sm font-bold shadow-sm hover:brightness-105 active:scale-95 disabled:opacity-50"
                  >
                    {submittingReport ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
