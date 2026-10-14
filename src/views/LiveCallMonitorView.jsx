import React, { useState, useEffect, useRef } from 'react';
import { 
  CALL_SCENARIOS, 
  DEFAULT_WEIGHTS, 
  PHISHING_INDICATORS_SCHEMA, 
  RISK_THRESHOLDS 
} from '../data/projectData';

export default function LiveCallMonitorView({ onEndCall, onNotifyGuardian, onTriggerToast, onNavigateToAlert }) {
  // Input Source selection: 1. Live Call (Speakerphone), 2. Uploaded Recording, 3. Voice Note, 4. Simulated VoIP Call
  const [selectedSource, setSelectedSource] = useState('Simulated VoIP Call');
  const [activeScenarioId, setActiveScenarioId] = useState('scenario-bank-kyc');
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [autoProgress, setAutoProgress] = useState(true);

  // Fusion Weights (Section 7: w1=0.50, w2=0.30, w3=0.20)
  const [w1, setW1] = useState(DEFAULT_WEIGHTS.w1_conversation);
  const [w2, setW2] = useState(DEFAULT_WEIGHTS.w2_aasist);
  const [w3, setW3] = useState(DEFAULT_WEIGHTS.w3_reputation);

  // Active scenario data
  const scenario = CALL_SCENARIOS.find(s => s.id === activeScenarioId) || CALL_SCENARIOS[0];
  const chunks = scenario.simulatedAudioChunks;
  const currentChunk = chunks[Math.min(currentChunkIndex, chunks.length - 1)];

  // Live Scores derived from active chunk
  const conversationScore = currentChunk?.azureLlm?.scamScore ?? scenario.initialScores.conversationScore;
  const aasistSpoofScore = currentChunk?.aasist?.spoof ?? scenario.initialScores.aasistSpoofScore;
  const aasistBonafideScore = currentChunk?.aasist?.bonafide ?? (1 - aasistSpoofScore);
  const reputationScore = scenario.initialScores.callerReputationScore;

  // Weighted Risk Calculation: Final Risk = w1*C + w2*V + w3*R
  const totalWeight = (w1 + w2 + w3) || 1;
  const finalRisk = ((w1 * conversationScore) + (w2 * aasistSpoofScore) + (w3 * reputationScore)) / totalWeight;
  const finalRiskPercent = (finalRisk * 100).toFixed(1);

  // Risk Classification (Section 7.1)
  let classification = 'SAFE';
  let badgeClasses = 'bg-tertiary/10 text-tertiary border-tertiary/20';
  let barColor = 'bg-tertiary';

  if (finalRisk >= RISK_THRESHOLDS.highRisk.min) {
    classification = 'HIGH RISK';
    badgeClasses = 'bg-error/10 text-error border-error/20';
    barColor = 'bg-error';
  } else if (finalRisk >= RISK_THRESHOLDS.suspicious.min) {
    classification = 'SUSPICIOUS';
    badgeClasses = 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    barColor = 'bg-amber-500';
  }

  // Timer & Chunk simulation interval
  useEffect(() => {
    let timer = null;
    if (isCallActive) {
      timer = setInterval(() => {
        setSecondsElapsed(prev => {
          const next = prev + 1;
          // Step chunk every 6 seconds (representing 5-10s streaming chunks from Section 2.1)
          if (autoProgress && next % 6 === 0) {
            setCurrentChunkIndex(c => (c + 1) % chunks.length);
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isCallActive, autoProgress, chunks.length]);

  const handleStartCall = () => {
    setIsCallActive(true);
    setSecondsElapsed(0);
    setCurrentChunkIndex(0);
    onTriggerToast(`Audio Capture initiated via ${selectedSource}. Streaming 5–10s chunks to Azure Speech & AASIST.`);
  };

  const handleStopCall = () => {
    setIsCallActive(false);
    onEndCall();
    onTriggerToast('Call session closed. Generating structured report and storing in PostgreSQL...');
  };

  const handleNextChunk = () => {
    setCurrentChunkIndex(prev => (prev + 1) % chunks.length);
    onTriggerToast(`Processed incoming chunk ${(currentChunkIndex + 1) % chunks.length + 1} / ${chunks.length}`);
  };

  const formatTimer = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1520px] w-full mx-auto animate-in fade-in duration-300">
      
      {/* Top Banner / Call State Bar */}
      <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/30 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm ${
            isCallActive ? 'bg-primary animate-pulse' : 'bg-surface-container-highest text-outline'
          }`}>
            <span className="material-symbols-outlined text-2xl">
              {isCallActive ? 'phone_in_talk' : 'phone_paused'}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono-metric font-bold border ${
                isCallActive ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-container text-outline border-outline-variant/30'
              }`}>
                {isCallActive ? 'STREAMING ACTIVE' : 'STREAM IDLE'}
              </span>
              <span className="font-mono-metric text-xs text-outline">
                {isCallActive ? `Duration: ${formatTimer(secondsElapsed)}` : 'Ready to capture'}
              </span>
              <span className="font-mono-metric text-xs text-outline">• Chunking: 5–10s window</span>
            </div>
            <h2 className="font-headline-sm text-xl font-bold text-on-surface tracking-tight mt-0.5">
              Live Call Monitor: {scenario.title}
            </h2>
          </div>
        </div>

        {/* Master Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Preset Selector */}
          <select
            value={activeScenarioId}
            onChange={(e) => {
              setActiveScenarioId(e.target.value);
              setCurrentChunkIndex(0);
              setSecondsElapsed(0);
            }}
            className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl font-label-md text-xs text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {CALL_SCENARIOS.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>

          {isCallActive ? (
            <>
              <button
                onClick={handleNextChunk}
                className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-label-md text-xs font-semibold border border-outline-variant/30 flex items-center gap-1.5 transition-all"
                title="Step to next 5-10s streaming chunk"
              >
                <span className="material-symbols-outlined text-base">skip_next</span>
                <span>Next Chunk ({currentChunkIndex + 1}/{chunks.length})</span>
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 rounded-xl border transition-all ${
                  isMuted 
                    ? 'bg-amber-500/10 text-amber-700 border-amber-500/30' 
                    : 'bg-surface-container-high text-on-surface border-outline-variant/30'
                }`}
                title={isMuted ? 'Unmute Audio Stream' : 'Mute Audio Stream'}
              >
                <span className="material-symbols-outlined text-base">
                  {isMuted ? 'mic_off' : 'mic'}
                </span>
              </button>

              <button
                onClick={handleStopCall}
                className="px-4 py-2 bg-error text-on-error hover:brightness-110 active:scale-95 rounded-xl font-label-md text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-error/20"
              >
                <span className="material-symbols-outlined text-base">call_end</span>
                <span>Disconnect Call</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleStartCall}
              className="px-5 py-2.5 bg-primary text-on-primary hover:brightness-105 active:scale-95 rounded-xl font-label-md text-sm font-bold transition-all flex items-center gap-2 shadow-sm shadow-primary/20"
            >
              <span className="material-symbols-outlined text-lg">play_arrow</span>
              <span>Start Audio Capture</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-Time Critical Alert Banner (Appears when High Risk is triggered) */}
      {finalRisk >= 0.70 && (
        <div className="p-4 rounded-2xl bg-error/10 border border-error/30 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-error text-white flex items-center justify-center shrink-0 shadow-md">
              <span className="material-symbols-outlined text-xl">crisis_alert</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-error text-sm uppercase tracking-wide">
                  HIGH-RISK CALL DETECTED ({finalRiskPercent}%)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-error text-white text-[10px] font-mono-metric font-bold">
                  THRESHOLD EXCEEDED
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Multi-signal fusion identified active coercive patterns &amp; synthetic voice clone indicators.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNotifyGuardian(scenario.guardianNotification)}
              className="px-3.5 py-1.5 bg-error text-on-error hover:brightness-105 rounded-xl font-label-md text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-sm">emergency_share</span>
              <span>Notify Guardian (Firebase)</span>
            </button>
            <button
              onClick={onNavigateToAlert}
              className="px-3.5 py-1.5 bg-surface-container-lowest hover:bg-surface-container text-error border border-error/30 rounded-xl font-label-md text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              <span>Open Warning HUD</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN 3-COLUMN WORKSPACE: Signals & Pipelines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMN 1 (4 cols): Audio Capture Module & Azure AI Speech STT */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Audio Capture Box (Section 2.1) */}
          <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
              <span className="font-mono-metric text-xs font-bold text-outline uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">mic</span>
                Audio Capture Module
              </span>
              <span className="text-[11px] font-mono-metric text-primary font-semibold">
                Chunk #{currentChunkIndex + 1} (5–10s)
              </span>
            </div>

            {/* Input Source Selector (Section 2.1) */}
            <div className="space-y-1.5 mb-4">
              <label className="text-[11px] font-mono-metric font-semibold text-outline uppercase">
                Input Source Mode:
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {[
                  { id: 'Live Call (Speakerphone)', icon: 'phone_in_talk' },
                  { id: 'Uploaded Recording', icon: 'upload_file' },
                  { id: 'Voice Note', icon: 'mic' },
                  { id: 'Simulated VoIP Call', icon: 'wifi_calling' },
                ].map(src => (
                  <button
                    key={src.id}
                    onClick={() => setSelectedSource(src.id)}
                    className={`p-2 rounded-xl border text-left font-medium transition-all flex items-center gap-1.5 ${
                      selectedSource === src.id
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-outline-variant/25 bg-surface-container-low text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{src.icon}</span>
                    <span className="truncate">{src.id}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Animated Audio Spectrogram / Waveform */}
            <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/25 flex flex-col items-center justify-center">
              <div className="flex items-center justify-center gap-1 h-12 w-full">
                {[12, 28, 45, 18, 55, 36, 48, 22, 60, 42, 30, 52, 25, 40, 15, 32].map((h, i) => (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full transition-all duration-200 ${
                      isCallActive ? 'bg-primary animate-pulse' : 'bg-outline-variant/50'
                    }`}
                    style={{ 
                      height: isCallActive ? `${Math.max(8, (h + (currentChunkIndex * 6)) % 48)}px` : '6px',
                      animationDelay: `${i * 0.08}s`
                    }}
                  ></div>
                ))}
              </div>
              <div className="flex items-center justify-between w-full mt-2 text-[10px] font-mono-metric text-outline">
                <span>16 kHz PCM Mono</span>
                <span>Chunk Window: {currentChunk?.timestamp || '00:00'}</span>
                <span>Format: WAV</span>
              </div>
            </div>
          </div>

          {/* Running Transcript Buffer (Section 3.1 & 3.2) */}
          <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
              <div>
                <span className="font-mono-metric text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-purple-600 text-base">transcribe</span>
                  Running Transcript Buffer
                </span>
                <span className="text-[10px] text-outline font-mono-metric">Azure AI Speech + Redis Cache</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 font-mono-metric text-[10px] font-bold">
                {currentChunk?.language || 'Hinglish'}
              </span>
            </div>

            {/* Transcript Flow */}
            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {chunks.slice(0, currentChunkIndex + 1).map((chk, i) => {
                const isCurrent = i === currentChunkIndex;
                return (
                  <div 
                    key={i} 
                    className={`p-3 rounded-2xl border text-xs transition-all ${
                      isCurrent 
                        ? 'bg-purple-500/5 border-purple-500/30 ring-1 ring-purple-500/20' 
                        : 'bg-surface-container-low border-outline-variant/20 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono-metric text-[10px] text-outline mb-1">
                      <span>Chunk {i + 1} • {chk.timestamp}</span>
                      <span className="text-purple-700 font-semibold">{chk.language}</span>
                    </div>
                    <p className="text-on-surface leading-relaxed font-body-md">
                      {chk.text}
                    </p>
                    {chk.azureLlm?.indicators?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {chk.azureLlm.indicators.map(ind => (
                          <span key={ind} className="px-1.5 py-0.5 rounded bg-error/10 text-error text-[10px] font-mono-metric font-semibold">
                            flag: {ind.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMN 2 (4 cols): Azure AI Foundry LLM + AASIST Model */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Azure AI Foundry (GPT-4o) Phishing Analysis */}
          <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
              <div>
                <span className="font-mono-metric text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-purple-600 text-base">psychology</span>
                  Azure AI Foundry (GPT-4o)
                </span>
                <span className="text-[10px] text-outline font-mono-metric">Signal 1: Conversation Analysis</span>
              </div>
              <div className="text-right">
                <span className="font-mono-metric text-sm font-bold text-purple-800">
                  {(conversationScore * 100).toFixed(0)}%
                </span>
                <div className="text-[10px] text-outline">Scam Score</div>
              </div>
            </div>

            {/* Explanation box */}
            <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/25 mb-4 text-xs">
              <span className="font-mono-metric font-bold text-[10px] text-purple-800 uppercase block mb-1">
                Contextual LLM Reasoning:
              </span>
              <p className="text-purple-950 font-medium">
                {currentChunk?.azureLlm?.explanation || 'Awaiting initial speech chunk for semantic contextual reasoning.'}
              </p>
            </div>

            {/* The 6 Phishing Indicators live checklist */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono-metric font-bold text-outline uppercase">
                The 6 Phishing Indicators (Section 3.2):
              </span>
              {PHISHING_INDICATORS_SCHEMA.map(ind => {
                const isTriggered = currentChunk?.azureLlm?.indicators?.includes(ind.id);
                return (
                  <div
                    key={ind.id}
                    className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-all ${
                      isTriggered
                        ? 'bg-error/10 border-error/30 text-error font-semibold'
                        : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">{ind.icon}</span>
                      <span className="truncate">{ind.name}</span>
                    </div>
                    <span className="font-mono-metric text-[10px]">
                      {isTriggered ? 'DETECTED' : 'CLEAN'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AASIST Model: Voice Authenticity Analysis (Section 4 & 5) */}
          <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
              <div>
                <span className="font-mono-metric text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-600 text-base">network_intelligence</span>
                  AASIST Model Anti-Spoofing
                </span>
                <span className="text-[10px] text-outline font-mono-metric">Signal 2: Voice Authenticity</span>
              </div>
              <div className="text-right">
                <span className="font-mono-metric text-sm font-bold text-amber-700">
                  {(aasistSpoofScore * 100).toFixed(0)}%
                </span>
                <div className="text-[10px] text-outline">Spoof Probability</div>
              </div>
            </div>

            {/* Model Architecture Note */}
            <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/25 mb-3 text-xs">
              <div className="font-semibold text-amber-900 flex items-center justify-between">
                <span>Spectro-Temporal Graph Attention</span>
                <span className="text-[10px] font-mono-metric uppercase">IndicSynth Trained</span>
              </div>
              <p className="text-[11px] text-amber-800 mt-1">
                Identifies vocoder synthesis artifacts, jitter anomalies, and phase discontinuities.
              </p>
            </div>

            {/* Probability Breakdown Bar */}
            <div className="space-y-1.5 text-xs font-mono-metric">
              <div className="flex justify-between text-[11px]">
                <span className="text-tertiary font-bold">Bona-fide (Real): {(aasistBonafideScore * 100).toFixed(1)}%</span>
                <span className="text-error font-bold">Spoof (Clone): {(aasistSpoofScore * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-surface-container-highest rounded-full h-2.5 flex overflow-hidden">
                <div 
                  className="bg-tertiary transition-all duration-300"
                  style={{ width: `${aasistBonafideScore * 100}%` }}
                ></div>
                <div 
                  className="bg-error transition-all duration-300"
                  style={{ width: `${aasistSpoofScore * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs font-mono-metric">
              <span className="text-outline">Verdict:</span>
              <span className={`px-2 py-0.5 rounded font-bold ${
                aasistSpoofScore >= 0.70 ? 'bg-error/10 text-error' : 'bg-tertiary/10 text-tertiary'
              }`}>
                {currentChunk?.aasist?.verdict || 'AASIST READY'}
              </span>
            </div>
          </div>

        </div>

        {/* COLUMN 3 (4 cols): Caller Reputation & Risk Fusion Engine */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Signal 3: Caller Reputation Service (Section 6) */}
          <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
              <div>
                <span className="font-mono-metric text-xs font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-teal-600 text-base">verified_user</span>
                  Caller Reputation Service
                </span>
                <span className="text-[10px] text-outline font-mono-metric">Signal 3 (Checked Once at Call Start)</span>
              </div>
              <div className="text-right">
                <span className="font-mono-metric text-sm font-bold text-teal-700">
                  {(reputationScore * 100).toFixed(0)}%
                </span>
                <div className="text-[10px] text-outline">Reputation Risk</div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                <span className="text-outline">Caller Number:</span>
                <span className="font-mono-metric font-bold text-on-surface">{scenario.callerNumber}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                <span className="text-outline">Country Code:</span>
                <span className="font-mono-metric font-bold text-on-surface">{scenario.countryCode}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <div className="text-outline text-[11px]">TRAI / DoT Status:</div>
                <div className="font-semibold text-on-surface mt-0.5">{scenario.reputationDetails.traiStatus}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                <span className="text-outline">Community Reports:</span>
                <span className="font-mono-metric font-bold text-error">{scenario.reputationDetails.communityReports} reports</span>
              </div>
            </div>
          </div>

          {/* RISK FUSION ENGINE (Section 7) */}
          <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
              <div>
                <span className="font-mono-metric text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">balance</span>
                  Risk Fusion Engine
                </span>
                <span className="text-[10px] text-outline font-mono-metric">Formula: w1×C + w2×V + w3×R</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono-metric font-bold border ${badgeClasses}`}>
                {classification}
              </span>
            </div>

            {/* Calculated Master Gauge */}
            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center my-3">
              <div className="text-xs font-mono-metric text-outline uppercase tracking-wider">
                Fused Call Risk Score
              </div>
              <div className="font-display-lg text-4xl font-extrabold text-on-surface my-1 tracking-tight">
                {finalRiskPercent}%
              </div>
              <div className="w-full bg-surface-container-highest rounded-full h-2 mt-2 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${Math.min(100, Math.max(0, finalRisk * 100))}%` }}
                ></div>
              </div>
              <div className="mt-2 text-[11px] text-outline font-mono-metric">
                Threshold: Safe &lt; 0.40 | Suspicious 0.40–0.69 | High Risk &ge; 0.70
              </div>
            </div>

            {/* Interactive Weight Adjustment Sliders (Section 7: w1=0.5, w2=0.3, w3=0.2) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-mono-metric font-bold text-outline">
                <span>ADJUSTABLE FUSION WEIGHTS:</span>
                <button
                  onClick={() => {
                    setW1(DEFAULT_WEIGHTS.w1_conversation);
                    setW2(DEFAULT_WEIGHTS.w2_aasist);
                    setW3(DEFAULT_WEIGHTS.w3_reputation);
                    onTriggerToast('Reset weights to default (0.50 / 0.30 / 0.20)');
                  }}
                  className="text-primary hover:underline text-[10px]"
                >
                  Reset Defaults
                </button>
              </div>

              {/* w1 Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-purple-700 font-semibold">w1: Conversation Analysis</span>
                  <span className="font-mono-metric text-purple-700 font-bold">{w1.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={w1}
                  onChange={(e) => setW1(parseFloat(e.target.value))}
                  className="w-full accent-purple-600 h-1 bg-surface-container-highest rounded-lg cursor-pointer"
                />
              </div>

              {/* w2 Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-amber-700 font-semibold">w2: AASIST Voice Spoof</span>
                  <span className="font-mono-metric text-amber-700 font-bold">{w2.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={w2}
                  onChange={(e) => setW2(parseFloat(e.target.value))}
                  className="w-full accent-amber-600 h-1 bg-surface-container-highest rounded-lg cursor-pointer"
                />
              </div>

              {/* w3 Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-teal-700 font-semibold">w3: Caller Reputation</span>
                  <span className="font-mono-metric text-teal-700 font-bold">{w3.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={w3}
                  onChange={(e) => setW3(parseFloat(e.target.value))}
                  className="w-full accent-teal-600 h-1 bg-surface-container-highest rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Action to Guardian */}
            <div className="mt-4 pt-3 border-t border-outline-variant/20">
              <button
                onClick={() => onNotifyGuardian(scenario.guardianNotification)}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-500/30 font-label-md text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">emergency_share</span>
                <span>Dispatch Firebase Guardian Push</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
