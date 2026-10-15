import React, { useState } from 'react';

export default function HighRiskWarningView({ onTerminateCall, onTriggerToast, onOpenReport }) {
  const [guardianNotified, setGuardianNotified] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [overrideSafety, setOverrideSafety] = useState(false);

  const handleSendGuardianPush = () => {
    setGuardianNotified(true);
    onTriggerToast('Firebase Cloud Messaging (FCM) high-priority push delivered to Rohan Sharma (+91 98110 55432)!');
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-[1480px] w-full mx-auto animate-in fade-in duration-300">
      
      {/* SECTION 8 EXACT ON-SCREEN CRITICAL WARNING (Page 9 Specification) */}
      <section className="w-full rounded-3xl bg-error/10 border-2 border-error p-6 shadow-lg relative overflow-hidden">
        {/* Ambient warning radial glow */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-error/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-error text-on-error flex items-center justify-center shrink-0 shadow-lg shadow-error/30 animate-pulse">
              <span className="material-symbols-outlined text-4xl">crisis_alert</span>
            </div>
            
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono-metric text-xs uppercase font-extrabold tracking-wider bg-error text-white px-3 py-1 rounded-full">
                  SECTION 8: REAL-TIME ON-SCREEN WARNING
                </span>
                <span className="text-xs font-mono-metric text-error font-bold">
                  THRESHOLD EXCEEDED (&ge; 70%)
                </span>
              </div>
              <h2 className="font-headline-lg text-3xl sm:text-4xl font-extrabold text-error tracking-tight mt-1">
                HIGH-RISK CALL DETECTED
              </h2>
              <p className="font-body-md text-sm text-on-surface-variant max-w-2xl mt-1">
                The Risk Fusion Engine detected critical phishing patterns: verified synthetic voice clone, coercive authority impersonation, and explicit OTP extortion.
              </p>
            </div>
          </div>

          {/* Quick Emergency Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 w-full lg:w-auto">
            <button
              onClick={() => {
                onTerminateCall();
                onTriggerToast('Call terminated immediately. Route dropped across telecom gateway.');
              }}
              className="flex-1 sm:flex-none px-6 py-3 bg-error text-white hover:brightness-110 active:scale-95 rounded-2xl font-label-md text-sm font-extrabold tracking-wide flex items-center justify-center gap-2 shadow-md shadow-error/30 transition-all"
            >
              <span className="material-symbols-outlined text-xl">call_end</span>
              <span>DISCONNECT CALL NOW</span>
            </button>

            <button
              onClick={() => {
                setIsMuted(!isMuted);
                onTriggerToast(!isMuted ? 'Microphone muted. Scammer isolated.' : 'Microphone unmuted.');
              }}
              className="px-4 py-3 bg-surface-container-lowest hover:bg-surface-container text-on-surface border border-outline-variant/30 rounded-2xl font-label-md text-sm font-semibold flex items-center gap-2 transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-lg">
                {isMuted ? 'mic_off' : 'volume_mute'}
              </span>
              <span>{isMuted ? 'Muted' : 'Mute & Safe Guard'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* CORE SPEC BENTO: Page 9 Exact Box + Guardian FCM Notification */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Section 8 Exact Layout Box (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 mb-5">
              <div>
                <span className="text-xs font-mono-metric font-bold text-outline uppercase tracking-wider">
                  Mobile Warning Dialog Layout (PDF Page 9 Spec)
                </span>
                <h3 className="font-title text-xl font-bold text-on-surface mt-0.5">
                  High-Risk Warning Card
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-error/10 border border-error/20 text-error font-mono-metric text-xs font-bold">
                RISK: 87%
              </span>
            </div>

            {/* Inner Red Framed Warning Box (Mirroring Page 9) */}
            <div className="p-6 rounded-2xl border-2 border-error/60 bg-error/5 flex flex-col gap-4">
              <div className="flex items-baseline justify-between border-b border-error/20 pb-3">
                <span className="font-mono-metric font-bold text-error text-sm tracking-wide">
                  HIGH-RISK CALL DETECTED
                </span>
                <span className="font-mono-metric text-2xl font-black text-error">
                  Risk: 87%
                </span>
              </div>

              <div>
                <span className="font-label-md font-bold text-on-surface text-sm block mb-2">
                  Indicators:
                </span>
                <div className="space-y-2 text-sm text-on-surface font-medium">
                  <div className="flex items-center gap-2.5 text-error">
                    <span className="material-symbols-outlined text-lg font-bold">check</span>
                    <span>Possible bank impersonation</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-error">
                    <span className="material-symbols-outlined text-lg font-bold">check</span>
                    <span>Urgency / fear tactic</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-error">
                    <span className="material-symbols-outlined text-lg font-bold">check</span>
                    <span>OTP request</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-error">
                    <span className="material-symbols-outlined text-lg font-bold">check</span>
                    <span>Suspicious caller reputation</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-surface-container-lowest rounded-xl border border-error/25 text-xs text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-lg">security</span>
                <span>Do NOT share OTP, CVV, or transfer money under any threat of account suspension.</span>
              </div>
            </div>

            {/* Signal Contributions breakdown for the 87% Risk */}
            <div className="mt-5 space-y-3">
              <span className="text-xs font-mono-metric font-bold text-outline uppercase tracking-wider block">
                Tri-Signal Fusion Breakdown:
              </span>
              <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono-metric">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="text-outline text-[10px]">Conversation (w1=0.50)</div>
                  <div className="text-sm font-bold text-purple-700 mt-1">95%</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-outline text-[10px]">AASIST Spoof (w2=0.30)</div>
                  <div className="text-sm font-bold text-amber-700 mt-1">90%</div>
                </div>
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
                  <div className="text-outline text-[10px]">Reputation (w3=0.20)</div>
                  <div className="text-sm font-bold text-teal-700 mt-1">85%</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Guardian Push Notification (Firebase Cloud Messaging) (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 mb-4">
                <div>
                  <span className="text-xs font-mono-metric font-bold text-outline uppercase tracking-wider">
                    Guardian Notification Module
                  </span>
                  <h3 className="font-title text-lg font-bold text-on-surface mt-0.5">
                    Firebase Cloud Messaging (FCM)
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-800 border border-amber-500/20 text-xs font-mono-metric font-bold">
                  DELIVERED
                </span>
              </div>

              {/* Mobile Push Notification Mockup (What Guardian Receives) */}
              <div className="p-4 rounded-2xl bg-surface-container-high border border-outline-variant/30 shadow-xs mb-4">
                <div className="flex items-center justify-between text-xs text-outline mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-primary text-white flex items-center justify-center text-[10px] font-bold">
                      V
                    </span>
                    <span className="font-semibold text-on-surface">ViShield Guardian Alert</span>
                  </div>
                  <span className="font-mono-metric text-[10px]">Just Now</span>
                </div>
                <div className="font-bold text-xs text-error">
                  CRITICAL: High-Risk Call Detected (87%)
                </div>
                <p className="text-xs text-on-surface mt-1 leading-relaxed">
                  Active extortion call detected for user. The caller requested an OTP under threat of bank blockage.
                </p>
                <div className="mt-2.5 p-2 bg-surface-container-lowest rounded-xl border border-outline-variant/25 text-[11px] italic text-on-surface-variant">
                  Snippet: "Sir, your account will be blocked, please verify your OTP."
                </div>
              </div>

              {/* Guardian Configuration Details */}
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                  <span className="text-outline">Pre-registered Guardian:</span>
                  <span className="font-semibold text-on-surface">Rohan Sharma</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                  <span className="text-outline">Guardian Mobile:</span>
                  <span className="font-mono-metric font-semibold text-on-surface">+91 98110 55432</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                  <span className="text-outline">Notification Payload:</span>
                  <span className="font-mono-metric text-outline text-[11px]">Includes Call Snippet + Risk Level</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                  <span className="text-outline">Firebase Status:</span>
                  <span className="font-mono-metric text-tertiary font-bold">HTTP 200 FCM Success</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-outline-variant/20 flex items-center gap-3">
              <button
                onClick={handleSendGuardianPush}
                className="flex-1 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-500/30 rounded-xl font-label-md text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">send_to_mobile</span>
                <span>Resend FCM Push</span>
              </button>

              <button
                onClick={onOpenReport}
                className="px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/30 rounded-xl font-label-md text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">description</span>
                <span>View Full Report</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
