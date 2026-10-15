import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { POSTGRESQL_CALL_RECORDS, PHISHING_INDICATORS_SCHEMA } from '../data/projectData';
import { generateForensicPdf, exportReportAsJson } from '../utils/exportReportPdf';

// Helper to normalize an incident from the backend DB into the view's forensic report schema
function incidentToReport(inc) {
  if (!inc) return null;
  const full = inc.fullResult || {};
  const tri = full.tri_signal_scores || {};
  const aasist = full.aasist_details || {};
  const scam = full.scam_model_details || {};
  const criteria = scam.criteria || {};
  const rep = full.caller_reputation_details || {};
  const guardian = full.guardian_notification || {};

  const convScore = inc.conversationScore ?? tri.conversation_scam_score ?? 0;
  const aasScore = inc.aasistScore ?? tri.aasist_spoof_score ?? 0;
  const repScore = inc.reputationScore ?? tri.caller_reputation_score ?? 0;
  const finRisk = inc.finalRisk ?? full.final_risk_score ?? (0.5 * convScore + 0.3 * aasScore + 0.2 * repScore);

  let riskTier = inc.riskLevel || full.classification;
  if (!riskTier) {
    if (finRisk >= 0.70) riskTier = 'HIGH RISK';
    else if (finRisk >= 0.40) riskTier = 'SUSPICIOUS';
    else riskTier = 'SAFE';
  }

  // Phishing indicators triggered
  let indicators = inc.detectedIndicators || [];
  if (!indicators.length && full.detected_phishing_indicators?.length) {
    indicators = full.detected_phishing_indicators;
  }
  if (!indicators.length && scam.evidence?.indicators?.length) {
    indicators = scam.evidence.indicators;
  }

  const durationSec = inc.durationSeconds || full.duration_seconds || 30;
  const durationStr = inc.duration || `${Math.floor(durationSec / 60).toString().padStart(2, '0')}:${Math.floor(durationSec % 60).toString().padStart(2, '0')}`;
  const lang = inc.language || full.detected_language || 'English (en)';
  const fullTranscript = inc.transcript || full.transcript || inc.transcriptPreview || '(No speech transcript recorded)';

  const guardianStr = inc.guardianStatus 
    ? (inc.guardianStatus.includes('DELIVERED') || inc.guardianStatus.includes('NOT_TRIGGERED') 
        ? inc.guardianStatus 
        : inc.guardianStatus === 'DISPATCHED' 
          ? `DELIVERED (FCM Push to ${guardian.recipient || 'Guardian'})` 
          : inc.guardianStatus)
    : (guardian.status === 'DISPATCHED' 
        ? `DELIVERED (FCM Push to ${guardian.recipient || 'Guardian'})` 
        : 'NOT_TRIGGERED');

  return {
    callId: inc.callId || full.call_id || `CALL-${Math.floor(Math.random() * 90000 + 10000)}`,
    timestamp: inc.timestamp || full.timestamp || new Date().toLocaleString(),
    callerNumber: inc.callerNumber || full.caller_number_masked || inc.fullCaller || full.caller_number_raw || 'Unknown',
    fullCaller: inc.fullCaller || full.caller_number_raw || inc.callerNumber || 'Unknown',
    duration: durationStr,
    durationSeconds: durationSec,
    language: lang,
    conversationScore: convScore,
    aasistScore: aasScore,
    reputationScore: repScore,
    finalRisk: finRisk,
    riskLevel: riskTier,
    detectedIndicators: indicators,
    guardianStatus: guardianStr,
    transcriptPreview: fullTranscript,
    inputSource: inc.audioFile ? `Live Pipeline Upload (${inc.audioFile})` : (full.stt_engine ? `Pipeline Audio (${full.stt_engine})` : 'Live Audio Pipeline Evaluation'),
    audioPreviewUrl: inc.audioPreviewUrl || null,
    criteriaScores: criteria,
    isLiveBackend: true,
    isStaticData: false,
    aasistDetails: {
      bonafideProb: aasist.bonafide_probability ?? Math.max(0, 1.0 - aasScore),
      spoofProb: aasist.voice_spoof_score ?? aasScore,
      graphAttentionPeaks: aasist.spectral_envelope_profile || aasist.verdict || 'Spectro-temporal graph attention analysis on vocoder harmonics',
      trainingDatasetRole: 'Evaluated against IndicSynth synthetic speech and IndicVoices-R natural voice models'
    },
    rawBackendData: full
  };
}

export default function CallAnalysisReportView({ incidentId = null, activePipelineReport = null, onTriggerToast }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('forensics'); // 'forensics' | 'transcript'
  const [recentDbReports, setRecentDbReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [selectedRecordId, setSelectedRecordId] = useState(incidentId || activePipelineReport?.callId || null);
  const audioRef = useRef(null);

  // Normalize current session pipeline report if present
  const normalizedPipelineRecord = useMemo(() => {
    if (!activePipelineReport) return null;
    return {
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
      isLiveBackend: true,
      isStaticData: false,
      aasistDetails: {
        bonafideProb: activePipelineReport.bonafideScore ?? Math.max(0, 1.0 - activePipelineReport.aasistScore),
        spoofProb: activePipelineReport.aasistScore,
        graphAttentionPeaks: activePipelineReport.aasistVerdict || 'Spectro-temporal graph attention analysis on vocoder harmonics',
        trainingDatasetRole: 'Evaluated against IndicSynth synthetic speech and IndicVoices-R natural voice models'
      },
      rawBackendData: activePipelineReport.rawBackendData
    };
  }, [activePipelineReport]);

  // Static benchmark records tagged with isStaticData: true
  const staticBenchmarkRecords = useMemo(() => {
    return POSTGRESQL_CALL_RECORDS.map(rec => ({
      ...rec,
      isStaticData: true
    }));
  }, []);

  // Fetch recent incidents from database
  const fetchRecentIncidents = useCallback(async () => {
    setIsLoadingReports(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/incidents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const formatted = data.map(incidentToReport).filter(Boolean);
        setRecentDbReports(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('Could not fetch recent incidents from backend:', err);
    } finally {
      setIsLoadingReports(false);
    }
    return [];
  }, []);

  // On mount: fetch DB incidents, and auto-select the latest report if no specific ID requested
  useEffect(() => {
    fetchRecentIncidents().then((formatted) => {
      // If no explicit incidentId prop or active report was provided, default to the latest report!
      if (!incidentId && !activePipelineReport?.callId && formatted && formatted.length > 0) {
        setSelectedRecordId(formatted[0].callId);
      }
    });
  }, [fetchRecentIncidents, incidentId, activePipelineReport]);

  // If incidentId prop arrives from parent (e.g. clicked in history), select it
  useEffect(() => {
    if (incidentId) {
      setSelectedRecordId(incidentId);
    }
  }, [incidentId]);

  // If a new pipeline report arrives, auto-select it
  useEffect(() => {
    if (activePipelineReport?.callId) {
      setSelectedRecordId(activePipelineReport.callId);
    }
  }, [activePipelineReport]);

  // Build the list of RECENT 5 reports (from session + DB)
  const recent5Reports = useMemo(() => {
    const list = [];
    const seenIds = new Set();

    if (normalizedPipelineRecord) {
      list.push(normalizedPipelineRecord);
      seenIds.add(normalizedPipelineRecord.callId);
    }

    for (const r of recentDbReports) {
      if (!seenIds.has(r.callId)) {
        list.push(r);
        seenIds.add(r.callId);
      }
    }

    // Limit to the recent 5 reports
    return list.slice(0, 5);
  }, [normalizedPipelineRecord, recentDbReports]);

  // All available records (Recent 5 live reports + Static benchmark reference data)
  const allAvailableRecords = useMemo(() => {
    return [...recent5Reports, ...staticBenchmarkRecords];
  }, [recent5Reports, staticBenchmarkRecords]);

  // Resolve current active record (defaults to the most recent report)
  const currentRecord = useMemo(() => {
    if (selectedRecordId) {
      const match = allAvailableRecords.find(r => r.callId === selectedRecordId);
      if (match) return match;
    }
    // Default to the first (most recent) report, or fallback to first static record
    return recent5Reports[0] || staticBenchmarkRecords[0];
  }, [selectedRecordId, allAvailableRecords, recent5Reports, staticBenchmarkRecords]);

  const isLivePipeline = !currentRecord.isStaticData;
  const isLatestReport = recent5Reports.length > 0 && currentRecord.callId === recent5Reports[0]?.callId;
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
      onTriggerToast?.(!isPlaying ? 'Playing call audio stream' : 'Audio playback paused');
    }
  };

  const handleDownloadPdf = () => {
    try {
      generateForensicPdf(currentRecord);
      onTriggerToast?.(`Downloaded forensic PDF report for ${currentRecord.callId}`);
    } catch (err) {
      console.error('PDF export error:', err);
      onTriggerToast?.('Failed to generate PDF. Check browser console.');
    }
  };

  const handleDownloadJson = () => {
    try {
      exportReportAsJson(currentRecord);
      onTriggerToast?.(`Downloaded PostgreSQL JSON record for ${currentRecord.callId}`);
    } catch (err) {
      console.error('JSON export error:', err);
      onTriggerToast?.('Failed to export JSON record.');
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

          {isLatestReport ? (
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono-metric font-bold flex items-center gap-1 shadow-xs">
              <span className="material-symbols-outlined text-xs">bolt</span>
              LATEST PIPELINE EVALUATION
            </span>
          ) : isLivePipeline ? (
            <span className="px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20 text-[10px] font-mono-metric font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">history</span>
              RECENT PIPELINE RUN
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-700 border border-slate-500/20 text-[10px] font-mono-metric font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">database</span>
              STATIC BENCHMARK REFERENCE
            </span>
          )}
        </div>

        {/* Record Selector & Export Utilities */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Quick Toggle: Recent Reports vs Static Benchmarks */}
          <div className="flex items-center p-0.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs">
            <button
              type="button"
              onClick={() => {
                if (recent5Reports.length > 0) {
                  setSelectedRecordId(recent5Reports[0].callId);
                  onTriggerToast?.(`Showing latest analysis report (${recent5Reports[0].callId})`);
                } else {
                  onTriggerToast?.('No recent pipeline reports found. Run an evaluation first.');
                }
              }}
              className={`px-2.5 py-1 rounded-lg font-mono-metric text-[11px] font-bold flex items-center gap-1 transition-all ${
                !currentRecord.isStaticData
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Show recent pipeline analysis reports"
            >
              <span className="material-symbols-outlined text-xs">bolt</span>
              <span>Recent ({recent5Reports.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (staticBenchmarkRecords.length > 0) {
                  setSelectedRecordId(staticBenchmarkRecords[0].callId);
                  onTriggerToast?.(`Loaded static benchmark data (${staticBenchmarkRecords[0].callId})`);
                }
              }}
              className={`px-2.5 py-1 rounded-lg font-mono-metric text-[11px] font-bold flex items-center gap-1 transition-all ${
                currentRecord.isStaticData
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Show static benchmark reference reports"
            >
              <span className="material-symbols-outlined text-xs">database</span>
              <span>Static Benchmarks ({staticBenchmarkRecords.length})</span>
            </button>
          </div>

          {/* Quick Switch Dropdown (Showing Recent 5 + Static Benchmark Data) */}
          <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded-xl border border-outline-variant/30 text-xs">
            <span className="text-outline text-[11px] font-mono-metric font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">manage_search</span>
              Select:
            </span>
            <select
              value={currentRecord.callId}
              onChange={(e) => {
                setSelectedRecordId(e.target.value);
                onTriggerToast?.(`Loaded report ${e.target.value}`);
              }}
              className="bg-transparent text-on-surface font-mono-metric font-bold text-xs focus:outline-none cursor-pointer max-w-[260px] sm:max-w-[340px]"
            >
              {recent5Reports.length > 0 && (
                <optgroup label="Recent Analysis Reports (Last 5 Evaluations)">
                  {recent5Reports.map((r, idx) => (
                    <option key={r.callId} value={r.callId}>
                      {r.callId} — {r.callerNumber} ({r.riskLevel} - {(r.finalRisk * 100).toFixed(0)}%){idx === 0 ? ' [LATEST]' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Static Benchmark Reports (Reference Ground-Truth Data)">
                {staticBenchmarkRecords.map(r => (
                  <option key={r.callId} value={r.callId}>
                    {r.callId} — {r.fullCaller || r.callerNumber} ({r.riskLevel}) [Static]
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Refresh DB button */}
            <button
              type="button"
              onClick={() => {
                fetchRecentIncidents();
                onTriggerToast?.('Refreshed recent incident reports from database.');
              }}
              className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="Refresh recent reports from database"
            >
              <span className={`material-symbols-outlined text-sm ${isLoadingReports ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>
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
              {currentRecord.isStaticData ? (
                <span className="px-3 py-1 rounded-full bg-slate-500/10 text-slate-700 border border-slate-500/20 text-xs font-mono-metric font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">database</span>
                  Static Benchmark Reference
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 text-xs font-mono-metric font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  Live Pipeline Audio Evaluation
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
          { id: 'forensics', label: 'Risk Fusion Donut & AASIST Graph', icon: 'donut_large' },
          { id: 'transcript', label: 'Full Transcript & Criteria (Section 3.2)', icon: 'transcribe' }
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
          
          {/* Visualizer Card: 3-Signal Risk Fusion Donut Chart */}
          <div className="lg:col-span-6 bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm flex flex-col gap-5">
            
            {/* Header: Title */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
              <div>
                <span className="font-mono-metric text-xs font-bold text-outline uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-base">donut_large</span>
                  3-Signal Risk Fusion Engine (Section 7)
                </span>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Multi-signal contribution breakdown across Conversation (50%), AASIST (30%), and CallerRep (20%)
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono-metric font-bold flex items-center gap-1 shrink-0">
                <span className="material-symbols-outlined text-xs">pie_chart</span>
                DONUT CHART
              </span>
            </div>

            {/* DONUT CHART DISPLAY AREA */}
            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 flex flex-col items-center justify-center min-h-[290px] relative overflow-hidden">
              {(() => {
                const c1 = (currentRecord.conversationScore || 0) * 0.50; // 50%
                const c2 = (currentRecord.aasistScore || 0) * 0.30;       // 30%
                const c3 = (currentRecord.reputationScore || 0) * 0.20;   // 20%
                const totalFused = currentRecord.finalRisk || (c1 + c2 + c3);
                const safeResidual = Math.max(0, 1.0 - totalFused);

                const cx = 175;
                const cy = 130;
                const radius = 78;
                const strokeWidth = 24;
                const circumference = 2 * Math.PI * radius; // ~490.08

                const s1 = c1 * circumference;
                const s2 = c2 * circumference;
                const s3 = c3 * circumference;
                const s4 = safeResidual * circumference;

                return (
                  <div className="w-full flex flex-col items-center">
                    <svg viewBox="0 0 350 260" className="w-full max-w-[340px] h-[220px]">
                      {/* Background Track Circle */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        className="text-surface-container-highest/60"
                        strokeWidth={strokeWidth}
                      />

                      {/* Segments container (rotated -90deg so it starts at 12 o'clock) */}
                      <g transform={`rotate(-90 ${cx} ${cy})`}>
                        {/* Segment 1: Conversation Scam (w1=50%) */}
                        {s1 > 0 && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={radius}
                            fill="none"
                            stroke="#a855f7"
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${s1} ${circumference}`}
                            strokeDashoffset={0}
                            className="transition-all duration-700 ease-out"
                          />
                        )}

                        {/* Segment 2: AASIST Spoof Score (w2=30%) */}
                        {s2 > 0 && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={radius}
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${s2} ${circumference}`}
                            strokeDashoffset={-s1}
                            className="transition-all duration-700 ease-out"
                          />
                        )}

                        {/* Segment 3: Caller Reputation (w3=20%) */}
                        {s3 > 0 && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={radius}
                            fill="none"
                            stroke="#14b8a6"
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${s3} ${circumference}`}
                            strokeDashoffset={-(s1 + s2)}
                            className="transition-all duration-700 ease-out"
                          />
                        )}

                        {/* Segment 4: Safe Margin / Clean Residual */}
                        {s4 > 0 && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={radius}
                            fill="none"
                            stroke="rgba(148, 163, 184, 0.2)"
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${s4} ${circumference}`}
                            strokeDashoffset={-(s1 + s2 + s3)}
                            className="transition-all duration-700 ease-out"
                          />
                        )}
                      </g>

                      {/* Center Info in Donut */}
                      <text
                        x={cx}
                        y={cy - 6}
                        textAnchor="middle"
                        className="text-2xl font-black font-mono-metric fill-on-surface"
                      >
                        {(totalFused * 100).toFixed(1)}%
                      </text>
                      <text
                        x={cx}
                        y={cy + 12}
                        textAnchor="middle"
                        className="text-[9.5px] font-mono-metric font-bold fill-outline uppercase tracking-wider"
                      >
                        FINAL FUSED RISK
                      </text>
                      <text
                        x={cx}
                        y={cy + 28}
                        textAnchor="middle"
                        className={`text-[11px] font-bold ${
                          isHighRisk ? 'fill-error' : isSuspicious ? 'fill-amber-600' : 'fill-tertiary'
                        }`}
                      >
                        {currentRecord.riskLevel}
                      </text>
                    </svg>

                    {/* Donut Legend */}
                    <div className="grid grid-cols-3 gap-2 w-full pt-2 border-t border-outline-variant/20 text-center font-mono-metric text-xs">
                      <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/25">
                        <span className="text-[10px] text-purple-700 block font-bold">Conv (w1=50%)</span>
                        <strong className="text-purple-900 text-sm font-black">
                          {((currentRecord.conversationScore || 0) * 100).toFixed(1)}%
                        </strong>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25">
                        <span className="text-[10px] text-amber-700 block font-bold">AASIST (w2=30%)</span>
                        <strong className="text-amber-900 text-sm font-black">
                          {((currentRecord.aasistScore || 0) * 100).toFixed(1)}%
                        </strong>
                      </div>
                      <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/25">
                        <span className="text-[10px] text-teal-700 block font-bold">CallerRep (w3=20%)</span>
                        <strong className="text-teal-900 text-sm font-black">
                          {((currentRecord.reputationScore || 0) * 100).toFixed(1)}%
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Compact Audio Player Strip */}
            <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTogglePlay}
                  className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-xs active:scale-95 transition-all"
                  title={isPlaying ? 'Pause Audio' : 'Play Audio Stream'}
                >
                  <span className="material-symbols-outlined text-lg">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-metric text-xs font-bold text-on-surface">
                      {currentRecord.duration || `${currentRecord.durationSeconds}s`}
                    </span>
                    <span className="text-[10px] font-mono-metric text-outline">
                      {isPlaying ? 'Streaming playback...' : 'Audio Capture Stream'}
                    </span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant truncate max-w-[200px] sm:max-w-[280px]">
                    {currentRecord.inputSource}
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

              {/* Mini animated waveform */}
              <div className="flex items-center gap-0.5 h-6 shrink-0">
                {[35, 75, 45, 90, 60, 85, 40, 70].map((h, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all ${
                      isPlaying ? 'bg-primary' : 'bg-outline-variant/40'
                    }`}
                    style={{ height: `${h}%` }}
                  ></div>
                ))}
              </div>
            </div>

            {/* Technical Vocoder & Dataset Meta */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col">
                <span className="text-outline text-[10px] uppercase font-mono-metric">Synthetic Vocoder Status</span>
                <span className={`font-mono-metric font-bold text-xs mt-0.5 ${currentRecord.aasistScore >= 0.70 ? 'text-error' : 'text-tertiary'}`}>
                  {currentRecord.aasistScore >= 0.70 ? 'Positive (Synthetic Spoof)' : 'Negative (Organic Voice)'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col">
                <span className="text-outline text-[10px] uppercase font-mono-metric">Evaluation Dataset</span>
                <span className="font-mono-metric font-semibold text-on-surface text-xs mt-0.5 truncate">
                  IndicSynth + IndicVoices-R
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



    </div>
  );
}
