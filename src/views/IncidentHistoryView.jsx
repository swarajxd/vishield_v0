import React, { useState, useMemo } from 'react';

export default function IncidentHistoryView({ onInspectReport, onTriggerToast }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [drawerCall, setDrawerCall] = useState(null);

  const incidents = [
    {
      id: '#IN-89301',
      date: '12 Oct, 14:38:21',
      caller: '+91 98201 44820',
      circle: 'Airtel • Mumbai Telecom Circle',
      riskTier: 'High Risk',
      riskScore: 94.2,
      riskBg: 'bg-error/10 border-error/20 text-error',
      barColor: 'bg-error',
      language: 'Hindi (hi-IN)',
      langDetail: 'Synthesizer Clone Detected',
      category: 'Digital Arrest Threat',
      subCategory: 'CBI / Police Impersonation',
      status: 'Terminated (Live)',
      statusBg: 'bg-error/10 text-error',
      statusPing: true
    },
    {
      id: '#IN-89297',
      date: '12 Oct, 14:32:04',
      caller: '+91 94140 18299',
      circle: 'BSNL • Rajasthan Circle',
      riskTier: 'Suspicious',
      riskScore: 68.7,
      riskBg: 'bg-secondary/10 border-secondary/20 text-secondary',
      barColor: 'bg-secondary',
      language: 'English (en-IN)',
      langDetail: 'Acoustic Artefacts in Jitter',
      category: 'Fake NBFC Loan Pre-approval',
      subCategory: 'Unregistered Instant Credit',
      status: 'Flagged & Injected Noise',
      statusBg: 'bg-secondary/10 text-secondary',
      statusPing: false
    },
    {
      id: '#IN-89294',
      date: '12 Oct, 14:29:45',
      caller: '+91 98110 99420',
      circle: 'Jio • Delhi NCR Circle',
      riskTier: 'Safe',
      riskScore: 8.1,
      riskBg: 'bg-tertiary/10 border-tertiary/20 text-tertiary',
      barColor: 'bg-tertiary',
      language: 'Hindi (hi-IN)',
      langDetail: 'Organic Pitch Variance',
      category: 'Legitimate Branch Verification',
      subCategory: 'SBI Official PBX Verified',
      status: 'Passed (Encrypted)',
      statusBg: 'bg-tertiary-container/10 text-tertiary',
      statusPing: false
    },
    {
      id: '#IN-89288',
      date: '12 Oct, 14:15:10',
      caller: '+91 80002 11982',
      circle: 'Vodafone Idea • Gujarat Circle',
      riskTier: 'High Risk',
      riskScore: 91.5,
      riskBg: 'bg-error/10 border-error/20 text-error',
      barColor: 'bg-error',
      language: 'English (en-IN)',
      langDetail: 'Neural Pitch Artifacts @ 2kHz',
      category: 'KYC Expiry Urgency',
      subCategory: 'Bank Account Suspension Claim',
      status: 'Terminated (Live)',
      statusBg: 'bg-error/10 text-error',
      statusPing: true
    },
    {
      id: '#IN-89281',
      date: '12 Oct, 14:02:30',
      caller: '+91 99341 55621',
      circle: 'Airtel • Bihar & Jharkhand',
      riskTier: 'Suspicious',
      riskScore: 54.3,
      riskBg: 'bg-secondary/10 border-secondary/20 text-secondary',
      barColor: 'bg-secondary',
      language: 'Bengali (bn-IN)',
      langDetail: 'Automated Robocall Tape',
      category: 'Lottery / Tax Impersonation',
      subCategory: 'Fake Prize Winning Demand',
      status: 'Guardian Injected',
      statusBg: 'bg-secondary/10 text-secondary',
      statusPing: false
    }
  ];

  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      // Risk filter
      if (activeFilter === 'High Risk' && inc.riskTier !== 'High Risk') return false;
      if (activeFilter === 'Suspicious' && inc.riskTier !== 'Suspicious') return false;
      if (activeFilter === 'Safe' && inc.riskTier !== 'Safe') return false;

      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matches = 
          inc.id.toLowerCase().includes(query) ||
          inc.caller.toLowerCase().includes(query) ||
          inc.circle.toLowerCase().includes(query) ||
          inc.category.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Language
      if (selectedLanguage !== 'All' && !inc.language.includes(selectedLanguage)) return false;

      // Category
      if (selectedCategory !== 'All' && !inc.category.includes(selectedCategory)) return false;

      return true;
    });
  }, [activeFilter, searchTerm, selectedLanguage, selectedCategory, incidents]);

  const toggleSelectRow = (id) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === filteredIncidents.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredIncidents.map(i => i.id)));
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-[1440px] w-full mx-auto">
      {/* SECTION 1: HEADER & TELECOM AUDIT BADGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-black/[0.04]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">
              Incident History &amp; Telecom Intercepts
            </h2>
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container border border-outline-variant/40 font-mono-metric text-mono-metric text-on-surface-variant font-medium">
              SONOMA NODE #04
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Real-time deepfake audio forensics, conversational vishing traces, and voice carrier metadata logs.
          </p>
        </div>

        {/* Live Audit Sync Badge */}
        <div className="flex items-center self-start sm:self-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-lowest border border-outline-variant/30 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-container opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary-container"></span>
            </span>
            <span className="font-mono-metric text-mono-metric font-medium text-on-surface text-xs">
              TRAI Gateway Synchronized:
            </span>
            <span className="font-mono-metric text-mono-metric font-semibold text-tertiary text-xs">
              0.12s latency
            </span>
            <span className="material-symbols-outlined text-tertiary text-sm ml-0.5">health_and_safety</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: TOP METRIC SUMMARY CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="apple-glass-card rounded-xl p-space-md flex flex-col justify-between transition-transform hover:-translate-y-0.5 duration-200">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md font-medium text-on-surface-variant">Total Intercepts</span>
            <span className="p-1 rounded-md bg-surface-container-high/60 text-on-surface-variant">
              <span className="material-symbols-outlined text-base">graphic_eq</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface">1,420</span>
              <span className="font-label-sm text-label-sm text-outline ml-1 font-medium">calls</span>
            </div>
            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-label-sm text-label-sm font-semibold">
              <span className="material-symbols-outlined text-xs mr-0.5">multiline_chart</span>
              100% Volume
            </div>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-1 mt-3 overflow-hidden">
            <div className="bg-primary h-1 rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="apple-glass-card rounded-xl p-space-md flex flex-col justify-between transition-transform hover:-translate-y-0.5 duration-200">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md font-medium text-on-surface-variant">High Risk Flagged</span>
            <span className="p-1 rounded-md bg-error/10 text-error">
              <span className="material-symbols-outlined text-base fill-icon">crisis_alert</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="font-headline-lg text-headline-lg font-bold text-error">184</span>
              <span className="font-label-sm text-label-sm text-outline ml-1 font-medium">calls</span>
            </div>
            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-error/10 border border-error/20 text-error font-label-sm text-label-sm font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-error mr-1.5"></span>
              13.0%
            </div>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-1 mt-3 overflow-hidden">
            <div className="bg-error h-1 rounded-full" style={{ width: '13%' }}></div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="apple-glass-card rounded-xl p-space-md flex flex-col justify-between transition-transform hover:-translate-y-0.5 duration-200">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md font-medium text-on-surface-variant">Suspicious Anomaly</span>
            <span className="p-1 rounded-md bg-secondary/10 text-secondary">
              <span className="material-symbols-outlined text-base">record_voice_over</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="font-headline-lg text-headline-lg font-bold text-secondary">312</span>
              <span className="font-label-sm text-label-sm text-outline ml-1 font-medium">calls</span>
            </div>
            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary/10 border border-secondary/20 text-secondary font-label-sm text-label-sm font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-1.5"></span>
              22.0%
            </div>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-1 mt-3 overflow-hidden">
            <div className="bg-secondary h-1 rounded-full" style={{ width: '22%' }}></div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="apple-glass-card rounded-xl p-space-md flex flex-col justify-between transition-transform hover:-translate-y-0.5 duration-200">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md font-medium text-on-surface-variant">Safe &amp; Natural Audio</span>
            <span className="p-1 rounded-md bg-tertiary-container/10 text-tertiary">
              <span className="material-symbols-outlined text-base fill-icon">shield_with_heart</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="font-headline-lg text-headline-lg font-bold text-tertiary">924</span>
              <span className="font-label-sm text-label-sm text-outline ml-1 font-medium">calls</span>
            </div>
            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-tertiary/10 border border-tertiary/20 text-tertiary font-label-sm text-label-sm font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary mr-1.5"></span>
              65.0%
            </div>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-1 mt-3 overflow-hidden">
            <div className="bg-tertiary h-1 rounded-full" style={{ width: '65%' }}></div>
          </div>
        </div>
      </section>

      {/* SECTION 3: FILTER BAR & APPLE SEGMENTED CONTROLS */}
      <section className="apple-glass-card rounded-xl p-2.5 sm:p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-sm">
        {/* Left: HIG Native Segmented Pill Selector */}
        <div className="flex p-1 bg-surface-container rounded-lg self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'All', count: '1,420', countColor: 'text-outline' },
            { id: 'High Risk', count: '184', countColor: 'text-error font-semibold' },
            { id: 'Suspicious', count: '312', countColor: 'text-secondary font-semibold' },
            { id: 'Safe', count: '924', countColor: 'text-tertiary font-semibold' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3.5 py-1 rounded-[6px] text-label-md font-label-md transition-all active:scale-95 ${
                activeFilter === tab.id
                  ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface font-medium'
              }`}
            >
              {tab.id} <span className={`ml-1 ${tab.countColor}`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Right: Pickers, Search, and Date Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Search Field */}
          <div className="relative flex-1 sm:w-56 min-w-[160px]">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-base">
              search
            </span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-label-md font-label-md bg-surface-container-high/40 rounded-lg border border-transparent focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/10 text-on-surface placeholder:text-outline outline-none transition-all"
              placeholder="Search caller, ID, circle..."
              type="text"
            />
          </div>

          {/* Language Picker Dropdown */}
          <div className="relative">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 text-label-md font-label-md bg-surface-container-high/40 hover:bg-surface-container-high/70 text-on-surface rounded-lg border border-transparent cursor-pointer font-medium outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="All">All Languages</option>
              <option value="Hindi">Hindi (hi-IN)</option>
              <option value="English">English (en-IN)</option>
              <option value="Bengali">Bengali (bn-IN)</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-sm">
              expand_more
            </span>
          </div>

          {/* Categories Picker Dropdown */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 text-label-md font-label-md bg-surface-container-high/40 hover:bg-surface-container-high/70 text-on-surface rounded-lg border border-transparent cursor-pointer font-medium outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="All">All Scam Categories</option>
              <option value="Digital Arrest">Digital Arrest Threat</option>
              <option value="Fake NBFC">Fake NBFC Loan Pre-approval</option>
              <option value="KYC Expiry">KYC Expiry Urgency</option>
              <option value="Lottery">Lottery / Tax Impersonation</option>
              <option value="Verification">Legitimate Verification</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-sm">
              expand_more
            </span>
          </div>

          {/* Apple Date Picker Button */}
          <button
            onClick={() => onTriggerToast('Filter horizon set to Last 24 Hours')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-label-md font-label-md bg-surface-container-high/40 hover:bg-surface-container-high/70 text-on-surface rounded-lg border border-transparent font-medium active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base text-outline">calendar_today</span>
            <span>Last 24 Hours</span>
          </button>
        </div>
      </section>

      {/* SECTION 4: INTERACTIVE DATA TABLE */}
      <section className="bg-surface-container-lowest rounded-xl border border-black/[0.06] overflow-hidden apple-table-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/80 border-b border-black/[0.05] text-outline text-label-sm font-label-sm tracking-wider">
                <th className="w-10 py-3 pl-4 pr-1">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredIncidents.length && filteredIncidents.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-outline-variant text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 font-semibold">DATE &amp; TIME</th>
                <th className="py-3 px-3 font-semibold">CALLER &amp; TELECOM CIRCLE</th>
                <th className="py-3 px-3 font-semibold">RISK BADGE &amp; SCORE</th>
                <th className="py-3 px-3 font-semibold">LANGUAGE</th>
                <th className="py-3 px-3 font-semibold">SCAM CATEGORY</th>
                <th className="py-3 px-3 font-semibold">GUARDIAN STATUS</th>
                <th className="py-3 pr-4 pl-3 text-right font-semibold">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03] text-body-md font-body-md">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-outline font-label-md">
                    No telephony intercepts match the specified filters.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((row) => (
                  <tr key={row.id} className="hover:bg-black/[0.02] transition-colors group">
                    <td className="py-3.5 pl-4 pr-1">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.id)}
                        onChange={() => toggleSelectRow(row.id)}
                        className="rounded border-outline-variant text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-mono-metric text-mono-metric font-semibold text-on-surface">{row.date}</div>
                      <div className="font-mono-metric text-mono-metric text-outline">Call ID: {row.id}</div>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-on-surface flex items-center gap-1.5">
                        {row.caller}
                        {row.riskScore > 70 && (
                          <span className="material-symbols-outlined text-xs text-error">crisis_alert</span>
                        )}
                      </div>
                      <div className="text-label-sm font-label-sm text-outline">{row.circle}</div>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label-sm font-semibold border ${row.riskBg}`}>
                          {row.riskTier}
                        </span>
                        <span className={`font-mono-metric text-mono-metric font-bold ${
                          row.riskScore > 70 ? 'text-error' : row.riskScore > 40 ? 'text-secondary' : 'text-tertiary'
                        }`}>
                          {row.riskScore}%
                        </span>
                      </div>
                      <div className="w-24 bg-surface-container-high rounded-full h-1 mt-1.5 overflow-hidden">
                        <div className={`h-1 rounded-full ${row.barColor}`} style={{ width: `${row.riskScore}%` }}></div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-label-md font-label-md font-medium text-on-surface">
                        {row.language}
                      </span>
                      <div className="text-label-sm font-label-sm text-outline">{row.langDetail}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center gap-1 text-on-surface font-medium">
                        {row.category}
                      </span>
                      <div className={`text-label-sm font-label-sm font-mono-metric ${
                        row.riskScore > 70 ? 'text-error/90' : 'text-outline'
                      }`}>
                        {row.subCategory}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold ${row.statusBg}`}>
                        {row.statusPing && (
                          <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                        )}
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 pl-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDrawerCall(row)}
                          className="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                          title="Inspect Telephony Spectrogram"
                        >
                          <span className="material-symbols-outlined text-base">graphic_eq</span>
                        </button>
                        <button
                          onClick={() => onInspectReport(row.id)}
                          className="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                          title="Open Forensic Dossier"
                        >
                          <span className="material-symbols-outlined text-base">description</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Inspect Drawer Modal */}
      {drawerCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-surface-container-lowest/95 backdrop-blur-xl border border-outline-variant/30 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div>
                <h3 className="font-title text-title font-bold text-on-surface">{drawerCall.id} Telemetry</h3>
                <span className="text-xs text-outline font-mono-metric">{drawerCall.caller} • {drawerCall.circle}</span>
              </div>
              <button
                onClick={() => setDrawerCall(null)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="py-4 space-y-3 font-body-md text-sm">
              <div className="p-3 rounded-xl bg-surface-container-low flex justify-between items-center">
                <span>Calculated Threat Score</span>
                <span className="font-mono-metric font-bold text-error text-base">{drawerCall.riskScore}%</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low flex justify-between items-center">
                <span>Scam Vector</span>
                <span className="font-medium text-on-surface">{drawerCall.category}</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low flex justify-between items-center">
                <span>Audio Signature</span>
                <span className="font-mono-metric text-xs text-outline">{drawerCall.langDetail}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDrawerCall(null)}
                className="flex-1 py-2 rounded-xl border border-outline-variant/30 text-on-surface font-label-md text-sm font-semibold"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setDrawerCall(null);
                  onInspectReport(drawerCall.id);
                }}
                className="flex-1 py-2 rounded-xl bg-primary text-on-primary font-label-md text-sm font-bold shadow-sm"
              >
                Open Full Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
