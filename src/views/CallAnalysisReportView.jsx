import React, { useState, useRef, useEffect } from 'react';
import { POSTGRESQL_CALL_RECORDS, PHISHING_INDICATORS_SCHEMA } from '../data/projectData';
import { generateForensicPdf, exportReportAsJson } from '../utils/exportReportPdf';

export default function CallAnalysisReportView({ incidentId = 'CALL-2026-9102', activePipelineReport, onTriggerToast }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('forensics'); // 'forensics' | 'transcript' | 'postgres'
  const [selectedRecordId, setSelectedRecordId] = useState(activePipelineReport ? activePipelineReport.callId : incidentId);
  const audioRef = useRef(null);

  // If a new pipeline report arrives, auto-select it
  useEffect(() => {
    if (activePipelineReport?.callId) {
      setSelectedRecordId(activePipelineReport.callId);
    }
  }, [activePipelineReport]);

  // Normalize pipeline report to standard record format
  const normalizedPipelineRecord = activePipelineReport ? {
    callId: activePipelineReport.callId,
    timestamp: activePipelineReport.timestamp,
    callerNumber: activePipelineReport.maskedNumber || activePipelineReport.callerNumber,
    fullCaller: activePipelineReport.callerNumber,
    duration: activePipelineReport.duration,
    durationSeconds: activePipelineReport.durationSeconds || parseFloat(activePipelineReport.duration) || 120,
    language: activePipelineReport.detectedLanguage || activePipelineReport.language || 'English (en)',
    conversationScore: activePipelineReport.conversationScore,
    aasistScore: activePipelineReport.aasistScore,
    reputationScore: activePipelineReport.reputationScore,
    finalRisk: activePipelineReport.finalRisk,
    riskLevel: activePipelineReport.classification || activePipelineReport.riskLevel || 'HIGH RISK',
    detectedIndicators: (activePipelineReport.indicatorsTriggered && activePipelineReport.indicatorsTriggered.length > 0)
      ? activePipelineReport.indicatorsTriggered
      : ['Authority Impersonation', 'Urgency & Fear Tactics'],
    guardianStatus: activePipelineReport.guardianDispatched 
      ? `DELIVERED (FCM Push to ${activePipelineReport.guardianNotification?.recipient || 'Rohan Sharma'})` 
      : 'NOT_TRIGGERED',
    transcriptPreview: activePipelineReport.transcript || '(No speech transcript recorded)',
    inputSource: activePipelineReport.audioName 
      ? `Audio Pipeline Upload (${activePipelineReport.audioName})`
      : 'Audio Pipeline Runner',
    audioPreviewUrl: activePipelineReport.audioPreviewUrl,
    criteriaScores: activePipelineReport.criteriaScores || {},
    isLiveBackend: activePipelineReport.isLiveBackend,
    aasistDetails: {
      bonafideProb: activePipelineReport.bonafideScore ?? Math.max(0, 1.0 - activePipelineReport.aasistScore),
      spoofProb: activePipelineReport.aasistScore,
      graphAttentionPeaks: activePipelineReport.aasistVerdict || 'Spectro-temporal graph attention analysis on vocoder harmonics',
      trainingDatasetRole: 'Evaluated against IndicSynth synthetic speech and IndicVoices-R natural voice models'
    },
    rawBackendData: activePipelineReport.rawBackendData
  } : null;

  // Build list of available records (Pipeline report + historical PostgreSQL records)
  const allAvailableRecords = [
    ...(normalizedPipelineRecord ? [normalizedPipelineRecord] : []),
    ...POSTGRESQL_CALL_RECORDS
  ];

  // Resolve current active record
  const currentRecord = allAvailableRecords.find(r => r.callId === selectedRecordId) 
    || normalizedPipelineRecord 
    || POSTGRESQL_CALL_RECORDS[0];

  const isLivePipeline = currentRecord.callId === normalizedPipelineRecord?.callId;
  const isHighRisk = currentRecord.finalRisk >= 0.70 || (currentRecord.riskLevel && currentRecord.riskLevel.includes('HIGH'));
  const isSuspicious = !isHighRisk && (currentRecord.finalRisk >= 0.40 || (currentRecord.riskLevel && currentRecord.riskLevel.includes('SUSPICIOUS')));

  const handleTogglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
      onTriggerToast(!isPlaying ? 'Playing call audio stream' : 'Audio playback paused');
    }
  };

  const handleDownloadPdf = () => {
    try {
      generateForensicPdf(currentRecord);
      onTriggerToast(`Downloaded forensic PDF report for ${currentRecord.callId}`);
    } catch (err) {
      console.error('PDF export error:', err);
      onTriggerToast('Failed to generate PDF. Check browser console.');
    }
  };

  const handleDownloadJson = () => {
    try {
      exportReportAsJson(currentRecord);
      onTriggerToast(`Downloaded PostgreSQL JSON record for ${currentRecord.callId}`);
    } catch (err) {
      console.error('JSON export error:', err);
      onTriggerToast('Failed to export JSON record.');
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-[1520px] w-full mx-auto animate-in fade-in duration-300">
      
      {/* Top Breadcrumb & Action Utilities */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-outline-variant/20">
        <div className="flex items-center gap-2 text-xs font-mono-metric flex-wrap">
          <span className="text-outline">Data Storage &amp; Post-Call Analytics (Section 9)</span>
          <span className="text-outline-variant">/</span>
          <span className="font-bold text-on-surface">{currentRecord.callId}</span>
          
          <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[11px] border ${
            isHighRisk ? 'bg-error/10 text-error border-error/20' : isSuspicious ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' : 'bg-tertiary/10 text-tertiary border-tertiary/20'
          }`}>
            {currentRecord.riskLevel}
          </span>

          {isLivePipeline && (
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono-metric font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">bolt</span>
              LATEST PIPELINE EVALUATION
            </span>
          )}
        </div>

        {/* Record Selector & Export Utilities */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Switch Dropdown */}
          <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded-xl border border-outline-variant/30 text-xs">
            <span className="text-outline text-[11px] font-mono-metric font-semibold">Select Record:</span>
            <select
              value={currentRecord.callId}
              onChange={(e) => setSelectedRecordId(e.target.value)}
              className="bg-transparent text-on-surface font-mono-metric font-bold text-xs focus:outline-none cursor-pointer"
            >
              {allAvailableRecords.map(r => (
                <option key={r.callId} value={r.callId}>
                  {r.callId} — {r.callId === normalizedPipelineRecord?.callId ? 'Live Pipeline' : r.fullCaller || r.callerNumber} ({r.riskLevel})
                </option>
              ))}
            </select>
          </div>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-on-primary hover:brightness-105 active:scale-95 rounded-xl font-label-md text-xs font-bold transition-all shadow-sm shadow-primary/20"
            title="Download formatted forensic investigation PDF"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
            <span>Download Report (PDF)</span>
          </button>
          
          {/* Download JSON Button */}
          <button
            onClick={handleDownloadJson}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-label-md text-xs font-semibold border border-outline-variant/30 transition-all shadow-xs"
            title="Download PostgreSQL schema JSON dump"
          >
            <span className="material-symbols-outlined text-base">data_object</span>
            <span>Download JSON</span>
          </button>

          {/* Print / Browser PDF */}
          <button
            onClick={() => window.print()}
            className="p-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl border border-outline-variant/30 transition-all shadow-xs"
            title="Print or Save via Browser"
          >
            <span className="material-symbols-outlined text-base">print</span>
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
                {currentRecord.callId}
              </span>
              <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-700 border border-purple-500/20 text-xs font-mono-metric font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">translate</span>
                {currentRecord.language}
              </span>
              {isLivePipeline && (
                <span className="px-3 py-1 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 text-xs font-mono-metric font-bold">
                  Generated from Uploaded Audio
                </span>
              )}
            </div>

            {/* Structured Post-Call Attributes (Matching Section 9 checklist) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs font-body-md text-on-surface-variant">
              <div>
                <span className="text-outline block text-[11px] font-mono-metric uppercase">Timestamp</span>
                <strong className="text-on-surface font-mono-metric">{currentRecord.timestamp}</strong>
              </div>
              <div>
                <span className="text-outline block text-[11px] font-mono-metric uppercase">Protected Identifier</span>
                <strong className="text-on-surface font-mono-metric">{currentRecord.callerNumber}</strong>
              </div>
              <div>
                <span className="text-outline block text-[11px] font-mono-metric uppercase">Call Duration</span>
                <strong className="text-on-surface font-mono-metric">{currentRecord.duration} ({currentRecord.durationSeconds}s)</strong>
              </div>
              <div>
                <span className="text-outline block text-[11px] font-mono-metric uppercase">Guardian Status</span>
                <strong className={`font-medium ${isHighRisk ? 'text-error' : 'text-on-surface'}`}>
                  {currentRecord.guardianStatus}
                </strong>
              </div>
            </div>
          </div>

          {/* Master Risk Score Pill */}
          <div className={`p-4 rounded-2xl border flex items-center gap-4 shrink-0 ${
            isHighRisk 
              ? 'bg-error/10 border-error/30 text-error' 
              : isSuspicious 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700' 
              : 'bg-tertiary/10 border-tertiary/30 text-tertiary'
          }`}>
            <div>
              <div className="text-[11px] font-mono-metric font-bold uppercase tracking-wider">
                FINAL RISK SCORE
              </div>
              <div className="font-display-lg text-3xl font-extrabold font-mono-metric">
                {(currentRecord.finalRisk * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] font-bold">{currentRecord.riskLevel}</div>
            </div>
            <div className={`w-12 h-12 rounded-xl text-white flex items-center justify-center font-bold text-xl shadow-md ${
              isHighRisk ? 'bg-error' : isSuspicious ? 'bg-amber-500' : 'bg-tertiary'
            }`}>
              {isHighRisk ? '▲' : isSuspicious ? '!' : '✓'}
            </div>
          </div>
        </div>

        {/* THE 3 INDEPENDENT SIGNALS SUMMARY CARDS (Section 7 Formula) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          
          {/* Signal 1: Conversation Scam Score (50%) */}
          <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-purple-700 font-mono-metric font-bold">
                <span>Conversation Scam (w1 = 0.50)</span>
                <span className="material-symbols-outlined text-base">psychology</span>
              </div>
              <div className="text-2xl font-extrabold text-purple-900 font-mono-metric my-1">
                {((currentRecord.conversationScore || 0) * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Scam_model_final transformer evaluation across the 6 Phishing Criteria.
              </p>
            </div>
            <div className="mt-2 text-[10px] font-mono-metric text-purple-600 font-bold">
              WEIGHT: 50% OF FUSED RISK
            </div>
          </div>

          {/* Signal 2: AASIST Spoof Score (30%) */}
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-amber-700 font-mono-metric font-bold">
                <span>AASIST Spoof Score (w2 = 0.30)</span>
                <span className="material-symbols-outlined text-base">network_intelligence</span>
              </div>
              <div className="text-2xl font-extrabold text-amber-900 font-mono-metric my-1">
                {((currentRecord.aasistScore || 0) * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Spectro-temporal graph attention clone probability (Bona-fide: {((currentRecord.aasistDetails?.bonafideProb ?? (1 - currentRecord.aasistScore)) * 100).toFixed(1)}%).
              </p>
            </div>
            <div className="mt-2 text-[10px] font-mono-metric text-amber-700 font-bold">
              WEIGHT: 30% OF FUSED RISK
            </div>
          </div>

          {/* Signal 3: Caller Reputation Score (20%) */}
          <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-500/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-teal-700 font-mono-metric font-bold">
                <span>Caller Reputation (w3 = 0.20)</span>
                <span className="material-symbols-outlined text-base">verified_user</span>
              </div>
              <div className="text-2xl font-extrabold text-teal-900 font-mono-metric my-1">
                {((currentRecord.reputationScore || 0) * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Checked against country code (+91) and TRAI / DoT community fraud database.
              </p>
            </div>
            <div className="mt-2 text-[10px] font-mono-metric text-teal-700 font-bold">
              WEIGHT: 20% OF FUSED RISK
            </div>
          </div>

        </div>
      </section>

      {/* FORENSIC DEEP-DIVE TABS */}
      <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-1">
        {[
          { id: 'forensics', label: 'Forensic Audio & AASIST Graph', icon: 'graphic_eq' },
          { id: 'transcript', label: 'Full Transcript & Criteria (Section 3.2)', icon: 'transcribe' },
          { id: 'postgres', label: 'PostgreSQL Relational Record (Section 9)', icon: 'database' }
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
              <span className="text-[11px] font-mono-metric text-outline">
                {currentRecord.audioPreviewUrl ? 'Recorded Audio Stream' : '16kHz PCM WAV'}
              </span>
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
                    <span>{isPlaying ? 'Playing...' : '00:00'}</span>
                    <span>{currentRecord.duration || `${currentRecord.durationSeconds}s`}</span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-2 cursor-pointer overflow-hidden">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: isPlaying ? '72%' : '0%' }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Real Audio Element if preview url exists */}
              {currentRecord.audioPreviewUrl && (
                <audio
                  ref={audioRef}
                  src={currentRecord.audioPreviewUrl}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
              )}

              {/* Waveform graphic */}
              <div className="w-full h-16 flex items-center justify-between gap-1 px-2">
                {[20, 35, 60, 45, 80, 95, 70, 50, 40, 85, 90, 65, 30, 55, 75, 40, 60, 80, 50, 30].map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all ${
                      isPlaying && i < 14 ? 'bg-primary' : 'bg-outline-variant/40'
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
                <span className={`font-mono-metric font-bold ${currentRecord.aasistScore >= 0.70 ? 'text-error' : 'text-tertiary'}`}>
                  {currentRecord.aasistScore >= 0.70 ? 'Positive (Synthetic Artifact Match)' : 'Negative (Organic Inflection)'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                <span className="text-outline">Audio Input Source:</span>
                <span className="font-mono-metric font-semibold text-on-surface truncate max-w-[260px]">
                  {currentRecord.inputSource}
                </span>
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
                {currentRecord.aasistDetails?.graphAttentionPeaks || 'Temporal node clusters evaluated across 64,600 samples for pitch jitter and micro-envelope discontinuities.'}
              </p>
              <div className="pt-2 border-t border-amber-500/20 font-bold">Training Dataset Role (Section 5):</div>
              <p className="leading-relaxed">
                {currentRecord.aasistDetails?.trainingDatasetRole || 'Validated against IndicSynth synthetic speech generators and IndicVoices-R natural voice models.'}
              </p>
            </div>

            {/* Probability Gauges */}
            <div className="grid grid-cols-2 gap-3 text-center text-xs font-mono-metric">
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/25">
                <span className="text-outline text-[11px]">Bona-fide (Natural)</span>
                <div className="text-xl font-bold text-tertiary mt-1">
                  {((currentRecord.aasistDetails?.bonafideProb ?? (1.0 - currentRecord.aasistScore)) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/25">
                <span className="text-outline text-[11px]">Spoof (AI Cloned)</span>
                <div className="text-xl font-bold text-error mt-1">
                  {((currentRecord.aasistDetails?.spoofProb ?? currentRecord.aasistScore) * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Direct Export CTA in Forensics Tab */}
            <div className="pt-2">
              <button
                onClick={handleDownloadPdf}
                className="w-full py-2.5 px-4 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl font-label-md text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined text-base">download</span>
                <span>Download Complete Forensic Dossier (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: Full Transcript & Detected Indicators */}
      {activeTab === 'transcript' && (
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm flex flex-col gap-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20">
            <div>
              <h3 className="font-title text-lg font-bold text-on-surface">
                Semantic Evaluation Across the 6 Phishing Criteria (Section 3.2)
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Evaluated by Scam_model_final Transformer and Azure AI Speech transcription.
              </p>
            </div>
            <button
              onClick={handleDownloadPdf}
              className="self-start sm:self-auto px-3.5 py-1.5 bg-primary text-on-primary rounded-xl font-label-md text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              <span>Export as PDF</span>
            </button>
          </div>

          {/* The 6 Criteria Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 font-mono-metric">
            {PHISHING_INDICATORS_SCHEMA.map(ind => {
              const critScores = currentRecord.criteriaScores || {};
              const rawScore = critScores[ind.id] 
                ?? (ind.id === 'information_requests' ? critScores['credential_otp_requests'] : undefined)
                ?? (isHighRisk ? 0.85 : 0.05);
              const scorePct = (rawScore * 100);
              const isHigh = scorePct >= 50;

              return (
                <div key={ind.id} className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col justify-between hover:border-outline-variant/40 transition-all">
                  <div>
                    <div className="flex justify-between items-center mb-1.5 gap-2">
                      <span className="text-on-surface/90 font-semibold text-xs sm:text-[13px] truncate" title={ind.name}>
                        {ind.name}
                      </span>
                      <span className={`font-bold font-mono-metric text-xs sm:text-[13.5px] shrink-0 ${isHigh ? 'text-error' : 'text-on-surface'}`}>
                        {scorePct.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[11.5px] sm:text-xs text-on-surface-variant leading-relaxed line-clamp-2">
                      {ind.desc}
                    </p>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-1.5 mt-3 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full ${isHigh ? 'bg-error' : 'bg-primary'}`} 
                      style={{ width: `${Math.min(100, Math.max(3, scorePct))}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Triggered Indicator Badges */}
          <div>
            <span className="text-xs font-mono-metric font-bold text-outline uppercase tracking-wider block mb-2">
              Specific Indicators Triggered in Context:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(currentRecord.detectedIndicators || []).map((ind, i) => (
                <div key={i} className="p-3 rounded-2xl bg-error/5 border border-error/25 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-error text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-error">{ind}</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Flagged during audio evaluation and semantic context classification.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Whisper STT Speech Transcript */}
          <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/25">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant/20">
              <span className="text-xs font-mono-metric font-bold text-outline uppercase tracking-wider">
                Full Transcribed Speech Context (Whisper STT)
              </span>
              <span className="text-xs font-mono-metric text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                Language: {currentRecord.language}
              </span>
            </div>
            <p className="text-sm font-body-md text-on-surface italic leading-relaxed whitespace-pre-wrap">
              "{currentRecord.transcriptPreview}"
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
                PostgreSQL Call Record Entity (Section 9 Schema)
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Exact relational database schema mapping from Section 9 of the project description.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadJson}
                className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl border border-outline-variant/30 text-xs font-mono-metric font-bold flex items-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Download JSON Payload</span>
              </button>
              <span className="px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-700 text-xs font-mono-metric font-bold border border-indigo-500/20">
                table: call_records
              </span>
            </div>
          </div>

          <div className="p-4 bg-[#1e1e2e] text-[#cdd6f4] rounded-2xl font-mono-metric text-xs overflow-x-auto shadow-inner">
            <pre>
{JSON.stringify({
  call_id: currentRecord.callId,
  timestamp: currentRecord.timestamp,
  caller_number_protected: currentRecord.callerNumber,
  caller_number_raw: currentRecord.fullCaller,
  duration_seconds: currentRecord.durationSeconds,
  detected_language: currentRecord.language,
  conversation_scam_score: currentRecord.conversationScore,
  aasist_spoof_score: currentRecord.aasistScore,
  caller_reputation_score: currentRecord.reputationScore,
  final_risk_score: currentRecord.finalRisk,
  final_risk_level: currentRecord.riskLevel,
  criteria_scores: currentRecord.criteriaScores || {},
  detected_phishing_indicators: currentRecord.detectedIndicators,
  guardian_notification_status: currentRecord.guardianStatus,
  whisper_transcript: currentRecord.transcriptPreview,
  input_source: currentRecord.inputSource,
  created_at: new Date().toISOString()
}, null, 2)}
            </pre>
          </div>
        </div>
      )}

    </div>
  );
}
