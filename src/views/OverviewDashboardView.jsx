import React, { useState } from 'react';

export default function OverviewDashboardView({ onInspectReport, onNavigateToAlert, onTriggerToast }) {
  const [deepfakeInterceptor, setDeepfakeInterceptor] = useState(true);
  const [autoDropHighRisk, setAutoDropHighRisk] = useState(true);
  const [selectedChartPoint, setSelectedChartPoint] = useState('peak');
  const [filterActive, setFilterActive] = useState(false);

  const intercepts = [
    {
      id: '#TRK-8921-X',
      time: '14:48:12 IST',
      caller: '+91 98402 11982',
      route: 'Spoofed Private Route (PBX 4)',
      scam: 'Bank KYC Suspension Coercion',
      detail: 'Synthesized Neural Voice Clone (98.4%)',
      score: 96,
      scoreColor: 'text-error',
      barColor: 'bg-error',
      barWidth: '96%',
      scoreLabel: 'Zero Hesitation Jitter',
      status: 'Call Terminated',
      statusBg: 'bg-error-container/30 border-error/20 text-error',
      statusIcon: 'call_end'
    },
    {
      id: '#TRK-8920-F',
      time: '14:47:05 IST',
      caller: '+91 70291 44019',
      route: 'VoIP Gateway Gateway #12',
      scam: 'CBI Arrest Warrant Threat',
      detail: 'Social Engineering High Pressure',
      score: 88,
      scoreColor: 'text-error',
      barColor: 'bg-error',
      barWidth: '88%',
      scoreLabel: 'Hostile Cadence Detected',
      status: 'Guardian Injected',
      statusBg: 'bg-secondary-fixed/50 border-secondary/20 text-on-secondary-fixed-variant',
      statusIcon: 'warning'
    },
    {
      id: '#TRK-8919-A',
      time: '14:45:51 IST',
      caller: '+1 800 491 0022',
      route: 'International Inbound SIP',
      scam: 'Customs Seizure Notification',
      detail: 'Automated IVR Robocall',
      score: 58,
      scoreColor: 'text-secondary',
      barColor: 'bg-secondary',
      barWidth: '58%',
      scoreLabel: 'Recorded Loop Match',
      status: 'Voicebot Honeytrapped',
      statusBg: 'bg-surface-container border-outline-variant/30 text-on-surface-variant',
      statusIcon: 'record_voice_over'
    },
    {
      id: '#TRK-8918-B',
      time: '14:44:20 IST',
      caller: '+91 99100 82741',
      route: 'Verified Telco Enterprise Line',
      scam: 'Legitimate Branch Verification',
      detail: 'Biometric Acoustic Baseline Matches',
      score: 8,
      scoreColor: 'text-tertiary',
      barColor: 'bg-tertiary',
      barWidth: '8%',
      scoreLabel: 'Natural Vocal Variance',
      status: 'Passed Through',
      statusBg: 'bg-tertiary-container/15 border-tertiary/20 text-tertiary',
      statusIcon: 'check_circle'
    }
  ];

  return (
    <div className="flex flex-col gap-6 max-w-[1440px] w-full mx-auto">
      {/* Hero / Headline Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-container/10 border border-tertiary-container/20 text-tertiary font-label-sm text-label-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-ping"></span>
              ACTIVE DEFENSE MESH
            </span>
            <span className="font-mono-metric text-mono-metric text-outline">Node #US-EAST-4B</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight mt-1">
            Autonomous Telephony Threat Matrix
          </h2>
        </div>

        {/* Quick Toggles */}
        <div className="flex flex-wrap items-center gap-4 bg-surface-container-lowest border border-outline-variant/30 px-4 py-2 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-label-md text-label-md text-on-surface-variant">Deepfake Audio Interceptor</span>
            <button
              onClick={() => {
                setDeepfakeInterceptor(!deepfakeInterceptor);
                onTriggerToast(`Deepfake Audio Interceptor ${!deepfakeInterceptor ? 'enabled' : 'disabled'}`);
              }}
              className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                deepfakeInterceptor ? 'bg-primary' : 'bg-surface-container-highest'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                deepfakeInterceptor ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>
          <div className="h-4 w-px bg-outline-variant/40 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <span className="font-label-md text-label-md text-on-surface-variant">Auto-Drop High Risk</span>
            <button
              onClick={() => {
                setAutoDropHighRisk(!autoDropHighRisk);
                onTriggerToast(`Auto-Drop High Risk ${!autoDropHighRisk ? 'enabled' : 'disabled'}`);
              }}
              className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                autoDropHighRisk ? 'bg-primary' : 'bg-surface-container-highest'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                autoDropHighRisk ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* ================= 4 HERO METRIC CARDS ================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface-container-lowest p-space-lg rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-outline-variant/60 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">Calls Analyzed</span>
            <span className="p-2 rounded-xl bg-surface-container-low text-primary">
              <span className="material-symbols-outlined text-[18px]">call</span>
            </span>
          </div>
          <div className="mt-4">
            <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">14,892</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-tertiary-container/15 text-tertiary font-label-sm text-label-sm font-semibold">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                +12.4% vs last week
              </span>
              <span className="font-mono-metric text-mono-metric text-outline">320/min</span>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface-container-lowest p-space-lg rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-outline-variant/60 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">High-Risk Blocked</span>
            <span className="p-2 rounded-xl bg-error-container/20 text-error">
              <span className="material-symbols-outlined text-[18px]">phone_disabled</span>
            </span>
          </div>
          <div className="mt-4">
            <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-error">1,248</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-error-container/30 text-error font-label-sm text-label-sm font-semibold">
                <span className="material-symbols-outlined text-[14px]">arrow_drop_up</span>
                +18.2% flagged
              </span>
              <span className="font-mono-metric text-mono-metric text-on-surface-variant font-semibold">99.1% interception</span>
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface-container-lowest p-space-lg rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-outline-variant/60 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">Average Risk Score</span>
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[18px]">speed</span>
            </span>
          </div>
          <div className="mt-4">
            <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">34.2%</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm font-medium">
                Safe Baseline
              </span>
              <span className="font-mono-metric text-mono-metric text-tertiary">Normal variance</span>
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface-container-lowest p-space-lg rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-outline-variant/60 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">Guardian Alerts Dispatched</span>
            <span className="p-2 rounded-xl bg-secondary/10 text-secondary">
              <span className="material-symbols-outlined text-[18px]">shield</span>
            </span>
          </div>
          <div className="mt-4">
            <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">894</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-fixed/50 text-on-secondary-fixed-variant font-label-sm text-label-sm font-semibold">
                100% delivered &lt;3s
              </span>
              <span className="font-mono-metric text-mono-metric text-outline">94.6% ack</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= DATA VISUALIZATIONS SECTION ================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT VISUAL CARD: Risk Distribution Over Time */}
        <div className="lg:col-span-8 bg-surface-container-lowest p-space-lg rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-outline-variant/20">
              <div>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Risk Distribution Over Time</h3>
                <p className="font-body-md text-body-md text-outline mt-0.5">24-hour continuous acoustic signal &amp; threat telemetry</p>
              </div>
              {/* Legend Indicators */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                  Safe Traffic
                </div>
                <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                  Suspicious
                </div>
                <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                  <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
                  High Risk
                </div>
              </div>
            </div>

            {/* SVG Chart Area */}
            <div className="relative mt-6 h-64 w-full">
              {/* Background Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                <div className="border-b border-outline-variant/40 w-full h-0"></div>
                <div className="border-b border-outline-variant/40 w-full h-0"></div>
                <div className="border-b border-outline-variant/40 w-full h-0"></div>
                <div className="border-b border-outline-variant/40 w-full h-0"></div>
              </div>

              {/* Waveform Canvas */}
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 240">
                <defs>
                  <linearGradient id="grad-safe" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#0058bc" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#0058bc" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="grad-high" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Safe Area and Line */}
                <path d="M0,170 C100,150 180,180 260,140 C340,100 420,130 500,90 C580,50 640,80 700,70 L700,240 L0,240 Z" fill="url(#grad-safe)" />
                <path d="M0,170 C100,150 180,180 260,140 C340,100 420,130 500,90 C580,50 640,80 700,70" fill="none" stroke="#0058bc" strokeLinecap="round" strokeWidth="2.5" />
                {/* Suspicious Line */}
                <path d="M0,210 C120,200 200,190 300,175 C390,160 450,145 520,130 C600,110 650,135 700,120" fill="none" stroke="#4c4aca" strokeDasharray="4 4" strokeLinecap="round" strokeWidth="2" />
                {/* High Risk Spike Area and Line */}
                <path d="M0,230 C110,225 210,215 310,205 C380,195 410,130 450,85 C490,135 550,190 700,200 L700,240 L0,240 Z" fill="url(#grad-high)" />
                <path d="M0,230 C110,225 210,215 310,205 C380,195 410,130 450,85 C490,135 550,190 700,200" fill="none" stroke="#ba1a1a" strokeLinecap="round" strokeWidth="2.5" />
                {/* Peak Active Anchor Dot at 14:30 */}
                <circle cx="450" cy="85" fill="#ba1a1a" r="5" stroke="#ffffff" strokeWidth="2.5" className="animate-ping opacity-75" />
                <circle cx="450" cy="85" fill="#ba1a1a" r="5" stroke="#ffffff" strokeWidth="2.5" />
                {/* Timeline vertical ruler line */}
                <line opacity="0.6" stroke="#ba1a1a" strokeDasharray="2 3" strokeWidth="1" x1="450" x2="450" y1="0" y2="240" />
              </svg>

              {/* Interactive Hover Tooltip: Apple Frosted HUD Style */}
              <div className="absolute left-[58%] top-5 transform -translate-x-1/2 bg-surface-container-lowest/90 backdrop-blur-xl border border-outline-variant/40 rounded-xl px-3.5 py-2.5 shadow-xl transition-all">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
                  <span className="font-label-md text-label-md font-bold text-on-surface">14:00 - 15:00 IST Peak Rush</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 font-mono-metric text-mono-metric">
                  <span className="text-outline">High-Risk Spikes:</span>
                  <span className="text-error font-semibold text-right">412 calls</span>
                  <span className="text-outline">Synthetic Clones:</span>
                  <span className="text-secondary font-semibold text-right">78.4% match</span>
                  <span className="text-outline">Auto-Dropped:</span>
                  <span className="text-tertiary font-semibold text-right">408 blocks</span>
                </div>
              </div>
            </div>

            {/* X-Axis Timeline Markers */}
            <div className="flex justify-between items-center mt-3 text-outline font-mono-metric text-mono-metric px-1">
              <span>00:00</span>
              <span>04:00</span>
              <span>08:00</span>
              <span className="text-on-surface font-semibold">14:30 Peak</span>
              <span>18:00</span>
              <span>22:00</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-4 mt-2 border-t border-outline-variant/20 font-label-md text-label-md">
            <div className="flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-[16px]">info</span>
              <span>Telemetry calculated across 48 telephony carrier trunks via real-time SIP RTP mirrors.</span>
            </div>
            <button 
              onClick={onNavigateToAlert}
              className="text-primary font-semibold hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Inspect Vector Matrix</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* RIGHT VISUAL CARD: Scam Category Breakdown */}
        <div className="lg:col-span-4 bg-surface-container-lowest p-space-lg rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-outline-variant/20 flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Scam Breakdown</h3>
              <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                Active Patterns
              </span>
            </div>

            {/* Concentric Ring Visualizer */}
            <div className="relative flex items-center justify-center my-6">
              <svg className="w-52 h-52 -rotate-90 transform" viewBox="0 0 200 200">
                {/* Ring 1: Bank KYC (42%) */}
                <circle cx="100" cy="100" fill="none" r="85" stroke="#e9e7ed" strokeWidth="9" />
                <circle cx="100" cy="100" fill="none" r="85" stroke="#0058bc" strokeDasharray="534.07" strokeDashoffset="309.76" strokeLinecap="round" strokeWidth="9" />
                {/* Ring 2: CBI / Police Threat (26%) */}
                <circle cx="100" cy="100" fill="none" r="72" stroke="#e9e7ed" strokeWidth="9" />
                <circle cx="100" cy="100" fill="none" r="72" stroke="#ba1a1a" strokeDasharray="452.39" strokeDashoffset="334.76" strokeLinecap="round" strokeWidth="9" />
                {/* Ring 3: Lottery / KBC (14%) */}
                <circle cx="100" cy="100" fill="none" r="59" stroke="#e9e7ed" strokeWidth="9" />
                <circle cx="100" cy="100" fill="none" r="59" stroke="#4c4aca" strokeDasharray="370.7" strokeDashoffset="318.8" strokeLinecap="round" strokeWidth="9" />
                {/* Ring 4: Tech Support (11%) */}
                <circle cx="100" cy="100" fill="none" r="46" stroke="#e9e7ed" strokeWidth="9" />
                <circle cx="100" cy="100" fill="none" r="46" stroke="#008733" strokeDasharray="289.02" strokeDashoffset="257.2" strokeLinecap="round" strokeWidth="9" />
                {/* Ring 5: Customs (7%) */}
                <circle cx="100" cy="100" fill="none" r="33" stroke="#e9e7ed" strokeWidth="9" />
                <circle cx="100" cy="100" fill="none" r="33" stroke="#717786" strokeDasharray="207.34" strokeDashoffset="192.8" strokeLinecap="round" strokeWidth="9" />
              </svg>
              {/* Center Metric Summary */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">5 Major</span>
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Vectors</span>
              </div>
            </div>

            {/* Breakdown Legend List */}
            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-label-md font-label-md">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                  <span className="text-on-surface font-medium">Bank KYC Spoof</span>
                </div>
                <span className="font-mono-metric text-mono-metric font-semibold text-on-surface">42%</span>
              </div>
              <div className="flex items-center justify-between text-label-md font-label-md">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
                  <span className="text-on-surface font-medium">CBI / Police Threat</span>
                </div>
                <span className="font-mono-metric text-mono-metric font-semibold text-on-surface">26%</span>
              </div>
              <div className="flex items-center justify-between text-label-md font-label-md">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                  <span className="text-on-surface font-medium">Lottery / KBC Draw</span>
                </div>
                <span className="font-mono-metric text-mono-metric font-semibold text-on-surface">14%</span>
              </div>
              <div className="flex items-center justify-between text-label-md font-label-md">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary-container"></span>
                  <span className="text-on-surface font-medium">Remote Tech Support</span>
                </div>
                <span className="font-mono-metric text-mono-metric font-semibold text-on-surface">11%</span>
              </div>
              <div className="flex items-center justify-between text-label-md font-label-md">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-outline"></span>
                  <span className="text-on-surface font-medium">Customs &amp; Parcel Hold</span>
                </div>
                <span className="font-mono-metric text-mono-metric font-semibold text-on-surface">7%</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-outline-variant/20">
            <div className="flex items-center justify-between text-label-sm font-label-sm text-outline">
              <span>Accuracy Confidence:</span>
              <span className="font-mono-metric text-mono-metric text-tertiary font-semibold">99.82% σ</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= BOTTOM SECTION: RECENT TELEPHONY INTERCEPTS TABLE ================= */}
      <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Section Header */}
        <div className="p-space-lg border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Recent Telephony Intercepts</h3>
              <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono-metric text-mono-metric">
                LIVE FEED
              </span>
            </div>
            <p className="font-body-md text-body-md text-outline mt-0.5">
              High-assurance acoustic fingerprinting and conversational trajectory classification
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setFilterActive(!filterActive);
                onTriggerToast(filterActive ? 'Filter stream reset' : 'Filtered to High-Risk calls');
              }}
              className={`px-3 py-1.5 border border-outline-variant/30 rounded-xl font-label-md text-label-md transition-all active:scale-[0.98] flex items-center gap-1.5 ${
                filterActive ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">filter_list</span>
              <span>{filterActive ? 'Filter Active' : 'Filter Stream'}</span>
            </button>
            <button 
              onClick={() => onTriggerToast('Telephonic stream export downloaded (CSV)')}
              className="px-3 py-1.5 bg-surface-container border border-outline-variant/30 rounded-xl font-label-md text-label-md text-on-surface hover:bg-surface-container-high transition-all active:scale-[0.98] flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export Telemetry</span>
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                <th className="py-3 px-space-lg font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Session ID / Timestamp</th>
                <th className="py-3 px-4 font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Caller Origin &amp; Trunk</th>
                <th className="py-3 px-4 font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Detected Scam Pattern</th>
                <th className="py-3 px-4 font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Acoustic Score</th>
                <th className="py-3 px-4 font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Automated Mitigation</th>
                <th className="py-3 px-space-lg text-right font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15 text-body-md font-body-md">
              {intercepts
                .filter(item => filterActive ? item.score >= 70 : true)
                .map((row) => (
                <tr key={row.id} className="hover:bg-surface-container-low/40 transition-colors">
                  <td className="py-3.5 px-space-lg">
                    <div className="font-mono-metric text-mono-metric font-semibold text-on-surface">{row.id}</div>
                    <div className="font-mono-metric text-mono-metric text-outline">{row.time}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-outline">cell_tower</span>
                      <span className="font-mono-metric text-mono-metric text-on-surface font-medium">{row.caller}</span>
                    </div>
                    <span className="font-label-sm text-label-sm text-outline">{row.route}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${row.score >= 70 ? 'bg-error' : row.score >= 40 ? 'bg-secondary' : 'bg-tertiary'}`}></span>
                      <span className="font-medium text-on-surface">{row.scam}</span>
                    </div>
                    <span className={`font-label-sm text-label-sm ${row.score >= 70 ? 'text-error' : 'text-on-surface-variant'}`}>{row.detail}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                        <div className={`h-full ${row.barColor} rounded-full`} style={{ width: row.barWidth }}></div>
                      </div>
                      <span className={`font-mono-metric text-mono-metric font-bold ${row.scoreColor}`}>{row.score}%</span>
                    </div>
                    <span className="font-label-sm text-label-sm text-outline">{row.scoreLabel}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold border ${row.statusBg}`}>
                      <span className="material-symbols-outlined text-[14px]">{row.statusIcon}</span>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-space-lg text-right">
                    <button 
                      onClick={() => onInspectReport(row.id)}
                      className="text-primary font-semibold hover:underline font-label-md text-label-md inline-flex items-center gap-1"
                    >
                      <span>Inspect</span>
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination / Footer Bar */}
        <div className="px-space-lg py-3 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between text-label-md font-label-md text-outline">
          <div>Showing 1 - 4 of 1,248 active session intercepts</div>
          <div className="flex items-center gap-2">
            <button className="p-1 rounded-lg border border-outline-variant/30 hover:bg-surface-container disabled:opacity-40" disabled>
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="font-mono-metric text-mono-metric font-semibold text-on-surface">Page 1 of 312</span>
            <button className="p-1 rounded-lg border border-outline-variant/30 hover:bg-surface-container">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
