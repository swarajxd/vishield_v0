import React, { useState } from 'react';
import { POSTGRESQL_CALL_RECORDS } from '../data/projectData';

export default function CallAnalysisReportView({ incidentId = 'CALL-2026-9102', onTriggerToast }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('forensics'); // 'forensics' | 'postgres' | 'transcript'
  
  // Find report or fallback to first
  const record = POSTGRESQL_CALL_RECORDS.find(r => r.callId === incidentId) || POSTGRESQL_CALL_RECORDS[0];

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
    onTriggerToast(!isPlaying ? 'Playing call audio segment (16kHz PCM)' : 'Audio playback paused');
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-[1520px] w-full mx-auto animate-in fade-in duration-300">
      
      {/* Top Breadcrumb & Action Utilities */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-outline-variant/20">
        <div className="flex items-center gap-2 text-xs font-mono-metric">
          <span className="text-outline">Data Storage &amp; Post-Call Analytics (Section 9)</span>
          <span className="text-outline-variant">/</span>
          <span className="font-bold text-on-surface">{record.callId}</span>
          <span className="ml-2 px-2.5 py-0.5 rounded-full bg-error/10 text-error border border-error/20 font-bold uppercase">
            {record.riskLevel}
          </span>
        </div>

        {/* Export Utilities */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTriggerToast('Exporting structured post-call report as forensic PDF...')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-on-surface font-label-md text-xs font-semibold border border-outline-variant/30 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
            <span>Export Report (PDF)</span>
          </button>
          
          <button
            onClick={() => onTriggerToast('PostgreSQL record exported as JSON payload')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-on-surface font-label-md text-xs font-semibold border border-outline-variant/30 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-base">data_object</span>
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* SECTION 9 DOSSIER HEADER: Structured Post-Call Report */}
      <section className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-outline-variant/20">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-headline-md text-2xl font-bold tracking-tight text-on-surface">
                Structured Post-Call Analysis Report
              </h2>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-mono-metric font-bold">
                {record.callId}
              </span>
              <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-700 border border-purple-500/20 text-xs font-mono-metric font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">translate</span>
                {record.language}
              </span>
            </div>

            {/* Structured Post-Call Attributes (Matching Section 9 checklist) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs font-body-md text-on-surface-variant">
              <div>
                <span className="text-outline block text-[11px] font-mono-metric uppercase">Timestamp</span>
                <strong className="text-on-surface font-mono-metric">{record.timestamp}</strong>
              </div>
              <div>
                <span className="text-outline block text-[11px] font-mono-metric uppercase">Protected Identifier</span>
                <strong className="text-on-surface font-mono-metric">{record.callerNumber}</strong>
              </div>
              <div>
                <span className="text-outline block text-[11px] font-mono-metric uppercase">Call Duration</span>
                <strong className="text-on-surface font-mono-metric">{record.duration} ({record.durationSeconds}s)</strong>
              </div>
              <div>
                <span className="text-outline block text-[11px] font-mono-metric uppercase">Guardian Status</span>
                <strong className="text-error font-medium">{record.guardianStatus.split(' ')[0]} (FCM)</strong>
              </div>
            </div>
          </div>

          {/* Master Risk Score Pill */}
          <div className="p-4 rounded-2xl bg-error/10 border border-error/30 flex items-center gap-4 shrink-0">
            <div>
              <div className="text-[11px] font-mono-metric font-bold text-error uppercase tracking-wider">
                FINAL RISK SCORE
              </div>
              <div className="font-display-lg text-3xl font-extrabold text-error font-mono-metric">
                {(record.finalRisk * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-error font-bold">{record.riskLevel}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-error text-white flex items-center justify-center font-bold text-xl shadow-md">
              ▲
            </div>
          </div>
        </div>

        {/* THE 3 INDEPENDENT SIGNALS SUMMARY CARDS (Section 7 Formula) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20">
            <div className="flex items-center justify-between text-xs text-purple-700 font-mono-metric font-bold">
              <span>Conversation Scam Score (w1 = 0.50)</span>
              <span className="material-symbols-outlined text-base">psychology</span>
            </div>
            <div className="text-2xl font-extrabold text-purple-900 font-mono-metric my-1">
              {(record.conversationScore * 100).toFixed(0)}%
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Azure AI Speech STT &amp; GPT-4o semantic evaluation of coercive indicators.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center justify-between text-xs text-amber-700 font-mono-metric font-bold">
              <span>AASIST Spoof Score (w2 = 0.30)</span>
              <span className="material-symbols-outlined text-base">network_intelligence</span>
            </div>
            <div className="text-2xl font-extrabold text-amber-900 font-mono-metric my-1">
              {(record.aasistScore * 100).toFixed(0)}%
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Spectro-temporal graph attention clone probability (Bona-fide: {((1 - record.aasistScore) * 100).toFixed(0)}%).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-500/20">
            <div className="flex items-center justify-between text-xs text-teal-700 font-mono-metric font-bold">
              <span>Caller Reputation Score (w3 = 0.20)</span>
              <span className="material-symbols-outlined text-base">verified_user</span>
            </div>
            <div className="text-2xl font-extrabold text-teal-900 font-mono-metric my-1">
              {(record.reputationScore * 100).toFixed(0)}%
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Checked against country code (+91) and TRAI / DoT fraud database.
            </p>
          </div>
        </div>
      </section>

      {/* FORENSIC DEEP-DIVE TABS */}
      <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-1">
        {[
          { id: 'forensics', label: 'Forensic Audio & AASIST Graph', icon: 'graphic_eq' },
          { id: 'transcript', label: 'Full Transcript & Indicators', icon: 'transcribe' },
          { id: 'postgres', label: 'PostgreSQL Database Record', icon: 'database' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-label-md font-semibold transition-all flex items-center gap-2 ${
              activeTab === t.id
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-base">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB CONTENT 1: Forensics & AASIST Graph Attention */}
      {activeTab === 'forensics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Audio Player & Waveform */}
          <div className="lg:col-span-6 bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <span className="font-mono-metric text-xs font-bold text-outline uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">volume_up</span>
                Audio Capture Playback
              </span>
              <span className="text-[11px] font-mono-metric text-outline">16kHz PCM WAV</span>
            </div>

            {/* Playback Controls & Waveform */}
            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 flex flex-col items-center">
              <div className="flex items-center gap-3 w-full mb-3">
                <button
                  onClick={handleTogglePlay}
                  className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-2xl">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>
                <div className="flex-1">
                  <div className="flex justify-between text-xs font-mono-metric text-outline mb-1">
                    <span>{isPlaying ? '01:14' : '00:00'}</span>
                    <span>{record.duration}</span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-2 cursor-pointer overflow-hidden">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: isPlaying ? '48%' : '0%' }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Waveform graphic */}
              <div className="w-full h-16 flex items-center justify-between gap-1 px-2">
                {[20, 35, 60, 45, 80, 95, 70, 50, 40, 85, 90, 65, 30, 55, 75, 40, 60, 80, 50, 30].map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all ${
                      isPlaying && i < 10 ? 'bg-primary' : 'bg-outline-variant/40'
                    }`}
                    style={{ height: `${h}%` }}
                  ></div>
                ))}
              </div>
            </div>

            {/* Audio Properties */}
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                <span className="text-outline">Chunking Window:</span>
                <span className="font-mono-metric font-semibold text-on-surface">5–10s streaming slices</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                <span className="text-outline">Synthetic Vocoder Flag:</span>
                <span className="font-mono-metric font-bold text-error">Positive (XTTS / VITS artifact match)</span>
              </div>
            </div>
          </div>

          {/* AASIST Graph Attention Architecture View (Section 4 & 5) */}
          <div className="lg:col-span-6 bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <span className="font-mono-metric text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-600 text-base">hub</span>
                AASIST Graph Attention Details
              </span>
              <span className="text-[11px] font-mono-metric text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                IndicSynth Spoof Model
              </span>
            </div>

            <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/25 text-xs text-amber-950 space-y-2">
              <div className="font-bold">Spectro-Temporal Feature Representation (Section 4.1):</div>
              <p className="leading-relaxed">
                {record.aasistDetails.graphAttentionPeaks}
              </p>
              <div className="pt-2 border-t border-amber-500/20 font-bold">Training Dataset Role (Section 5):</div>
              <p className="leading-relaxed">
                {record.aasistDetails.trainingDatasetRole}
              </p>
            </div>

            {/* Probability Gauges */}
            <div className="grid grid-cols-2 gap-3 text-center text-xs font-mono-metric">
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/25">
                <span className="text-outline text-[11px]">Bona-fide (Natural)</span>
                <div className="text-xl font-bold text-tertiary mt-1">
                  {(record.aasistDetails.bonafideProb * 100).toFixed(1)}%
                </div>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/25">
                <span className="text-outline text-[11px]">Spoof (AI Cloned)</span>
                <div className="text-xl font-bold text-error mt-1">
                  {(record.aasistDetails.spoofProb * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: Full Transcript & Detected Indicators */}
      {activeTab === 'transcript' && (
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm flex flex-col gap-6">
          <div>
            <h3 className="font-title text-lg font-bold text-on-surface">
              Detected Phishing Indicators (The 6 Criteria)
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Extracted via Azure AI Foundry GPT-4o semantic context reasoning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {record.detectedIndicators.map((ind, i) => (
              <div key={i} className="p-3 rounded-2xl bg-error/5 border border-error/25 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-error text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  ✓
                </div>
                <div>
                  <h4 className="font-bold text-xs text-error">{ind}</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Flagged during real-time running transcript buffer evaluation.
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/25">
            <span className="text-xs font-mono-metric font-bold text-outline uppercase tracking-wider block mb-2">
              Transcript Snippet Preview:
            </span>
            <p className="text-sm font-body-md text-on-surface italic leading-relaxed">
              "{record.transcriptPreview}"
            </p>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PostgreSQL Schema Record (Section 9) */}
      {activeTab === 'postgres' && (
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
            <div>
              <h3 className="font-title text-lg font-bold text-on-surface">
                PostgreSQL Call Record Entity (Section 9)
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Exact relational database schema mapping from Section 9 of the project description.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-700 text-xs font-mono-metric font-bold">
              table: call_records
            </span>
          </div>

          <div className="p-4 bg-[#1e1e2e] text-[#cdd6f4] rounded-2xl font-mono-metric text-xs overflow-x-auto shadow-inner">
            <pre>
{JSON.stringify({
  call_id: record.callId,
  timestamp: record.timestamp,
  caller_number_protected: record.callerNumber,
  caller_number_raw_hash: "sha256_7f8a9b...",
  duration_seconds: record.durationSeconds,
  detected_language: record.language,
  conversation_scam_score: record.conversationScore,
  aasist_spoof_score: record.aasistScore,
  caller_reputation_score: record.reputationScore,
  final_risk_score: record.finalRisk,
  final_risk_level: record.riskLevel,
  detected_phishing_indicators: record.detectedIndicators,
  guardian_notification_status: record.guardianStatus,
  created_at: new Date().toISOString()
}, null, 2)}
            </pre>
          </div>
        </div>
      )}

    </div>
  );
}
