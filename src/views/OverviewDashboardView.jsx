import React, { useState } from 'react';
import { 
  PHISHING_INDICATORS_SCHEMA, 
  POSTGRESQL_CALL_RECORDS, 
  DEFAULT_WEIGHTS,
  RISK_THRESHOLDS 
} from '../data/projectData';

export default function OverviewDashboardView({ onInspectReport, onNavigateToAlert, onTriggerToast }) {
  const [activeSignalWeight, setActiveSignalWeight] = useState(DEFAULT_WEIGHTS);
  const [selectedIndicator, setSelectedIndicator] = useState(null);

  // Statistics calculated from evaluated calls
  const totalCalls = 1420;
  const highRiskCalls = 312;
  const suspiciousCalls = 485;
  const safeCalls = 623;
  const spoofVoiceDetected = 289;
  const guardianPushesSent = 304;

  const indicatorCounts = {
    authority_impersonation: 268,
    urgency_fear: 304,
    payment_requests: 221,
    information_requests: 279,
    isolation_secrecy: 142,
    trust_manipulation: 195
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1480px] w-full mx-auto animate-in fade-in duration-300">
      {/* Hero Headline & Project Identity */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono-metric text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
              VOICE PHISHING EVALUATOR
            </span>
            <span className="font-mono-metric text-xs text-outline">
              Azure AI Integration &amp; AASIST Voice Anti-Spoofing
            </span>
          </div>
          <h2 className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface tracking-tight mt-1">
            Real-Time Multimodal Vishing Defense Matrix
          </h2>
          <p className="font-body-md text-sm text-on-surface-variant max-w-2xl mt-1">
            Continuous acoustic chunking (5–10s) with fused tri-signal verification: semantic LLM context, spectro-temporal voice graph attention, and regulatory caller reputation.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onTriggerToast('Running validation check across Azure AI Speech and AASIST model weights...')}
            className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-label-md text-sm font-semibold border border-outline-variant/30 transition-all flex items-center gap-2 shadow-xs"
          >
            <span className="material-symbols-outlined text-base text-primary">tune</span>
            <span>Validate Fusion Weights</span>
          </button>
          
          <button
            onClick={onNavigateToAlert}
            className="px-4 py-2 bg-error text-on-error hover:brightness-110 active:scale-95 rounded-xl font-label-md text-sm font-semibold transition-all flex items-center gap-2 shadow-sm shadow-error/20"
          >
            <span className="material-symbols-outlined text-base">crisis_alert</span>
            <span>Simulate Real-Time Warning</span>
          </button>
        </div>
      </div>

      {/* Top 4 Core Metrics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Evaluated Calls */}
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline">
            <span className="font-mono-metric text-xs font-semibold uppercase tracking-wider">Total Evaluated Calls</span>
            <span className="material-symbols-outlined text-primary text-xl">perm_phone_msg</span>
          </div>
          <div className="my-2">
            <span className="font-display-lg text-3xl font-extrabold text-on-surface tracking-tight">1,420</span>
            <span className="text-xs text-outline ml-2">all input sources</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-tertiary">{safeCalls} Safe</span>
            <span className="text-outline">•</span>
            <span className="text-amber-600">{suspiciousCalls} Suspicious</span>
            <span className="text-outline">•</span>
            <span className="text-error">{highRiskCalls} High Risk</span>
          </div>
        </div>

        {/* Metric 2: AASIST Synthetic Voice Intercepts */}
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline">
            <span className="font-mono-metric text-xs font-semibold uppercase tracking-wider">AASIST Voice Spoofs</span>
            <span className="material-symbols-outlined text-amber-600 text-xl">network_intelligence</span>
          </div>
          <div className="my-2">
            <span className="font-display-lg text-3xl font-extrabold text-amber-600 tracking-tight">{spoofVoiceDetected}</span>
            <span className="text-xs text-outline ml-2">IndicSynth matches</span>
          </div>
          <div className="text-xs text-on-surface-variant">
            Graph Attention neural detection of AI clones &amp; synthetic speech
          </div>
        </div>

        {/* Metric 3: Azure AI Semantic Scam Flags */}
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline">
            <span className="font-mono-metric text-xs font-semibold uppercase tracking-wider">Azure AI Scam Hits</span>
            <span className="material-symbols-outlined text-purple-600 text-xl">psychology</span>
          </div>
          <div className="my-2">
            <span className="font-display-lg text-3xl font-extrabold text-purple-700 tracking-tight">797</span>
            <span className="text-xs text-outline ml-2">across 6 criteria</span>
          </div>
          <div className="text-xs text-on-surface-variant">
            Speech-to-Text (Hindi/Eng/Hinglish) + GPT-4o context reasoning
          </div>
        </div>

        {/* Metric 4: Firebase Guardian Notifications */}
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline">
            <span className="font-mono-metric text-xs font-semibold uppercase tracking-wider">Guardian Push Dispatches</span>
            <span className="material-symbols-outlined text-error text-xl">emergency_share</span>
          </div>
          <div className="my-2">
            <span className="font-display-lg text-3xl font-extrabold text-error tracking-tight">{guardianPushesSent}</span>
            <span className="text-xs text-outline ml-2">FCM Delivered</span>
          </div>
          <div className="text-xs text-on-surface-variant">
            Automated push to pre-registered guardian for risk &ge; 70%
          </div>
        </div>
      </div>

      {/* THE 3 INDEPENDENT SIGNALS SECTION (Core Architecture Highlight) */}
      <section className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h3 className="font-title text-lg font-bold text-on-surface">
                The Three Independent Assessment Signals &amp; Risk Fusion
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Weighted formula: <code className="bg-surface-container px-2 py-0.5 rounded font-mono-metric text-[11px] font-semibold text-on-surface">
                Final Risk = (w1 × Conversation) + (w2 × AASIST Spoof) + (w3 × Caller Reputation)
              </code>
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono-metric">
            <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold">w1 = 0.50</span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 font-bold">w2 = 0.30</span>
            <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-700 font-bold">w3 = 0.20</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Signal 1 Card */}
          <div className="p-5 rounded-2xl bg-surface-container-low border border-purple-500/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 text-[10px] font-mono-metric font-bold bg-purple-500/15 text-purple-700 rounded-full">
                  SIGNAL 1 (w1 = 50%)
                </span>
                <span className="material-symbols-outlined text-purple-600">psychology</span>
              </div>
              <h4 className="font-bold text-on-surface text-base">Conversation Analysis</h4>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                <strong>Azure AI Speech</strong> converts 5–10s chunks into text in Hindi, English, and Hinglish. 
                <strong> Azure AI Foundry (GPT-4o)</strong> evaluates the conversation context against the 6 Phishing Indicators.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
              <span className="text-outline">Engine:</span>
              <span className="font-mono-metric font-semibold text-purple-700">Azure Speech + Foundry</span>
            </div>
          </div>

          {/* Signal 2 Card */}
          <div className="p-5 rounded-2xl bg-surface-container-low border border-amber-500/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 text-[10px] font-mono-metric font-bold bg-amber-500/15 text-amber-700 rounded-full">
                  SIGNAL 2 (w2 = 30%)
                </span>
                <span className="material-symbols-outlined text-amber-600">graphic_eq</span>
              </div>
              <h4 className="font-bold text-on-surface text-base">Voice Authenticity (AASIST)</h4>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Integrated Spectro-Temporal Graph Attention Network distinguishing genuine speech from synthetic / voice-converted clones. 
                Trained on <strong>AI4Bharat IndicVoices-R</strong> &amp; <strong>IndicSynth</strong>.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
              <span className="text-outline">Output:</span>
              <span className="font-mono-metric font-semibold text-amber-700">Bona-fide vs Spoof Prob.</span>
            </div>
          </div>

          {/* Signal 3 Card */}
          <div className="p-5 rounded-2xl bg-surface-container-low border border-teal-500/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 text-[10px] font-mono-metric font-bold bg-teal-500/15 text-teal-700 rounded-full">
                  SIGNAL 3 (w3 = 20%)
                </span>
                <span className="material-symbols-outlined text-teal-600">verified_user</span>
              </div>
              <h4 className="font-bold text-on-surface text-base">Caller Reputation Service</h4>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Queried once at call inception. Analyzes country codes (+91), cross-references the 
                <strong> TRAI / DoT Scam Registry</strong> (Sanchar Saathi / Chakshu), and aggregates community complaints.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
              <span className="text-outline">Query Trigger:</span>
              <span className="font-mono-metric font-semibold text-teal-700">Once at Call Start</span>
            </div>
          </div>
        </div>

        {/* Risk Threshold Scale */}
        <div className="mt-6 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/25">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono-metric font-bold text-outline uppercase tracking-wider">
              Section 7.1 Risk Classification Scale
            </span>
            <span className="text-xs text-outline">Automated threshold triggers warning at &ge; 0.70</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-tertiary/10 border border-tertiary/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-tertiary text-on-tertiary flex items-center justify-center font-bold text-sm">
                S
              </div>
              <div>
                <div className="font-bold text-xs text-tertiary font-mono-metric">0.00 – 0.39 : SAFE</div>
                <div className="text-[11px] text-on-surface-variant">Real human speech, no coercive indicators</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-sm">
                !
              </div>
              <div>
                <div className="font-bold text-xs text-amber-700 font-mono-metric">0.40 – 0.69 : SUSPICIOUS</div>
                <div className="text-[11px] text-on-surface-variant">Elevated caution; monitoring continuation</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-error text-white flex items-center justify-center font-bold text-sm">
                ▲
              </div>
              <div>
                <div className="font-bold text-xs text-error font-mono-metric">0.70 – 1.00 : HIGH RISK</div>
                <div className="text-[11px] text-on-surface-variant">Immediate Warning HUD + Guardian FCM Push</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE 6 PHISHING INDICATORS BENTO GRID */}
      <section className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20 mb-5">
          <div>
            <h3 className="font-title text-lg font-bold text-on-surface">
              Section 3.2: The Six Phishing Indicators (Azure AI Foundry / LLM)
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Evaluated contextually by GPT-4o beyond keyword matching. Click any card to review telemetry hits.
            </p>
          </div>
          <span className="text-xs font-mono-metric text-outline bg-surface-container px-3 py-1 rounded-full">
            Criterion-Wise Scoring
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PHISHING_INDICATORS_SCHEMA.map((ind) => {
            const count = indicatorCounts[ind.id] || 0;
            const isSelected = selectedIndicator === ind.id;
            return (
              <div
                key={ind.id}
                onClick={() => setSelectedIndicator(isSelected ? null : ind.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm' 
                    : 'border-outline-variant/25 bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-lg">{ind.icon}</span>
                  </div>
                  <span className="text-xs font-mono-metric font-bold text-on-surface bg-surface-container px-2 py-0.5 rounded">
                    {count} Incidents
                  </span>
                </div>
                <h4 className="font-bold text-xs text-on-surface">{ind.name}</h4>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{ind.desc}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-outline font-mono-metric">
                  <span>Weight in LLM: Active</span>
                  <span className="text-primary font-semibold">Inspect evidence &rarr;</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* RECENT EVALUATED CALLS STREAM (PostgreSQL Audit Mirror) */}
      <section className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20 mb-4">
          <div>
            <h3 className="font-title text-lg font-bold text-on-surface">
              Post-Call Analytics &amp; PostgreSQL Records (Section 9)
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Structured evaluation records stored in PostgreSQL with 3-signal decomposition.
            </p>
          </div>
          <button
            onClick={() => onInspectReport('CALL-2026-9102')}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>View Full Incident History</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-outline-variant/25 text-outline font-mono-metric uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Call ID / Time</th>
                <th className="py-2.5 px-3">Caller Identifier</th>
                <th className="py-2.5 px-3">Detected Language</th>
                <th className="py-2.5 px-3">Conversation (w1)</th>
                <th className="py-2.5 px-3">AASIST Voice (w2)</th>
                <th className="py-2.5 px-3">Reputation (w3)</th>
                <th className="py-2.5 px-3">Final Risk</th>
                <th className="py-2.5 px-3">Classification</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15 font-body-md">
              {POSTGRESQL_CALL_RECORDS.map((rec) => {
                const isHigh = rec.riskLevel === 'HIGH RISK';
                const isSuspicious = rec.riskLevel === 'SUSPICIOUS';
                const badgeColor = isHigh 
                  ? 'bg-error/10 text-error border-error/20' 
                  : isSuspicious 
                  ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' 
                  : 'bg-tertiary/10 text-tertiary border-tertiary/20';

                return (
                  <tr key={rec.callId} className="hover:bg-surface-container-low/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-mono-metric font-bold text-on-surface">{rec.callId}</div>
                      <div className="text-[11px] text-outline">{rec.timestamp.split(' ')[1]} IST</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono-metric text-on-surface font-medium">{rec.callerNumber}</div>
                      <div className="text-[11px] text-outline">{rec.inputSource}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-mono-metric text-[10px]">
                        {rec.language.split(' ')[0]}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono-metric text-purple-700 font-semibold">
                      {(rec.conversationScore * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-3 font-mono-metric text-amber-700 font-semibold">
                      {(rec.aasistScore * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-3 font-mono-metric text-teal-700 font-semibold">
                      {(rec.reputationScore * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-mono-metric font-bold text-on-surface">
                        <span>{(rec.finalRisk * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-16 bg-surface-container-highest rounded-full h-1 mt-1 overflow-hidden">
                        <div 
                          className={`h-1 rounded-full ${isHigh ? 'bg-error' : isSuspicious ? 'bg-amber-500' : 'bg-tertiary'}`}
                          style={{ width: `${rec.finalRisk * 100}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-metric font-bold border ${badgeColor}`}>
                        {rec.riskLevel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onInspectReport(rec.callId)}
                        className="px-2.5 py-1 bg-surface-container hover:bg-primary hover:text-on-primary rounded-lg font-label-md text-xs font-semibold text-on-surface transition-all"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
