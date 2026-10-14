import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkNumberReputation,
  fetchLiveAnalysis,
  fetchLiveHealth,
  humanizeSignal,
  uploadLiveCall,
  wsUrl,
} from '../services/api';
import { downsampleBuffer, encodeWav, mergeFloat32 } from '../utils/wav';

const TARGET_RATE = 16000;

const INDICATOR_META = {
  urgency: { icon: 'bolt', label: 'Urgency Pressure', tone: 'error' },
  authority: { icon: 'badge', label: 'Authority Impersonation', tone: 'warn' },
  fear_threat: { icon: 'warning', label: 'Fear / Threat', tone: 'error' },
  credential_request: { icon: 'lock_reset', label: 'OTP / Credential Demand', tone: 'error' },
  payment_request: { icon: 'payments', label: 'Payment Request', tone: 'warn' },
  secrecy: { icon: 'visibility_off', label: 'Secrecy Instruction', tone: 'warn' },
  suspicious_contact: { icon: 'link', label: 'Suspicious Contact', tone: 'warn' },
  remote_access: { icon: 'desktop_windows', label: 'Remote Access Ask', tone: 'error' },
};

function formatTimer(sec) {
  const mins = Math.floor(sec / 60);
  const s = sec % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
}

function formatChunkTime(timestamp) {
  return formatTimer(Math.max(0, Math.floor(Number(timestamp) || 0)));
}

function riskTone(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

function chunkToUtterance(chunk, analysis) {
  const text = chunk.text || '';
  const indicators = analysis?.indicators || [];
  const hit = indicators
    .flatMap((ind) => (ind.evidence || []).map((ev) => ({ ...ev, category: ind.category, severity: ind.severity })))
    .find((ev) => ev.text && text.toLowerCase().includes(String(ev.text).toLowerCase()));
  const high = indicators.some((ind) => ind.severity >= 0.7 || ind.category === 'credential_request');
  let type = 'warning';
  if (high || hit?.category === 'credential_request' || hit?.category === 'fear_threat') type = 'critical';
  else if (hit) type = 'danger';
  return {
    id: `${chunk.call_id}-${chunk.chunk_id}`,
    speaker: 'caller',
    name: high ? 'CALLER (FLAGGED BEHAVIOR)' : 'CALLER (LIVE STT)',
    time: formatChunkTime(chunk.timestamp),
    type,
    highlightWord: hit?.text || '',
    badge: high ? `Threat ${analysis?.risk_score ?? ''}%` : null,
    text,
    language: chunk.language,
  };
}

export default function LiveCallMonitorView({ onEndCall, onNotifyGuardian, onTriggerToast }) {
  const [consent, setConsent] = useState(false);
  const [callerNumber, setCallerNumber] = useState('');
  const [realtime, setRealtime] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [audioStreaming, setAudioStreaming] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [callId, setCallId] = useState(null);
  const [sttName, setSttName] = useState('elevenlabs');
  const [language, setLanguage] = useState('—');
  const [utterances, setUtterances] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [statusLabel, setStatusLabel] = useState('Idle');

  const wsRef = useRef(null);
  const recRef = useRef(null);
  const analysisRef = useRef(null);
  const warnedHighRef = useRef(false);

  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);

  useEffect(() => {
    fetchLiveHealth()
      .then((h) => setSttName(h.stt_backend || 'unknown'))
      .catch(() => setSttName('offline'));
  }, []);

  useEffect(() => {
    if (!callActive && !recording) return undefined;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [callActive, recording]);

  const stopSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
  }, []);

  const refreshAnalysis = useCallback(async (id) => {
    try {
      const payload = await fetchLiveAnalysis(id);
      if (payload.analysis) {
        setAnalysis(payload.analysis);
        if (payload.analysis.risk_level === 'high' && !warnedHighRef.current) {
          warnedHighRef.current = true;
          onTriggerToast(`High-risk vishing indicators detected (score ${payload.analysis.risk_score}%).`);
        }
      }
      if (payload.status === 'completed' || payload.status === 'failed') {
        setCallActive(false);
        setAudioStreaming(false);
        setStatusLabel(payload.status === 'failed' ? 'STT failed' : 'Completed');
      }
    } catch {
      /* analysis can lag behind the first chunk */
    }
  }, [onTriggerToast]);

  const openTranscriptSocket = useCallback(
    (id) => {
      stopSocket();
      const socket = new WebSocket(wsUrl(`/calls/${id}/transcripts`));
      wsRef.current = socket;
      socket.onmessage = (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload?.error) {
          onTriggerToast(payload.error.message || 'Live transcription failed.');
          setStatusLabel('Error');
          setCallActive(false);
          return;
        }
        if (typeof payload.chunk_id !== 'number') return;
        setLanguage(payload.language || '—');
        setUtterances((prev) => {
          const next = chunkToUtterance(payload, analysisRef.current);
          const without = prev.filter((u) => u.id !== next.id);
          return [...without, next];
        });
        refreshAnalysis(id);
      };
      socket.onerror = () => {
        onTriggerToast('Transcript stream disconnected. Fetching buffered text…');
        refreshAnalysis(id);
      };
      socket.onclose = () => {
        setCallActive(false);
        setAudioStreaming(false);
        refreshAnalysis(id);
      };
    },
    [onTriggerToast, refreshAnalysis, stopSocket]
  );

  const lookupReputation = useCallback(async () => {
    const number = callerNumber.trim();
    if (!number) {
      setReputation(null);
      return;
    }
    try {
      const data = await checkNumberReputation(number);
      setReputation(data);
    } catch {
      setReputation(null);
    }
  }, [callerNumber]);

  const startFromFile = useCallback(
    async (file) => {
      if (!consent) {
        onTriggerToast('Confirm consent before ingesting audio.');
        return;
      }
      setBusy(true);
      setStatusLabel('Uploading');
      setUtterances([]);
      setAnalysis(null);
      warnedHighRef.current = false;
      setSeconds(0);
      try {
        await lookupReputation();
        const uploaded = await uploadLiveCall(file, { consent: true, realtime });
        setCallId(uploaded.call_id);
        setCallActive(true);
        setAudioStreaming(true);
        setStatusLabel('Transcribing');
        openTranscriptSocket(uploaded.call_id);
        onTriggerToast('Audio accepted. Streaming STT and scam analysis started.');
      } catch (err) {
        setCallActive(false);
        setStatusLabel('Error');
        onTriggerToast(err.message || 'Upload failed.');
      } finally {
        setBusy(false);
      }
    },
    [consent, lookupReputation, onTriggerToast, openTranscriptSocket, realtime]
  );

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) startFromFile(file);
  };

  const stopRecording = useCallback(async () => {
    const rec = recRef.current;
    recRef.current = null;
    setRecording(false);
    if (!rec) return;
    rec.processor.onaudioprocess = null;
    try {
      rec.processor.disconnect();
      rec.source.disconnect();
    } catch {
      /* ignore */
    }
    rec.stream.getTracks().forEach((t) => t.stop());
    try {
      await rec.audioCtx.close();
    } catch {
      /* ignore */
    }
    if (!rec.chunks.length) {
      onTriggerToast('No microphone audio captured.');
      return;
    }
    const merged = mergeFloat32(rec.chunks);
    const resampled = downsampleBuffer(merged, rec.inputRate, TARGET_RATE);
    const blob = encodeWav(resampled, TARGET_RATE);
    const file = new File([blob], 'microphone.wav', { type: 'audio/wav' });
    await startFromFile(file);
  }, [onTriggerToast, startFromFile]);

  const startRecording = useCallback(async () => {
    if (!consent) {
      onTriggerToast('Confirm consent before capturing the microphone.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      const chunks = [];
      processor.onaudioprocess = (event) => {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);
      recRef.current = { stream, audioCtx, source, processor, chunks, inputRate: audioCtx.sampleRate };
      setRecording(true);
      setCallActive(true);
      setAudioStreaming(true);
      setSeconds(0);
      setStatusLabel('Recording');
      onTriggerToast('Microphone armed. Speak, then stop to run STT + scam detection.');
    } catch (err) {
      onTriggerToast(err.message || 'Microphone permission denied.');
    }
  }, [consent, onTriggerToast]);

  const handleEndCallClick = () => {
    if (recording) {
      stopRecording();
      return;
    }
    setCallActive(false);
    setAudioStreaming(false);
    setStatusLabel('Ended');
    stopSocket();
    onEndCall();
  };

  useEffect(() => () => stopSocket(), [stopSocket]);

  const score = analysis?.risk_score ?? 0;
  const confidence = Math.round((analysis?.confidence ?? 0) * 1000) / 10;
  const level = analysis?.risk_level || (callActive ? 'analyzing' : 'idle');
  const ringOffset = 314.15 * (1 - Math.min(100, Math.max(0, score)) / 100);
  const conversationScore = Math.round((analysis?.components?.rule_score ?? 0) * 100);
  const voiceScore = Math.round((analysis?.components?.acoustic_score ?? 0) * 100);
  const reputationScore = reputation
    ? Math.round((reputation.score ?? reputation.risk_score ?? 0) * (reputation.score > 1 ? 1 : 100))
    : 0;
  const tone = riskTone(score);
  const ringColor = !callActive && !score ? '#717786' : tone === 'high' ? '#E53935' : tone === 'mid' ? '#FF9500' : '#34C759';
  const indicators = analysis?.indicators || [];
  const reportCount = reputation?.report_count ?? null;
  const maskedNumber = reputation?.normalized_number_masked || callerNumber || 'Unknown caller';

  return (
    <div className="flex-1 flex flex-col gap-5 pb-28 max-w-[1440px] w-full mx-auto">
      <section className="w-full bg-surface-container-lowest/90 backdrop-blur-xl border border-black/5 rounded-2xl p-4 md:px-6 md:py-4 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-surface-container-high px-2.5 py-1 rounded-full border border-outline-variant/30 font-mono-metric text-mono-metric text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px]">tag</span>
              <span>{callId ? callId.slice(0, 8) : 'no-session'}</span>
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">
              {maskedNumber || 'Live Stream Analysis'}
            </span>
            {reportCount ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container border border-error/20 font-label-sm text-label-sm font-semibold">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                <span>Reported {reportCount} times</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low border border-outline-variant/30 shadow-inner">
              <span className={`w-2 h-2 rounded-full ${callActive ? 'bg-error animate-pulse-subtle' : 'bg-outline'}`} />
              <span className="font-mono-metric text-mono-metric text-on-surface font-semibold">
                {formatTimer(seconds)}
              </span>
              <span className="text-[10px] uppercase font-mono-metric text-outline tracking-wider">
                {statusLabel.toUpperCase()}
              </span>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-surface-container-high border border-outline-variant/20 font-label-sm text-label-sm text-on-surface-variant font-medium">
              Language: <strong className="text-on-surface font-semibold">{language}</strong>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-end">
          <label className="flex items-start gap-2 text-sm text-on-surface-variant max-w-xl">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 accent-primary"
            />
            <span>
              I confirm this recording is synthetic, public-domain, or captured with explicit consent.
              Audio is processed in memory, redacted before buffering, and not stored.
            </span>
          </label>
          <input
            type="tel"
            value={callerNumber}
            onChange={(e) => setCallerNumber(e.target.value)}
            placeholder="Optional caller number (+91…)"
            className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-on-surface-variant whitespace-nowrap">
            <input
              type="checkbox"
              checked={realtime}
              onChange={(e) => setRealtime(e.target.checked)}
              className="accent-primary"
            />
            Wall-clock pacing
          </label>
          <label className={`px-4 py-2 rounded-xl font-label-md font-semibold cursor-pointer text-center ${
            consent && !busy ? 'bg-primary text-on-primary' : 'bg-surface-container text-outline cursor-not-allowed'
          }`}>
            Upload WAV/MP3
            <input
              type="file"
              accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
              className="hidden"
              disabled={!consent || busy || recording}
              onChange={handleFileChange}
            />
          </label>
          <button
            type="button"
            disabled={!consent || busy}
            onClick={recording ? stopRecording : startRecording}
            className="px-4 py-2 rounded-xl bg-surface-container-high border border-outline-variant/30 font-label-md font-semibold disabled:opacity-50"
          >
            {recording ? 'Stop & Analyze' : 'Record Microphone'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-black/5 shadow-sm flex flex-col items-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-[18px]">security</span>
                <span className="font-label-md text-label-md font-semibold text-on-surface uppercase tracking-wide">Threat Assessment</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-outline text-[11px] font-mono-metric">
                Confidence: {analysis ? `${confidence}%` : '—'}
              </span>
            </div>

            <div className="relative w-52 h-52 flex items-center justify-center my-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" fill="none" r="50" stroke="#F4F3F8" strokeLinecap="round" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  fill="none"
                  r="50"
                  stroke={ringColor}
                  strokeDasharray="314.15"
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  strokeWidth="10"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono-metric text-headline-lg font-bold text-on-surface leading-none tracking-tighter">
                  {analysis ? `${score}%` : '—'}
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase mt-1.5 px-2 py-0.5 rounded-full text-on-surface-variant bg-surface-container">
                  {String(level).replace('_', ' ')}
                </span>
              </div>
            </div>
            <p className="text-[12px] text-outline text-center px-4">
              {analysis?.explanation || 'Upload or record a consented call to transcribe with ElevenLabs and score scam indicators in real time.'}
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-black/5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-outline">tune</span>
                <h3 className="font-title text-title font-semibold text-on-surface">Signal Decomposition</h3>
              </div>
              <span className="text-[12px] font-mono-metric text-outline">Rules · Acoustic · Reputation</span>
            </div>
            <ScoreRow label="1. Conversation Analysis" weight="rules" value={conversationScore} note="Social-engineering regex + optional ML" />
            <ScoreRow label="2. Voice / Acoustic Pressure" weight="acoustic" value={voiceScore} note="Non-identifying pause and speaking-rate cues" />
            <ScoreRow
              label="3. Caller Reputation"
              weight="watchlist"
              value={reputationScore}
              note={reputation?.signals?.length ? reputation.signals.map(humanizeSignal).slice(0, 2).join(' · ') : 'Optional number lookup'}
            />
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-black/5 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between text-[12px] font-label-md">
              <div className="flex items-center gap-2 text-on-surface font-semibold">
                <span className="material-symbols-outlined text-[16px] text-primary">equalizer</span>
                Real-Time Spectral Flux
              </div>
              <button
                type="button"
                onClick={() => setAudioStreaming((v) => !v)}
                className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {audioStreaming ? 'pause' : 'play_arrow'}
                </span>
              </button>
            </div>
            <div className="h-12 bg-surface-container-low rounded-lg p-2 flex items-center justify-between gap-1 overflow-hidden">
              {Array.from({ length: 16 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1 rounded-full bg-primary/70 h-${(idx % 6) + 2} ${
                    audioStreaming && callActive ? 'waveform-animate' : ''
                  }`}
                  style={{ height: `${8 + ((idx * 13) % 28)}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-black/5 shadow-sm flex flex-col h-full min-h-[580px]">
            <div className="flex flex-col gap-3 pb-4 border-b border-outline-variant/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">chat_bubble</span>
                  <h3 className="font-title text-title font-semibold text-on-surface">Live Acoustic Transcript</h3>
                </div>
                <div className="flex items-center gap-1.5 text-outline text-[12px] font-mono-metric">
                  <span className={`w-1.5 h-1.5 rounded-full ${callActive ? 'bg-tertiary animate-pulse' : 'bg-outline'}`} />
                  {callActive ? 'Streaming STT' : 'Idle'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {indicators.length === 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm">
                    Waiting for speech
                  </span>
                )}
                {indicators.map((ind) => {
                  const meta = INDICATOR_META[ind.category] || { icon: 'info', label: ind.title, tone: 'warn' };
                  const cls = meta.tone === 'error'
                    ? 'bg-error-container/70 border-error/30 text-error'
                    : 'bg-[#FF9500]/10 border-[#FF9500]/30 text-[#FF9500]';
                  return (
                    <span key={ind.category} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-label-sm text-label-sm font-semibold ${cls}`}>
                      <span className="material-symbols-outlined text-[13px]">{meta.icon}</span>
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 py-4 flex flex-col gap-4 overflow-y-auto pr-1 max-h-[460px] custom-scrollbar">
              {utterances.length === 0 && (
                <p className="text-sm text-outline px-2">
                  No transcript yet. Confirm consent, then upload a call recording or capture the microphone.
                  Chunks are transcribed with ElevenLabs Scribe (Hinglish / hi-IN / en-IN) and scanned for scam patterns.
                </p>
              )}
              {utterances.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-1 items-start max-w-[92%]">
                  <div className="flex items-center gap-2 pl-2">
                    <span className={`font-label-sm text-label-sm font-semibold ${
                      msg.type === 'critical' ? 'text-error' : msg.type === 'warning' ? 'text-[#FF9500]' : 'text-primary'
                    }`}>
                      {msg.name}
                    </span>
                    <span className="font-mono-metric text-[11px] text-outline">{msg.time}</span>
                    {msg.language ? (
                      <span className="font-mono-metric text-[10px] text-outline uppercase">{msg.language}</span>
                    ) : null}
                  </div>
                  <div className={`p-3.5 rounded-2xl rounded-tl-sm leading-relaxed text-body-md relative ${
                    msg.type === 'critical'
                      ? 'bg-error-container/40 border border-error/30'
                      : msg.type === 'danger'
                        ? 'bg-error-container/30 border border-error/20'
                        : 'bg-surface-container-high/60 border border-outline-variant/30'
                  }`}>
                    {msg.badge && (
                      <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded bg-error text-on-error text-[10px] font-bold font-mono-metric uppercase tracking-wide">
                        {msg.badge}
                      </div>
                    )}
                    {msg.highlightWord && msg.text.includes(msg.highlightWord) ? (
                      <>
                        {msg.text.split(msg.highlightWord)[0]}
                        <mark className="bg-error/20 text-error font-bold px-1.5 py-0.5 rounded border border-error/40">
                          {msg.highlightWord}
                        </mark>
                        {msg.text.split(msg.highlightWord).slice(1).join(msg.highlightWord)}
                      </>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}
              {callActive && (
                <div className="flex items-center gap-2 text-outline text-[12px] pt-2 italic pl-2">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span>Streaming speech-to-text and updating scam scores…</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-outline-variant/15 flex items-center justify-between text-[11px] text-outline font-mono-metric">
              <span>STT: {sttName}</span>
              <span>{analysis ? `${analysis.processing_ms ?? 0}ms analysis` : 'Latency: live'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 left-4 right-4 md:left-80 md:right-8 z-30 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-full max-w-4xl bg-surface-container-lowest/90 backdrop-blur-2xl border border-white/60 p-2.5 md:p-3 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface-container-high/60 border border-outline-variant/30 text-on-surface">
            <div className={`w-2.5 h-2.5 rounded-full ${callActive ? 'bg-tertiary-container animate-pulse' : 'bg-outline'}`} />
            <span className="font-label-md text-label-md">
              Guardian Rohan linked <span className="font-mono-metric text-on-surface-variant font-medium">(+91 9820XXXXXX)</span> • <strong className="text-tertiary font-semibold">Armed</strong>
            </span>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                onNotifyGuardian();
                onTriggerToast('Guardian Rohan alerted with the current live-session summary.');
              }}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-high/80 hover:bg-surface-container-highest border border-outline-variant/30 text-on-surface font-label-md text-label-md font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
              <span>Notify Guardian Now</span>
            </button>
            <button
              type="button"
              onClick={handleEndCallClick}
              disabled={!callActive && !recording}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-label-md text-label-md font-bold shadow-md ${
                callActive || recording
                  ? 'bg-error hover:bg-error/90 text-on-error'
                  : 'bg-surface-container text-outline cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">call_end</span>
              <span>{callActive || recording ? 'End Call Immediately' : 'Call Terminated'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, weight, value, note }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline font-body-md text-body-md">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-on-surface">{label}</span>
          <span className="text-[11px] font-mono-metric text-outline bg-surface-container-high px-1.5 py-0.5 rounded">{weight}</span>
        </div>
        <span className="font-mono-metric font-semibold text-on-surface">{value}%</span>
      </div>
      <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
        <div className="h-full bg-[#FF9500] rounded-full transition-all duration-500" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-[11px] text-outline">{note}</span>
    </div>
  );
}
