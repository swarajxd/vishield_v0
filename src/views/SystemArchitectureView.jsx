import React, { useState } from 'react';
import { SYSTEM_ARCHITECTURE_STEPS } from '../data/projectData';

export default function SystemArchitectureView({ onNavigateToLive, onTriggerToast }) {
  const [activeStep, setActiveStep] = useState(1);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0);

  const startSimulation = () => {
    setSimulationRunning(true);
    setSimulationStep(1);
    onTriggerToast('Starting end-to-end Voice Phishing Evaluator pipeline simulation...');
    
    let current = 1;
    const interval = setInterval(() => {
      current += 1;
      if (current <= 8) {
        setSimulationStep(current);
        setActiveStep(current);
      } else {
        clearInterval(interval);
        setSimulationRunning(false);
        onTriggerToast('Simulation complete: Call classified as HIGH RISK (87%), Guardian push dispatched via Firebase!');
      }
    }, 1800);
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1480px] w-full mx-auto animate-in fade-in duration-300">
      {/* Header / Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono-metric text-xs font-semibold">
              SYSTEM ARCHITECTURE SPECIFICATION
            </span>
            <span className="text-xs text-outline font-mono-metric">Azure AI + AASIST Engine</span>
          </div>
          <h2 className="font-headline-md text-2xl sm:text-3xl font-bold tracking-tight text-on-surface mt-1">
            Voice Phishing Evaluator — End-to-End System Pipeline
          </h2>
          <p className="font-body-md text-sm text-on-surface-variant max-w-3xl mt-1">
            A real-time AI security architecture that assesses phone conversations across three independent signals: 
            <strong> Conversation Analysis</strong>, <strong>Voice Authenticity Analysis</strong>, and <strong>Caller Reputation</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={startSimulation}
            disabled={simulationRunning}
            className={`px-4 py-2.5 rounded-xl font-label-md text-sm font-semibold transition-all flex items-center gap-2 shadow-sm ${
              simulationRunning
                ? 'bg-amber-500/20 text-amber-700 border border-amber-500/30 cursor-wait'
                : 'bg-primary text-on-primary hover:brightness-105 active:scale-95'
            }`}
          >
            <span className={`material-symbols-outlined text-lg ${simulationRunning ? 'animate-spin' : ''}`}>
              {simulationRunning ? 'autorenew' : 'play_circle'}
            </span>
            <span>{simulationRunning ? `Simulating Step ${simulationStep}/8...` : 'Simulate Call Flow'}</span>
          </button>

          <button
            onClick={onNavigateToLive}
            className="px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-label-md text-sm font-semibold border border-outline-variant/30 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-lg text-primary">graphic_eq</span>
            <span>Open Live Monitor</span>
          </button>
        </div>
      </div>

      {/* Interactive Visual System Architecture Canvas (Matching Page 1 Diagram) */}
      <section className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/30 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary animate-pulse"></span>
            <h3 className="font-title text-lg font-bold text-on-surface">
              Interactive System Block Diagram (Page 1 Specification)
            </h3>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-label-sm">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 border border-blue-500/20">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span> Speech Processing
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-600"></span> Voice Analysis (AASIST)
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 border border-purple-500/20">
              <span className="w-2 h-2 rounded-full bg-purple-600"></span> AI / Intelligence (LLM)
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Risk Fusion Engine
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 text-rose-700 border border-rose-500/20">
              <span className="w-2 h-2 rounded-full bg-rose-600"></span> Warning & Guardian
            </span>
          </div>
        </div>

        {/* Diagram Flow Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch relative">
          
          {/* COLUMN 1: INPUT SOURCES & AUDIO CAPTURE (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Input Sources Box */}
            <div className={`p-4 rounded-2xl border transition-all ${
              simulationStep === 1 ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md' : 'border-outline-variant/30 bg-surface-container-low'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono-metric font-bold text-outline uppercase tracking-wider">
                  Input Sources
                </span>
                <span className="material-symbols-outlined text-primary text-sm">settings_input_antenna</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
                  <span className="material-symbols-outlined text-primary text-base">phone_in_talk</span>
                  <span className="font-medium text-on-surface">Live Call (Speakerphone)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
                  <span className="material-symbols-outlined text-secondary text-base">upload_file</span>
                  <span className="font-medium text-on-surface">Uploaded Recording (.wav)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
                  <span className="material-symbols-outlined text-tertiary text-base">mic</span>
                  <span className="font-medium text-on-surface">Voice Note</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
                  <span className="material-symbols-outlined text-amber-600 text-base">wifi_calling</span>
                  <span className="font-medium text-on-surface">Simulated VoIP Call</span>
                </div>
              </div>
            </div>

            {/* Down arrow connector */}
            <div className="flex justify-center text-outline">
              <span className="material-symbols-outlined">south</span>
            </div>

            {/* Audio Capture Module */}
            <div className={`p-4 rounded-2xl border transition-all ${
              simulationStep === 2 ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md' : 'border-outline-variant/30 bg-surface-container-low'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono-metric font-bold text-outline uppercase tracking-wider">
                  Audio Capture Module
                </span>
                <span className="material-symbols-outlined text-blue-600 text-sm">graphic_eq</span>
              </div>
              <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-center">
                <div className="flex items-center justify-center gap-1 my-1">
                  <div className="w-1 h-4 bg-primary rounded-full animate-pulse"></div>
                  <div className="w-1 h-7 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-9 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                  <div className="w-1 h-8 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  <div className="w-1 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                </div>
                <div className="font-semibold text-xs text-on-surface mt-1">Chunking (5–10 sec)</div>
                <div className="text-[11px] text-outline">Streaming Audio Chunks for Real-time</div>
              </div>
            </div>

            {/* Connector to Caller Reputation (Once at start) */}
            <div className="p-3 bg-teal-500/5 rounded-xl border border-teal-500/20 text-xs">
              <div className="flex items-center gap-1.5 text-teal-700 font-semibold mb-1">
                <span className="material-symbols-outlined text-sm">manage_search</span>
                <span>Once at Call Start</span>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Caller number lookup routed directly to Caller Reputation Service.
              </p>
            </div>
          </div>

          {/* COLUMN 2: PARALLEL AUDIO PROCESSING PIPELINES (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-4 rounded-2xl border border-outline-variant/40 bg-surface-container-low flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                <span className="text-[11px] font-mono-metric font-bold text-outline uppercase tracking-wider">
                  Parallel Audio Processing
                </span>
                <span className="px-2 py-0.5 text-[10px] bg-primary/10 text-primary font-bold rounded-full">
                  SIMULTANEOUS
                </span>
              </div>

              {/* Branch 1: Azure AI Speech + LLM */}
              <div className={`p-4 rounded-xl border transition-all ${
                simulationStep === 3 || simulationStep === 4 ? 'border-purple-500 bg-purple-500/5 ring-2 ring-purple-500/20 shadow-md' : 'border-outline-variant/20 bg-surface-container-lowest'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-purple-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">record_voice_over</span>
                    Azure AI Speech Service
                  </span>
                  <span className="text-[10px] font-mono-metric text-outline">Branch 1</span>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-2">
                  Speech-to-Text: <strong>Hindi / English / Hinglish</strong> with Language Tags.
                </p>

                {/* Running Transcript Buffer */}
                <div className="p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/20 mb-3">
                  <div className="flex items-center justify-between text-[11px] font-mono-metric font-semibold text-outline mb-1">
                    <span>RUNNING TRANSCRIPT BUFFER</span>
                    <span className="text-secondary text-[10px]">Redis Cache</span>
                  </div>
                  <div className="text-[11px] text-on-surface italic bg-surface-container-lowest p-2 rounded border border-outline-variant/20">
                    "Sir, your account will be blocked, please verify your OTP..."
                  </div>
                </div>

                {/* Scam Detection Engine (Azure AI Foundry / GPT-4o) */}
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/25">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-purple-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">psychology</span>
                      Scam Detection Engine (LLM)
                    </span>
                    <span className="text-[10px] font-mono-metric text-purple-700">Azure AI Foundry (GPT-4o)</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mb-2">
                    Keyword &amp; pattern matching (OTP, Transfer, Arrest, Bank, UPI) + 6 Phishing Indicators:
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span className="p-1 rounded bg-surface-container-lowest border border-outline-variant/20 text-on-surface">1. Authority Impersonation</span>
                    <span className="p-1 rounded bg-surface-container-lowest border border-outline-variant/20 text-on-surface">2. Urgency / Fear Tactics</span>
                    <span className="p-1 rounded bg-surface-container-lowest border border-outline-variant/20 text-on-surface">3. Payment / Money Requests</span>
                    <span className="p-1 rounded bg-surface-container-lowest border border-outline-variant/20 text-on-surface">4. Information (OTP/PIN)</span>
                    <span className="p-1 rounded bg-surface-container-lowest border border-outline-variant/20 text-on-surface">5. Isolation / Secrecy</span>
                    <span className="p-1 rounded bg-surface-container-lowest border border-outline-variant/20 text-on-surface">6. Trust Manipulation</span>
                  </div>
                  <div className="mt-2 text-right">
                    <span className="text-[11px] font-mono-metric font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                      Returns: S_conv (0.95)
                    </span>
                  </div>
                </div>
              </div>

              {/* Branch 2: AASIST Model */}
              <div className={`p-4 rounded-xl border transition-all ${
                simulationStep === 5 ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20 shadow-md' : 'border-outline-variant/20 bg-surface-container-lowest'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-amber-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">network_intelligence</span>
                    AASIST Model (Voice Authenticity)
                  </span>
                  <span className="text-[10px] font-mono-metric text-outline">Branch 2</span>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-2">
                  Audio Anti-Spoofing via Integrated Spectro-Temporal Graph Attention Networks.
                </p>
                <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/25 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-amber-900">Trained on AI4Bharat IndicVoices-R &amp; IndicSynth</div>
                    <div className="text-[10px] text-amber-800">Spectro-Temporal Feature Aggregation &amp; Classification</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono-metric font-bold">
                      Bona-fide: 0.10
                    </span>
                    <span className="px-2 py-1 rounded bg-error-container text-error text-[10px] font-mono-metric font-bold">
                      Spoof: 0.90
                    </span>
                  </div>
                </div>
              </div>

              {/* Branch 3: Caller Reputation Service */}
              <div className={`p-3 rounded-xl border transition-all ${
                simulationStep === 6 ? 'border-teal-500 bg-teal-500/5 ring-2 ring-teal-500/20 shadow-md' : 'border-outline-variant/20 bg-surface-container-lowest'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-teal-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">verified_user</span>
                    Caller Reputation Service
                  </span>
                  <span className="text-[10px] font-mono-metric text-outline">Branch 3</span>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] mt-1 text-on-surface-variant">
                  <span className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant/20">Country Code (+91)</span>
                  <span className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant/20">TRAI / DoT Database</span>
                  <span className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant/20">Community Reports</span>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-[11px] font-mono-metric font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                    Returns: S_rep (0.85)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 3: RISK FUSION ENGINE & OUTPUTS (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Risk Fusion Engine Box */}
            <div className={`p-5 rounded-2xl border transition-all ${
              simulationStep === 7 ? 'border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-md' : 'border-emerald-500/30 bg-emerald-500/5'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono-metric font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">balance</span>
                  Risk Fusion Engine
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-800 text-[10px] font-mono-metric font-bold">
                  WEIGHTED SUM
                </span>
              </div>
              
              <div className="p-3 bg-surface-container-lowest rounded-xl border border-emerald-500/30 text-xs font-mono-metric space-y-1">
                <div className="text-on-surface font-semibold text-[11px]">
                  Final Risk = w1×S_conv + w2×S_voice + w3×S_rep
                </div>
                <div className="text-[10px] text-outline">
                  = (0.50 × 0.95) + (0.30 × 0.90) + (0.20 × 0.85)
                </div>
                <div className="text-sm font-bold text-error pt-1 border-t border-outline-variant/20 flex items-center justify-between">
                  <span>Calculated Risk:</span>
                  <span>91.5% (HIGH RISK)</span>
                </div>
              </div>

              {/* Thresholds Pill */}
              <div className="grid grid-cols-3 gap-1 mt-3 text-center text-[10px] font-mono-metric font-bold">
                <div className="p-1 rounded bg-tertiary/10 text-tertiary border border-tertiary/20">
                  SAFE<br/>0.00 – 0.39
                </div>
                <div className="p-1 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">
                  SUSPICIOUS<br/>0.40 – 0.69
                </div>
                <div className="p-1 rounded bg-error/10 text-error border border-error/20 ring-1 ring-error/30">
                  HIGH RISK<br/>0.70 – 1.00
                </div>
              </div>
            </div>

            {/* Downward / Outward connectors */}
            <div className="flex items-center justify-center text-outline">
              <span className="material-symbols-outlined">south</span>
            </div>

            {/* Action & Downstream Safeguards */}
            <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
              simulationStep === 8 ? 'border-error bg-error/5 ring-2 ring-error/20 shadow-md' : 'border-outline-variant/30 bg-surface-container-low'
            }`}>
              <span className="text-[11px] font-mono-metric font-bold text-outline uppercase tracking-wider block">
                Real-Time Actions &amp; Storage
              </span>

              {/* Real-time Warning */}
              <div className="p-3 bg-surface-container-lowest rounded-xl border border-error/30 text-xs">
                <div className="flex items-center gap-1.5 text-error font-bold mb-1">
                  <span className="material-symbols-outlined text-sm">crisis_alert</span>
                  <span>User Warning (Real-Time)</span>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  On-screen alert HUD, dynamic risk level indicator, actionable safety tips.
                </p>
              </div>

              {/* Guardian Notification */}
              <div className="p-3 bg-surface-container-lowest rounded-xl border border-amber-500/30 text-xs">
                <div className="flex items-center gap-1.5 text-amber-700 font-bold mb-1">
                  <span className="material-symbols-outlined text-sm">emergency_share</span>
                  <span>Guardian Notification (Firebase)</span>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Push notification via Firebase Cloud Messaging (FCM) to pre-registered guardian with audio snippet &amp; risk level.
                </p>
              </div>

              {/* PostgreSQL Data Storage */}
              <div className="p-3 bg-surface-container-lowest rounded-xl border border-indigo-500/30 text-xs">
                <div className="flex items-center gap-1.5 text-indigo-700 font-bold mb-1">
                  <span className="material-symbols-outlined text-sm">database</span>
                  <span>PostgreSQL Data Storage</span>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Structured post-call report: Call ID, timestamp, caller ID, duration, language, 3 scores, risk tier, detected indicators.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Step-by-Step Complete Algorithm (Section 10 of PDF) */}
      <section className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/30 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 mb-4">
          <div>
            <h3 className="font-title text-lg font-bold text-on-surface">
              Section 10: Complete System Algorithm (12 Steps)
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              The continuous real-time execution cycle of the Voice Phishing Evaluator.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-mono-metric text-xs font-bold">
            12-STAGE PIPELINE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { n: 1, title: 'Capture Audio', desc: 'Capture live-call (speakerphone) or recorded audio input.' },
            { n: 2, title: 'Chunk Stream', desc: 'Divide audio stream into short 5–10s chunks for continuous processing.' },
            { n: 3, title: 'Parallel Routing', desc: 'Send each chunk simultaneously to speech-analysis and AASIST anti-spoofing pipelines.' },
            { n: 4, title: 'Azure AI Speech STT', desc: 'Convert audio into text and identify language (Hindi / English / Hinglish).' },
            { n: 5, title: 'Transcript Buffer', desc: 'Maintain recent transcript context using Redis running transcript buffer.' },
            { n: 6, title: 'Pattern Matching', desc: 'Apply keyword, phrase, and pattern matching for obvious phishing triggers.' },
            { n: 7, title: 'Azure AI Foundry LLM', desc: 'Use GPT-4o to analyze semantic meaning, context, and 6 Phishing Indicators.' },
            { n: 8, title: 'AASIST Model Scoring', desc: 'Estimate probability that voice is genuine (Bona-fide) or spoofed.' },
            { n: 9, title: 'Caller Reputation Check', desc: 'Check caller number against country code, TRAI / DoT database, and reports.' },
            { n: 10, title: 'Risk Fusion Engine', desc: 'Fuse conversation score, AASIST spoof score, and caller reputation score.' },
            { n: 11, title: 'Risk Classification', desc: 'Classify call as Safe (0-0.39), Suspicious (0.40-0.69), or High Risk (0.70-1.00).' },
            { n: 12, title: 'Real-Time Warning', desc: 'Display immediate warning and notify guardian via Firebase Cloud Messaging.' },
          ].map((item) => (
            <div
              key={item.n}
              onClick={() => setActiveStep(item.n)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                activeStep === item.n
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs'
                  : 'border-outline-variant/25 bg-surface-container-low hover:bg-surface-container'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono-metric text-xs font-bold ${
                  activeStep === item.n ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface'
                }`}>
                  {item.n}
                </span>
                <span className="font-semibold text-xs text-on-surface truncate">{item.title}</span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
