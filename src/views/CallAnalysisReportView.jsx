import React, { useState } from 'react';

export default function CallAnalysisReportView({ onTriggerToast }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPercent, setPlayheadPercent] = useState(62); // 62% scrubber position
  const [playbackSpeed, setPlaybackSpeed] = useState('1x');
  const [spectrogramMode, setSpectrogramMode] = useState('waveform');

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    onTriggerToast(!isPlaying ? 'Audio playback started (PCM 48kHz)' : 'Audio playback paused');
  };

  const handleSeek = (direction) => {
    setPlayheadPercent(prev => Math.min(100, Math.max(0, prev + (direction * 5))));
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-[1520px] w-full mx-auto">
      {/* Breadcrumbs & System Toolbar Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-outline font-label-md text-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">Forensic Telemetry</span>
          <span className="text-outline-variant">/</span>
          <span className="hover:text-primary transition-colors cursor-pointer">TRAI Corridors</span>
          <span className="text-outline-variant">/</span>
          <span className="font-mono-metric text-on-surface font-semibold">INC-2024-8841</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-mono-metric font-semibold tracking-wide uppercase">
            Audited
          </span>
        </div>

        {/* Apple System Toolbar Style Export Utilities */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-surface-container-high/60 p-0.5 border border-outline-variant/30">
            <button
              onClick={() => onTriggerToast('Exporting forensic report as high-resolution PDF...')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-on-surface hover:bg-surface-container-lowest font-label-md text-label-md font-medium transition-all active:scale-[0.98] shadow-none hover:shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              <span>Export PDF</span>
            </button>
            <button
              onClick={() => onTriggerToast('Exporting telemetry table as CSV...')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-on-surface hover:bg-surface-container-lowest font-label-md text-label-md font-medium transition-all active:scale-[0.98] shadow-none hover:shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">table_view</span>
              <span>Export CSV</span>
            </button>
          </div>
          <button
            onClick={() => onTriggerToast('Dossier cryptographic link copied to clipboard.')}
            className="p-2 rounded-xl bg-surface-container-high/60 hover:bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/30 transition-all"
            title="Share Dossier"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* DOSSIER HEADER: Incident Metadata & Master Threat Assessment         */}
      {/* ===================================================================== */}
      <section className="bg-surface-container-lowest rounded-2xl border border-black/5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-space-lg backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Identity & Corridor Details */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="font-headline-md text-headline-md tracking-tight text-on-background font-bold">
                Incident #INC-2024-8841
              </h2>
              {/* Hinglish Language Badge */}
              <span className="px-2.5 py-1 rounded-full bg-secondary-container/10 border border-secondary-container/20 text-secondary font-label-sm text-label-sm font-semibold tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">translate</span>
                Hinglish
              </span>
              {/* Live Telecom Route Corridor Badge */}
              <span className="px-2.5 py-1 rounded-full bg-error-container/40 border border-error/20 text-error font-label-sm text-label-sm font-semibold tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                TRAI Red-Flagged Node
              </span>
            </div>

            {/* Deep Meta Items */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-on-surface-variant font-body-md text-body-md">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-outline text-[18px]">schedule</span>
                <span className="font-mono-metric text-mono-metric font-medium text-on-surface">14 Oct 2024, 14:32 IST</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-outline text-[18px]">timer</span>
                <span>Duration: <strong className="font-mono-metric text-mono-metric text-on-surface">03:42</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-outline text-[18px]">call</span>
                <span>Caller: <strong className="font-mono-metric text-mono-metric text-on-surface">+91 98XXXXXX21</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-error font-medium">
                <span className="material-symbols-outlined text-[18px]">flag</span>
                <span>Flagged 42x across TRAI Corridor</span>
              </div>
            </div>
          </div>

          {/* Large 87% HIGH RISK Evaluation Card */}
          <div className="flex items-center gap-5 p-4 rounded-xl bg-error/5 border border-error/20 lg:min-w-[380px] justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-error"></span>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-error font-bold">Threat Classification</span>
              </div>
              <span className="font-title text-title text-on-surface font-bold mt-0.5">Scam Type: Bank KYC Extortion</span>
              <span className="font-mono-metric text-mono-metric text-outline mt-1">Autonomous Enforcement Required</span>
            </div>
            {/* Metric Donut / High Risk Callout */}
            <div className="flex flex-col items-center justify-center bg-surface-container-lowest px-4 py-2.5 rounded-lg border border-error/20 shadow-sm shrink-0">
              <span className="font-headline-md text-headline-md font-bold text-error leading-none">87%</span>
              <span className="font-label-sm text-label-sm text-error font-semibold tracking-wider uppercase mt-1">HIGH RISK</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* TWO-COLUMN PRO INSPECTOR LAYOUT                                      */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =================================================================== */}
        {/* LEFT COLUMN: Mathematical Risk Fusion Model (5 Cols)                */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Card 1: Fusion Formula Breakdown */}
          <div className="bg-surface-container-lowest rounded-2xl border border-black/5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-space-lg">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">functions</span>
                <h3 className="font-title text-title font-semibold text-on-surface">Risk Fusion Model</h3>
              </div>
              <span className="font-mono-metric text-mono-metric px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                Model: RFM-v3.8b
              </span>
            </div>

            {/* Mathematical Monospace Formula Breakdown */}
            <div className="mt-4 p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
              <div className="flex items-center justify-between font-mono-metric text-mono-metric">
                <span className="text-outline">Algorithm: Weighted Multi-Vector Sum</span>
                <span className="text-tertiary font-semibold">Status: Converged</span>
              </div>
              <div className="py-2 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between">
                <span className="font-mono-metric text-body-md font-semibold text-on-surface tracking-tight">Σ(w_i × s_i)</span>
                <span className="font-mono-metric text-headline-sm text-headline-sm font-bold text-error tracking-tight">= 87.4%</span>
              </div>
              <p className="font-mono-metric text-mono-metric text-on-surface-variant text-xs leading-relaxed">
                Deterministic threshold &gt; 75.0% triggers mandatory carrier alert protocol under Section 43B.
              </p>
            </div>

            {/* Segmented Deep-Dive Cards Stack */}
            <div className="mt-5 flex flex-col gap-3.5">
              {/* Component 1: Conversation Analysis */}
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/40 hover:border-primary/40 transition-colors flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-error"></span>
                    <span className="font-label-md text-label-md font-semibold text-on-surface">Conversation Analysis</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-metric text-mono-metric">
                    <span className="text-outline">Weight: <strong>50%</strong></span>
                    <span className="px-2 py-0.5 rounded-md bg-error/10 text-error font-bold">Score: 88%</span>
                  </div>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="bg-error h-full rounded-full" style={{ width: '88%' }}></div>
                </div>
                <div className="flex items-center justify-between text-outline font-mono-metric text-mono-metric pt-1">
                  <span>Semantic Panic Inducement</span>
                  <span className="text-on-surface">Extortion Delta: +0.440</span>
                </div>
              </div>

              {/* Component 2: Voice Authenticity */}
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/40 hover:border-primary/40 transition-colors flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-error"></span>
                    <span className="font-label-md text-label-md font-semibold text-on-surface">Voice Authenticity</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-metric text-mono-metric">
                    <span className="text-outline">Weight: <strong>30%</strong></span>
                    <span className="px-2 py-0.5 rounded-md bg-error/10 text-error font-bold">Score: 90%</span>
                  </div>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="bg-error h-full rounded-full" style={{ width: '90%' }}></div>
                </div>
                <div className="flex items-center justify-between text-outline font-mono-metric text-mono-metric pt-1">
                  <span className="flex items-center gap-1 text-error font-medium">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    Neural TTS Clone Detected
                  </span>
                  <span className="text-on-surface">Acoustic Delta: +0.270</span>
                </div>
              </div>

              {/* Component 3: Caller Reputation */}
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/40 hover:border-primary/40 transition-colors flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    <span className="font-label-md text-label-md font-semibold text-on-surface">Caller Reputation</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-metric text-mono-metric">
                    <span className="text-outline">Weight: <strong>20%</strong></span>
                    <span className="px-2 py-0.5 rounded-md bg-secondary/10 text-secondary font-bold">Score: 80%</span>
                  </div>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '80%' }}></div>
                </div>
                <div className="flex items-center justify-between text-outline font-mono-metric text-mono-metric pt-1">
                  <span>Telco Blacklist Match</span>
                  <span className="text-on-surface">Reputation Delta: +0.160</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Biometric Telemetry Inspector */}
          <div className="bg-surface-container-lowest rounded-2xl border border-black/5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-space-lg">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-[20px]">equalizer</span>
                <h3 className="font-label-md text-label-md font-semibold uppercase tracking-wider text-on-surface">
                  Forensic Vector Parameters
                </h3>
              </div>
              <span className="font-mono-metric text-mono-metric text-outline">Inspector v2</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 font-mono-metric text-mono-metric">
              <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col">
                <span className="text-outline text-[11px]">Jitter Deviation</span>
                <span className="text-on-surface font-semibold mt-1">0.14 ms (±0.02)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col">
                <span className="text-outline text-[11px]">Harmonic / Noise</span>
                <span className="text-on-surface font-semibold mt-1">19.4 dB [Synthetic]</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col">
                <span className="text-outline text-[11px]">Phase Discontinuity</span>
                <span className="text-error font-semibold mt-1">84.2% anomalous</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col">
                <span className="text-outline text-[11px]">Speech Rate Entropy</span>
                <span className="text-on-surface font-semibold mt-1">1.82 bits/s</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline">Acoustic Confidence Metric:</span>
              <span className="font-mono-metric text-mono-metric font-bold text-tertiary">99.4% Verified Signature</span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: Audited Audio Session & Waveform Player (7 Cols)      */}
        {/* =================================================================== */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Card 3: Apple Pro App Waveform Scrubber & PCM Visualization */}
          <div className="bg-surface-container-lowest rounded-2xl border border-black/5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-space-lg flex flex-col gap-5">
            {/* Toolbar & Format Flags */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">spatial_audio</span>
                <h3 className="font-title text-title font-semibold text-on-surface">Audited Audio Session</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-full bg-error-container/40 border border-error/30 text-error font-mono-metric text-mono-metric font-semibold flex items-center gap-1.5 shadow-sm text-xs">
                  <span className="material-symbols-outlined text-[14px]">psychology</span>
                  VALL-E / XTTS-v2 Clone Detected
                </div>
                <button
                  onClick={() => onTriggerToast('Downloading 96kHz Lossless FLAC stream...')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface font-label-md text-label-md transition-all active:scale-[0.98]"
                  title="Download Lossless FLAC"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span className="hidden sm:inline">Lossless FLAC</span>
                </button>
              </div>
            </div>

            {/* Channel Legend */}
            <div className="flex items-center justify-between text-label-sm font-label-sm">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 text-error font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
                  CH-A: Malicious Caller (Synthetic/Clone)
                </span>
                <span className="flex items-center gap-1.5 text-primary font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                  CH-B: Citizen Target (Organic)
                </span>
              </div>
              <span className="font-mono-metric text-mono-metric text-outline text-xs">PCM 24-bit / 48kHz</span>
            </div>

            {/* Dual-Channel Recessed Waveform Visualizer Surface */}
            <div
              className="relative bg-surface-container-low rounded-xl p-4 border border-outline-variant/30 overflow-hidden cursor-pointer select-none"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                setPlayheadPercent(Math.max(0, Math.min(100, pos)));
              }}
            >
              {/* Channel A: Caller (Red) */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1 font-mono-metric text-[10px] text-outline">
                  <span>CHANNEL A // INBOUND (+91 98XXXXXX21)</span>
                  <span className="text-error font-semibold">SYNTHETIC PEAK DETECTED</span>
                </div>
                <div className="h-14 flex items-center gap-[3px] w-full">
                  {[4, 7, 11, 10, 14, 12, 8, 3, 2, 9, 14, 13, 10, 5, 2, 4, 8, 12, 14, 11, 6, 2, 4, 8, 13, 14, 9, 3, 2, 6, 12, 11, 9, 4, 2].map((val, i) => (
                    <div
                      key={i}
                      className="w-1 bg-error rounded-full transition-all"
                      style={{ height: `${val * 3.8}px`, opacity: i * 2.8 < playheadPercent ? 1 : 0.4 }}
                    />
                  ))}
                </div>
              </div>

              {/* Channel Separator Hairline */}
              <div className="h-px bg-outline-variant/30 my-2"></div>

              {/* Channel B: Target Citizen (Cyan/Teal/Primary) */}
              <div>
                <div className="flex justify-between items-center mb-1 font-mono-metric text-[10px] text-outline">
                  <span>CHANNEL B // OUTBOUND (CITIZEN TARGET)</span>
                  <span className="text-primary font-semibold">NATURAL HUMAN PHONEMES</span>
                </div>
                <div className="h-10 flex items-center gap-[3px] w-full">
                  {[2, 2, 3, 2, 4, 7, 9, 8, 5, 2, 2, 2, 5, 8, 9, 6, 2, 2, 3, 6, 10, 8, 4, 2, 2, 2, 7, 9, 5, 2, 2, 3, 2, 2, 2].map((val, i) => (
                    <div
                      key={i}
                      className="w-1 bg-primary rounded-full transition-all"
                      style={{ height: `${val * 3.2}px`, opacity: i * 2.8 < playheadPercent ? 1 : 0.35 }}
                    />
                  ))}
                </div>
              </div>

              {/* Interactive Apple Pro App Scrubber Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-error pointer-events-none z-10 flex flex-col items-center"
                style={{ left: `${playheadPercent}%` }}
              >
                <div className="w-2.5 h-2.5 -top-1 bg-error rounded-full shadow-[0_0_8px_rgba(255,59,48,0.7)]"></div>
              </div>
            </div>

            {/* Player Controls & Current Time Inspection */}
            <div className="flex items-center justify-between">
              {/* Playback Transport */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSeek(-1)}
                  className="p-2 rounded-lg hover:bg-surface-container text-on-surface transition-all"
                  title="Rewind 10 seconds"
                >
                  <span className="material-symbols-outlined text-[20px]">replay_10</span>
                </button>
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center hover:bg-primary-container shadow-sm transition-all active:scale-[0.96]"
                >
                  <span className="material-symbols-outlined text-[20px] fill-icon">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>
                <button
                  onClick={() => handleSeek(1)}
                  className="p-2 rounded-lg hover:bg-surface-container text-on-surface transition-all"
                  title="Forward 10 seconds"
                >
                  <span className="material-symbols-outlined text-[20px]">forward_10</span>
                </button>
                <div className="ml-2 font-mono-metric text-mono-metric text-on-surface font-semibold text-xs">
                  <span>02:18</span> <span className="text-outline font-normal">/ 03:42</span>
                </div>
              </div>

              {/* Spectrogram Zoom / Inspector Scale */}
              <div className="flex items-center gap-3">
                <span className="font-mono-metric text-mono-metric text-outline text-xs hidden sm:inline">1.0x Forensic Pitch</span>
                <div className="flex items-center gap-1 bg-surface-container rounded-lg p-0.5">
                  {['1x', '2x', 'Spectra'].map(speed => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-2 py-0.5 text-xs font-mono-metric font-medium rounded transition-all ${
                        playbackSpeed === speed
                          ? 'bg-surface-container-lowest shadow-xs text-primary font-bold'
                          : 'hover:bg-surface-container-lowest text-on-surface'
                      }`}
                    >
                      {speed}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Audited Verbatim Bilingual Transcript */}
          <div className="bg-surface-container-lowest rounded-2xl border border-black/5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-space-lg flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-[20px]">text_snippet</span>
                <h3 className="font-title text-title font-semibold text-on-surface">Verbatim Audited Transcript</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono-metric text-mono-metric text-tertiary flex items-center gap-1 font-semibold text-xs">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  Acoustic Confidence: 99.4%
                </span>
              </div>
            </div>

            {/* Dialogue Stream Container */}
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
              {/* Utterance 1 */}
              <div className="p-3.5 rounded-xl bg-error/5 border border-error/20 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-error/15 text-error font-mono-metric text-[11px] font-bold">00:12</span>
                    <span className="font-label-md text-label-md font-semibold text-on-surface">Caller (Synthetic Impersonator)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-mono-metric text-[11px] font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">security</span>
                    Authority Impersonation
                  </span>
                </div>
                <p className="font-body-md text-body-md text-on-surface leading-relaxed text-sm">
                  <span className="bg-error/15 px-1 py-0.5 rounded font-medium text-error">"Namaste sir, main SBI Head Office Mumbai se Security Officer Rajesh Verma bol raha hoon.</span> Aapka YONO account 2 ghante mein terminate ho jayega agar KYC biometric verify nahi kiya."
                </p>
                <div className="flex items-center justify-between font-mono-metric text-[11px] text-outline pt-1 border-t border-error/10">
                  <span>Language: Hinglish (Hindi/English Blend)</span>
                  <span className="text-error font-semibold">Social Engineering Vector: Coercive Urgency</span>
                </div>
              </div>

              {/* Utterance 2 */}
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-surface-container text-outline font-mono-metric text-[11px] font-semibold">00:38</span>
                    <span className="font-label-md text-label-md font-medium text-on-surface">Target (Citizen)</span>
                  </div>
                  <span className="font-mono-metric text-[11px] text-outline">Stress Metric: Elevated (78 BPM Eq.)</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed text-sm">
                  "Lekin maine toh pichle hafte hi branch jaake document submit kiya tha. Abhi dubara verify karna hoga kya?"
                </p>
              </div>

              {/* Utterance 3 */}
              <div className="p-3.5 rounded-xl bg-error/5 border border-error/20 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-error/15 text-error font-mono-metric text-[11px] font-bold">01:05</span>
                    <span className="font-label-md text-label-md font-semibold text-on-surface">Caller (Synthetic Impersonator)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-mono-metric text-[11px] font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">gavel</span>
                    Regulatory Extortion
                  </span>
                </div>
                <p className="font-body-md text-body-md text-on-surface leading-relaxed text-sm">
                  "Branch records freeze ho chuke hain under <span className="bg-error/15 px-1 py-0.5 rounded font-medium text-error">RBI Section 144 Emergency Directive</span>. Main aapke registered mobile pe live screen verification link bhej raha hoon. Turant click karke OTP approve kijiye nahi toh balance freeze ho jayega."
                </p>
                <div className="flex items-center justify-between font-mono-metric text-[11px] text-outline pt-1 border-t border-error/10">
                  <span>Synthetic Phoneme Artifact: Spectral Glitch @ 1.8kHz</span>
                  <span className="text-error font-semibold">Credential Harvest Directive</span>
                </div>
              </div>

              {/* Utterance 4 */}
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-surface-container text-outline font-mono-metric text-[11px] font-semibold">02:18</span>
                    <span className="font-label-md text-label-md font-medium text-on-surface">Target (Citizen)</span>
                  </div>
                  <span className="font-mono-metric text-[11px] text-outline">Intervention Trigger Raised</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed text-sm">
                  "Aapka number Delhi Police Cyber Cell se match nahi ho raha hai... Aapka branch code kya hai?"
                </p>
              </div>
            </div>

            {/* Footer: Forensic Signature Stamp */}
            <div className="mt-2 pt-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-3 text-outline font-mono-metric text-mono-metric text-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-[16px]">fingerprint</span>
                <span>Cryptographic Digest: <strong className="text-on-surface">SHA-256: 7f8c92a...18b4e</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span>Evaluated by: <strong>Node #HYD-CORRIDOR-04</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dossier Footer */}
      <footer className="mt-4 px-6 py-4 rounded-xl border border-outline-variant/30 text-outline text-label-sm font-label-sm flex flex-wrap justify-between items-center gap-4 bg-surface-container-lowest/70">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-tertiary"></span>
          <span>Sentinel Forensic Ledger • Operating in Strict Compliance with National Cyber Coordination Centre (NCCC) Standards</span>
        </div>
        <div className="font-mono-metric text-mono-metric text-outline text-xs">
          LATENCY: 42ms • MODEL-HASH: RFM-v3.8b-prod
        </div>
      </footer>
    </div>
  );
}
