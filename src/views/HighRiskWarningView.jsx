import React, { useState } from 'react';

export default function HighRiskWarningView({ onTerminateCall, onTriggerToast, onOpenReport }) {
  const [isolatedTrunk, setIsolatedTrunk] = useState(true);
  const [blockedNational, setBlockedNational] = useState(true);
  const [advisorySent, setAdvisorySent] = useState(true);
  const [overrideActive, setOverrideActive] = useState(false);

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-[1440px] w-full mx-auto">
      {/* HERO CRITICAL ALERT BANNER (Apple Security Lockout Spec) */}
      <section className="w-full rounded-2xl frosted-alert-banner p-4 md:p-6 shadow-sm border border-error/30 relative overflow-hidden">
        {/* Glow ambient backdrop */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-error/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-error text-on-error flex items-center justify-center shrink-0 shadow-md shadow-error/25">
              <span className="material-symbols-outlined fill-icon text-2xl">crisis_alert</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-headline-sm text-headline-sm text-error font-extrabold tracking-tight">
                  CRITICAL WARNING: HIGH-RISK PHISHING DETECTED
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-error/20 border border-error/30 text-error font-mono-metric text-mono-metric uppercase tracking-wider font-bold">
                  STAGE 4 INTERCEPT
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                Active telephony analysis flagged predatory social engineering patterns aligned with unauthorized financial extortion.
              </p>
            </div>
          </div>

          {/* Confirmed Guardian Intercept Stamp */}
          <div className="w-full md:w-auto shrink-0 flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-container-lowest/80 border border-error/25 shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-tertiary pulse-ring"></div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-outline font-semibold tracking-wide uppercase">
                Confirmed Escalation
              </span>
              <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1">
                Guardian Rohan notified at 14:32 via SMS &amp; WhatsApp (Call Intercept Link Sent)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CORE TELEMETRY BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: RISK METRIC & PRIMARY THREAT SIGNATURES (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Probability Card */}
          <div className="frosted-glass-hud rounded-2xl p-6 shadow-sm border border-outline-variant/30 relative overflow-hidden bg-surface-container-lowest">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-outline-variant/20">
              <div>
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
                  Heuristic Security Index
                </span>
                <h2 className="font-title text-title text-on-surface font-bold tracking-tight mt-0.5">
                  Calculated Scam Probability
                </h2>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="px-3 py-1 rounded-full bg-error/10 border border-error/20 text-error font-label-md text-label-md font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-error"></span>
                  HIGH RISK
                </span>
                <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-mono-metric text-mono-metric">
                  CALC_v4.2
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-5 items-center">
              {/* 87% Display Anchor */}
              <div className="md:col-span-6 flex flex-col justify-center">
                <div className="flex items-baseline gap-2">
                  <span className="font-display-lg text-display-lg text-error font-extrabold tracking-tight">87%</span>
                  <span className="font-headline-sm text-headline-sm text-outline font-medium">/ 100</span>
                </div>
                <p className="font-label-md text-label-md text-on-surface-variant mt-1 font-medium">
                  Exceeds 70% automated escalation threshold
                </p>
                <div className="w-full bg-surface-container-highest rounded-full h-2 mt-3 overflow-hidden">
                  <div className="bg-error h-2 rounded-full transition-all duration-500" style={{ width: '87%' }}></div>
                </div>
              </div>

              {/* Recessed Spectrogram Live Feed snippet */}
              <div className="md:col-span-6 bg-[#ECECEE] p-3.5 rounded-xl border border-outline-variant/30 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                  <span className="font-mono-metric text-mono-metric text-on-surface font-semibold flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full bg-error pulse-ring"></span>
                    VOICE SPECTRAL STRESS: ELEVATED
                  </span>
                  <span className="font-mono-metric text-mono-metric text-error font-bold text-xs">0.94 CONF</span>
                </div>
                {/* Waveform visualization bars */}
                <div className="h-12 flex items-center justify-between gap-1 px-1 my-2">
                  {[6, 10, 8, 12, 7, 4, 11, 9, 6, 12, 3, 10, 7, 11, 4].map((h, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full ${i % 5 === 0 ? 'bg-primary' : 'bg-error'} animate-pulse`}
                      style={{ height: `${h * 3.5}px`, animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-on-surface-variant font-mono-metric text-[11px]">
                  <span>Synthesized Pitch Cadence</span>
                  <span className="text-error font-semibold">SYNTHETIC INJECTION DETECTED</span>
                </div>
              </div>
            </div>
          </div>

            {/* 4 Primary Threat Signatures Grid */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-title text-title text-on-surface font-bold tracking-tight">Primary Threat Signatures</h3>
              <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">4/4 Anomalies Verified</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Card 1 */}
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-sm flex flex-col justify-between hover:border-error/40 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-error/10 text-error flex items-center justify-center shrink-0 border border-error/20">
                    <span className="material-symbols-outlined fill-icon text-xl">account_balance</span>
                  </div>
                  <div>
                    <h4 className="font-label-md text-label-md text-on-surface font-bold">Bank Impersonation</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant text-sm mt-0.5">
                      State Bank &amp; HDFC impersonation tokens detected during speech synthesis scan.
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between font-mono-metric text-mono-metric text-outline">
                  <span>Confidence score</span>
                  <span className="text-error font-bold">96.8%</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-sm flex flex-col justify-between hover:border-error/40 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-error/10 text-error flex items-center justify-center shrink-0 border border-error/20">
                    <span className="material-symbols-outlined fill-icon text-xl">timer</span>
                  </div>
                  <div>
                    <h4 className="font-label-md text-label-md text-on-surface font-bold">Artificial Urgency Pressure</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant text-sm mt-0.5">
                      "Your account will be blocked within 10 minutes" acoustic coercion syntax.
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between font-mono-metric text-mono-metric text-outline">
                  <span>Psych Stress Index</span>
                  <span className="text-error font-bold">CRITICAL</span>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-sm flex flex-col justify-between hover:border-error/40 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-error/10 text-error flex items-center justify-center shrink-0 border border-error/20">
                    <span className="material-symbols-outlined fill-icon text-xl">password</span>
                  </div>
                  <div>
                    <h4 className="font-label-md text-label-md text-on-surface font-bold">Unlawful Credential Demand</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant text-sm mt-0.5">
                      Demanding OTP / PIN under pretext of mandatory KYC compliance update.
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between font-mono-metric text-mono-metric text-outline">
                  <span>Protocol Violation</span>
                  <span className="text-error font-bold">RBI Sec 34-A</span>
                </div>
              </div>

              {/* Card 4 */}
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-sm flex flex-col justify-between hover:border-error/40 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-error/10 text-error flex items-center justify-center shrink-0 border border-error/20">
                    <span className="material-symbols-outlined fill-icon text-xl">policy</span>
                  </div>
                  <div>
                    <h4 className="font-label-md text-label-md text-on-surface font-bold">National Registry Flags</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant text-sm mt-0.5">
                      Origin reported 42 times for electricity bill &amp; KYC cyber extortion incidents.
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between font-mono-metric text-mono-metric text-outline">
                  <span>Database Match</span>
                  <span className="text-error font-bold">I4C REGISTRY</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Intercept Transcript Excerpt Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-error">record_voice_over</span>
                <span className="font-title text-title font-bold text-on-surface">Live Intercept Transcript Excerpt</span>
              </div>
              <span className="font-mono-metric text-mono-metric text-outline">TIMESTAMP: 14:32:04 IST</span>
            </div>
            <div className="mt-4 p-4 rounded-xl bg-surface-container-low border-l-4 border-error">
              <span className="font-label-sm text-label-sm text-error uppercase font-bold tracking-wider">
                Acoustic Audio Intercept (Hinglish)
              </span>
              <p className="font-body-lg text-body-lg text-on-surface font-semibold italic mt-1">
                "Sir, aapka account block ho jayega, please apna OTP verify kijiye."
              </p>
              <div className="mt-2.5 pt-2 border-t border-outline-variant/30 flex items-start gap-2">
                <span className="material-symbols-outlined text-outline text-base mt-0.5">translate</span>
                <p className="font-body-md text-body-md text-on-surface-variant text-sm">
                  "Sir, your account will be permanently blocked, please immediately verify your 6-digit OTP code."
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTION CHECKLIST & PROTOCOL CONTROLS (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Action Checklist Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <h3 className="font-title text-title font-bold text-on-surface">Immediate Actions</h3>
              <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-mono-metric text-[10px] font-bold">
                ENFORCE
              </span>
            </div>

            <div className="space-y-3 font-body-md text-sm">
              <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer border border-outline-variant/20">
                <span className="font-medium text-on-surface">Isolate Trunk Carrier</span>
                <input
                  type="checkbox"
                  checked={isolatedTrunk}
                  onChange={(e) => setIsolatedTrunk(e.target.checked)}
                  className="w-4 h-4 text-primary rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer border border-outline-variant/20">
                <span className="font-medium text-on-surface">Block in National Federation</span>
                <input
                  type="checkbox"
                  checked={blockedNational}
                  onChange={(e) => setBlockedNational(e.target.checked)}
                  className="w-4 h-4 text-primary rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer border border-outline-variant/20">
                <span className="font-medium text-on-surface">Send Citizen Safety SMS</span>
                <input
                  type="checkbox"
                  checked={advisorySent}
                  onChange={(e) => setAdvisorySent(e.target.checked)}
                  className="w-4 h-4 text-primary rounded"
                />
              </label>
            </div>

            {/* Execute Emergency Termination */}
            <button
              onClick={() => {
                onTerminateCall();
                onTriggerToast('Emergency Call Intercept executed. Telephony trunk disconnected.');
              }}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-error hover:bg-error/90 text-on-error font-label-md text-label-md font-bold flex items-center justify-center gap-2 shadow-md shadow-error/25 active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">call_end</span>
              <span>Execute Emergency Disconnect</span>
            </button>

            {/* View Full Forensic Dossier */}
            <button
              onClick={onOpenReport}
              className="w-full py-2.5 px-4 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              <span>Open Forensic Dossier</span>
            </button>
          </div>

          {/* Manual Protocol Override Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md font-semibold text-on-surface">Officer Manual Override</span>
              <button
                onClick={() => {
                  setOverrideActive(!overrideActive);
                  onTriggerToast(`Manual override ${!overrideActive ? 'unlocked' : 'locked'}`);
                }}
                className={`text-xs px-2.5 py-1 rounded-full font-mono-metric font-semibold ${
                  overrideActive ? 'bg-primary text-on-primary' : 'bg-surface-container text-outline'
                }`}
              >
                {overrideActive ? 'ACTIVE' : 'LOCKED'}
              </button>
            </div>
            <p className="text-xs text-outline leading-relaxed">
              Security clearance required. Unlocking allows whitelisting high-risk telephony flows during authorized penetration tests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
