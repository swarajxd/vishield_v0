import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkNumberReputation,
  fetchLiveHealth,
  fetchScribeToken,
  fetchSTTStatus,
  humanizeSignal,
  transcribeAudioFile,
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
  trust_building: { icon: 'verified_user', label: 'Trust Building / Rapport', tone: 'warn' },
};

function formatTimer(sec) {
  const mins = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
}

function formatChunkTime(timestamp) {
  return formatTimer(Math.max(0, Math.floor(Number(timestamp) || 0)));
}

function floatTo16BitPCM(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function base64EncodeAudio(int16Array) {
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
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
  const [language, setLanguage] = useState('—');
  const [utterances, setUtterances] = useState([]);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [statusLabel, setStatusLabel] = useState('Idle');
  const [hasError, setHasError] = useState(false);
  const [sttStatus, setSttStatus] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  const wsRef = useRef(null);
  const recRef = useRef(null);
  const analysisRef = useRef(null);
  const warnedHighRef = useRef(false);
  const transcriptScrollRef = useRef(null);
  const userScrolledUpRef = useRef(false);
  const chunkSendTimesRef = useRef(new Map());
  const cancelPacingRef = useRef(false);
  const lastSpeechTimeRef = useRef(Date.now());

  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);

  // STT configuration check on mount
  const checkStatus = useCallback(async () => {
    try {
      const data = await fetchSTTStatus();
      setSttStatus(data);
    } catch {
      fetchLiveHealth()
        .then((h) => {
          setSttStatus({
            provider: h.stt_backend || 'unknown',
            key_configured: h.stt_backend === 'elevenlabs',
            model: 'scribe_v1',
            ok: true,
            allow_mock: false,
          });
        })
        .catch(() => {
          setSttStatus({
            provider: 'offline',
            key_configured: false,
            model: 'none',
            ok: false,
            allow_mock: false,
            error: 'Backend is unreachable. Please start uvicorn.',
          });
        });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Session timer
  useEffect(() => {
    if (!callActive && !recording) return undefined;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [callActive, recording]);

  // Auto-scroll transcript container unless user scrolled up
  useEffect(() => {
    if (transcriptScrollRef.current && !userScrolledUpRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [utterances, partialTranscript]);

  const handleTranscriptScroll = () => {
    if (!transcriptScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = transcriptScrollRef.current;
    userScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 35;
  };

  const lookupReputation = useCallback(async (numberOverride) => {
    const number = (numberOverride ?? callerNumber).trim();
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

  // Close live WebSocket cleanly
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

  // Clear transcript and reset scores
  const clearTranscript = () => {
    setUtterances([]);
    setPartialTranscript('');
    setAnalysis(null);
    setLanguage('—');
    setCallId(null);
    setSeconds(0);
    setStatusLabel('Idle');
    setHasError(false);
    warnedHighRef.current = false;
    onTriggerToast('Transcript and threat analysis cleared.');
  };

  // Copy transcript to clipboard
  const copyTranscript = () => {
    const text = utterances.map((u) => `[${u.time}] ${u.name}: ${u.text}`).join('\n');
    if (!text && !partialTranscript) {
      onTriggerToast('No transcript to copy.');
      return;
    }
    const full = text + (partialTranscript ? `\n[Partial] ${partialTranscript}` : '');
    navigator.clipboard.writeText(full).then(
      () => onTriggerToast('Transcript copied to clipboard!'),
      () => onTriggerToast('Failed to copy to clipboard.')
    );
  };

  // Process batch transcription response
  const applyBatchResult = useCallback(
    (res, fileMeta) => {
      setLanguage(res.language || 'en-IN');
      if (res.analysis) {
        setAnalysis(res.analysis);
        if (res.analysis.risk_level === 'high' && !warnedHighRef.current) {
          warnedHighRef.current = true;
          onTriggerToast(`High-risk vishing indicators detected (${res.analysis.risk_score}%).`);
        }
      }

      const high = res.analysis?.risk_level === 'high';
      const newUtterances = (res.segments || []).map((seg, idx) => ({
        id: `seg-${idx}-${Date.now()}`,
        speaker: 'caller',
        name: res.is_mock
          ? 'SAMPLE / MOCK TRANSCRIPT'
          : high
            ? 'CALLER (FLAGGED BEHAVIOR)'
            : 'CALLER (ELEVENLABS)',
        time: formatChunkTime(seg.start),
        type: high ? 'critical' : 'warning',
        badge: res.is_mock ? 'MOCK' : high ? `Threat ${res.analysis?.risk_score ?? ''}%` : null,
        text: seg.text,
        language: res.language,
      }));

      if (!newUtterances.length && res.transcript) {
        newUtterances.push({
          id: `full-${Date.now()}`,
          speaker: 'caller',
          name: res.is_mock ? 'SAMPLE / MOCK' : 'CALLER (ELEVENLABS)',
          time: '00:00',
          type: high ? 'critical' : 'warning',
          badge: res.is_mock ? 'MOCK' : null,
          text: res.transcript,
          language: res.language,
        });
      }

      setUtterances(newUtterances);
      setPartialTranscript('');
      setStatusLabel('Completed');
      setCallActive(false);
      setAudioStreaming(false);
      onTriggerToast(
        res.is_mock
          ? 'Sample mock transcript rendered (no ElevenLabs key configured).'
          : `Transcription complete (${newUtterances.length} segments).`
      );
    },
    [onTriggerToast]
  );

  // File upload handler (paced vs unpaced)
  const startFromFile = useCallback(
    async (file) => {
      if (!consent) {
        onTriggerToast('Confirm consent before ingesting audio.');
        return;
      }
      if (sttStatus && !sttStatus.key_configured && !sttStatus.allow_mock) {
        onTriggerToast('ElevenLabs API key is not configured. Add it to caller_reputation/.env.');
        return;
      }

      setBusy(true);
      setHasError(false);
      setUtterances([]);
      setPartialTranscript('');
      setAnalysis(null);
      setSeconds(0);
      warnedHighRef.current = false;
      cancelPacingRef.current = false;

      await lookupReputation();

      // Wall-clock pacing OFF: Standard batch endpoint
      if (!realtime) {
        setStatusLabel('Transcribing');
        setCallActive(true);
        setAudioStreaming(true);
        setUploadProgress({ name: file.name, duration: null });
        try {
          const res = await transcribeAudioFile(file, { consent: true });
          applyBatchResult(res, { name: file.name });
        } catch (err) {
          setHasError(true);
          setStatusLabel('Error');
          setCallActive(false);
          setAudioStreaming(false);
          onTriggerToast(err.message || 'Transcription failed.');
        } finally {
          setBusy(false);
          setUploadProgress(null);
        }
        return;
      }

      // Wall-clock pacing ON: Decode in browser to 16 kHz PCM and stream at real-time rate
      setStatusLabel('Pacing Stream');
      setCallActive(true);
      setAudioStreaming(true);
      setUploadProgress({ name: file.name, pacing: true });

      try {
        const arrayBuf = await file.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        const pcmData = decoded.getChannelData(0);
        const durationSec = Math.round(decoded.duration);
        setUploadProgress({ name: file.name, duration: durationSec, pacing: true });

        // First attempt real-time token for ElevenLabs realtime Scribe
        let tokenData = null;
        try {
          tokenData = await fetchScribeToken(true);
        } catch {
          /* Token failed or not supported; fallback to simulated pacing + batch */
        }

        const chunkSize = 16000 * 0.25; // 250ms chunks
        const totalChunks = Math.ceil(pcmData.length / chunkSize);
        let chunkIdx = 0;

        if (tokenData?.token) {
          const ws = new WebSocket(
            `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=${tokenData.token}&audio_format=pcm_16000`
          );
          wsRef.current = ws;

          ws.onopen = () => {
            const timer = setInterval(() => {
              if (cancelPacingRef.current || chunkIdx >= totalChunks || ws.readyState !== WebSocket.OPEN) {
                clearInterval(timer);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: '', commit: true, sample_rate: 16000 }));
                }
                return;
              }
              const slice = pcmData.subarray(chunkIdx * chunkSize, (chunkIdx + 1) * chunkSize);
              const pcm16 = floatTo16BitPCM(slice);
              const b64 = base64EncodeAudio(pcm16);
              const sendTime = performance.now();
              chunkSendTimesRef.current.set(chunkIdx, sendTime);
              ws.send(JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: b64, commit: false, sample_rate: 16000 }));
              chunkIdx++;
            }, 250);
          };

          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.message_type === 'partial_transcript') {
                setPartialTranscript(msg.text || '');
              } else if (msg.message_type === 'committed_transcript') {
                const now = performance.now();
                setLatencyMs(Math.round(now - (chunkSendTimesRef.current.get(chunkIdx - 1) || now)));
                setPartialTranscript('');
                setUtterances((prev) => [
                  ...prev,
                  {
                    id: `comm-${Date.now()}-${Math.random()}`,
                    speaker: 'caller',
                    name: 'CALLER (PACED STREAM)',
                    time: formatTimer(seconds),
                    type: 'warning',
                    text: msg.text || '',
                  },
                ]);
              }
            } catch {
              /* ignore parse errors */
            }
          };

          ws.onclose = async () => {
            setCallActive(false);
            setAudioStreaming(false);
            setBusy(false);
            setUploadProgress(null);
            // Run final batch analysis for complete indicator scoring
            try {
              const batchRes = await transcribeAudioFile(file, { consent: true });
              applyBatchResult(batchRes, { name: file.name });
            } catch {
              /* ignore */
            }
          };
          return;
        }

        // Fallback paced simulation
        const pacer = setInterval(() => {
          if (cancelPacingRef.current || chunkIdx >= totalChunks) {
            clearInterval(pacer);
            transcribeAudioFile(file, { consent: true })
              .then((res) => applyBatchResult(res, { name: file.name }))
              .catch((err) => {
                setHasError(true);
                setStatusLabel('Error');
                onTriggerToast(err.message || 'Transcription failed.');
              })
              .finally(() => {
                setBusy(false);
                setUploadProgress(null);
              });
            return;
          }
          chunkIdx++;
        }, 250);
      } catch (err) {
        setHasError(true);
        setStatusLabel('Error');
        setCallActive(false);
        setAudioStreaming(false);
        setBusy(false);
        setUploadProgress(null);
        onTriggerToast(err.message || 'Paced streaming failed.');
      }
    },
    [applyBatchResult, consent, lookupReputation, onTriggerToast, realtime, seconds, sttStatus]
  );

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) startFromFile(file);
  };

  // Stop Microphone recording
  const stopRecording = useCallback(async () => {
    const rec = recRef.current;
    recRef.current = null;
    setRecording(false);
    stopSocket();

    if (!rec) return;

    setStatusLabel('Transcribing');
    setBusy(true);

    // Stop tracks
    if (rec.stream) {
      rec.stream.getTracks().forEach((t) => t.stop());
    }

    // Stop MediaRecorder and collect blob
    if (rec.mediaRecorder && rec.mediaRecorder.state !== 'inactive') {
      rec.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(rec.chunks, { type: rec.mediaRecorder.mimeType || 'audio/webm' });
        const file = new File([audioBlob], 'microphone-recording.webm', {
          type: rec.mediaRecorder.mimeType || 'audio/webm',
        });
        try {
          const res = await transcribeAudioFile(file, { consent: true });
          applyBatchResult(res, { name: 'Live Microphone' });
        } catch (err) {
          setHasError(true);
          setStatusLabel('Error');
          setCallActive(false);
          setAudioStreaming(false);
          onTriggerToast(err.message || 'Microphone transcription failed.');
        } finally {
          setBusy(false);
        }
      };
      rec.mediaRecorder.stop();
    } else {
      setBusy(false);
      setCallActive(false);
      setStatusLabel('Completed');
    }
  }, [applyBatchResult, onTriggerToast, stopSocket]);

  // Start Microphone recording
  const startRecording = useCallback(async () => {
    if (!consent) {
      onTriggerToast('Confirm consent before capturing the microphone.');
      return;
    }
    if (sttStatus && !sttStatus.key_configured && !sttStatus.allow_mock) {
      onTriggerToast('ElevenLabs API key is not configured. Add it to caller_reputation/.env.');
      return;
    }

    setUtterances([]);
    setPartialTranscript('');
    setAnalysis(null);
    setSeconds(0);
    setHasError(false);
    warnedHighRef.current = false;
    lastSpeechTimeRef.current = Date.now();

    await lookupReputation();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? { mimeType: 'audio/ogg;codecs=opus' }
          : {};

      const mediaRecorder = new MediaRecorder(stream, options);
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
          lastSpeechTimeRef.current = Date.now();
        }
      };
      mediaRecorder.start(250);

      // Attempt live streaming over ElevenLabs Realtime WebSocket via token
      let ws = null;
      try {
        const tokenRes = await fetchScribeToken(true);
        if (tokenRes?.token) {
          ws = new WebSocket(
            `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=${tokenRes.token}&audio_format=pcm_16000`
          );
          wsRef.current = ws;

          // Set up audio context to downsample and stream PCM16
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          let pcmChunks = [];

          processor.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            pcmChunks.push(new Float32Array(input));
            if (pcmChunks.length >= 2 && ws.readyState === WebSocket.OPEN) {
              const merged = mergeFloat32(pcmChunks);
              pcmChunks = [];
              const resampled = downsampleBuffer(merged, audioCtx.sampleRate, 16000);
              const pcm16 = floatTo16BitPCM(resampled);
              const b64 = base64EncodeAudio(pcm16);
              ws.send(JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: b64, commit: false, sample_rate: 16000 }));
            }
          };

          source.connect(processor);
          processor.connect(audioCtx.destination);

          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.message_type === 'partial_transcript') {
                setPartialTranscript(msg.text || '');
              } else if (msg.message_type === 'committed_transcript') {
                setPartialTranscript('');
                setUtterances((prev) => [
                  ...prev,
                  {
                    id: `live-${Date.now()}-${Math.random()}`,
                    speaker: 'caller',
                    name: 'CALLER (LIVE STT)',
                    time: formatTimer(seconds),
                    type: 'warning',
                    text: msg.text || '',
                  },
                ]);
              }
            } catch {
              /* ignore */
            }
          };
        }
      } catch {
        /* Realtime token not available, MediaRecorder will handle batch on stop */
      }

      recRef.current = { stream, mediaRecorder, chunks, ws };
      setRecording(true);
      setCallActive(true);
      setAudioStreaming(true);
      setStatusLabel('Recording');
      onTriggerToast('Recording started. Speak, then click Stop & Analyze.');
    } catch (err) {
      setHasError(true);
      setStatusLabel('Error');
      onTriggerToast(err.message || 'Microphone access denied or unavailable.');
    }
  }, [consent, lookupReputation, onTriggerToast, seconds, sttStatus]);

  // Silence timeout: auto-stop after 60s of silence while recording
  useEffect(() => {
    if (!recording) return undefined;
    const interval = setInterval(() => {
      if (Date.now() - lastSpeechTimeRef.current > 60000) {
        onTriggerToast('60s silence timeout reached. Auto-stopping to preserve quota.');
        stopRecording();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [recording, stopRecording, onTriggerToast]);

  const handleEndCallClick = () => {
    if (recording) {
      stopRecording();
      return;
    }
    cancelPacingRef.current = true;
    setCallActive(false);
    setAudioStreaming(false);
    setStatusLabel('Ended');
    stopSocket();
    onEndCall();
  };

  useEffect(() => () => stopSocket(), [stopSocket]);

  // Fusion Threat Assessment (0.50 conversation, 0.30 acoustic, 0.20 reputation)
  // Renormalized when acoustic is unavailable
  const convRaw =
    analysis?.components?.rule_score != null
      ? analysis.components.rule_score
      : analysis?.risk_score != null
        ? analysis.risk_score / 100
        : 0;
  const repRaw =
    reputation && callerNumber.trim()
      ? (reputation.score ?? reputation.risk_score ?? 0) / (reputation.score > 1 ? 100 : 1)
      : null;

  let fusedScore = 0;
  if (repRaw != null) {
    const wConv = 0.5 / (0.5 + 0.2); // ~0.714
    const wRep = 0.2 / (0.5 + 0.2); // ~0.286
    fusedScore = Math.round((convRaw * wConv + repRaw * wRep) * 100);
  } else {
    fusedScore = Math.round(convRaw * 100);
  }
  fusedScore = Math.min(100, Math.max(0, fusedScore));

  let threatLevel = 'SAFE';
  if (fusedScore >= 70) threatLevel = 'HIGH RISK';
  else if (fusedScore >= 40) threatLevel = 'SUSPICIOUS';
  else if (!analysis && !utterances.length) threatLevel = 'IDLE';

  const ringColor =
    threatLevel === 'IDLE'
      ? '#717786'
      : threatLevel === 'HIGH RISK'
        ? '#E53935'
        : threatLevel === 'SUSPICIOUS'
          ? '#FF9500'
          : '#34C759';

  const ringOffset = 314.15 * (1 - (threatLevel === 'IDLE' ? 0 : fusedScore) / 100);
  const confidence = Math.round((analysis?.confidence ?? 0.85) * 1000) / 10;
  const conversationScore = Math.round(convRaw * 100);
  const voiceScore = 0; // AASIST / acoustic pressure is not active
  const reputationScore = repRaw != null ? Math.round(repRaw * 100) : null;
  const indicators = analysis?.indicators || [];
  const maskedNumber = reputation?.normalized_number_masked || callerNumber || 'Unknown caller';

  return (
    <div className="flex-1 flex flex-col gap-5 pb-28 max-w-[1440px] w-full mx-auto">
      {/* Banner if STT key is missing and mock is not allowed */}
      {sttStatus && !sttStatus.key_configured && !sttStatus.allow_mock && (
        <div className="w-full p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[24px] text-amber-500">key_off</span>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">ElevenLabs API Key Required</span>
              <span className="text-xs text-on-surface-variant">
                Add <code className="bg-surface-container-high px-1 py-0.5 rounded font-mono-metric">ELEVENLABS_API_KEY</code> to{' '}
                <code className="bg-surface-container-high px-1 py-0.5 rounded font-mono-metric">caller_reputation/.env</code> and restart the backend.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={checkStatus}
            className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-xs font-semibold text-on-surface self-end sm:self-auto"
          >
            Check Status
          </button>
        </div>
      )}

      {/* Control Strip Section */}
      <section className="w-full bg-surface-container-lowest/90 backdrop-blur-xl border border-black/5 rounded-2xl p-4 md:px-6 md:py-4 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-surface-container-high px-2.5 py-1 rounded-full border border-outline-variant/30 font-mono-metric text-mono-metric text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px]">tag</span>
              <span>{callId ? callId.slice(0, 8) : 'no-session'}</span>
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">
              {maskedNumber}
            </span>
            {reputation?.report_count ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container border border-error/20 font-label-sm text-label-sm font-semibold">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                <span>Reported {reputation.report_count} times</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
            {/* Timer Chip: Only displays ERROR when an actual error occurred */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low border border-outline-variant/30 shadow-inner">
              <span
                className={`w-2 h-2 rounded-full ${
                  callActive || recording
                    ? 'bg-error animate-pulse-subtle'
                    : hasError
                      ? 'bg-error'
                      : 'bg-outline'
                }`}
              />
              <span className="font-mono-metric text-mono-metric text-on-surface font-semibold">
                {formatTimer(seconds)}
              </span>
              <span
                className={`text-[10px] uppercase font-mono-metric tracking-wider ${
                  hasError ? 'text-error font-bold' : 'text-outline'
                }`}
              >
                {hasError ? 'ERROR' : (callActive || recording ? statusLabel.toUpperCase() : 'IDLE')}
              </span>
            </div>

            {/* Language Chip */}
            <div className="px-2.5 py-1 rounded-full bg-surface-container-high border border-outline-variant/20 font-label-sm text-label-sm text-on-surface-variant font-medium">
              Language: <strong className="text-on-surface font-semibold">{language}</strong>
            </div>
          </div>
        </div>

        {/* Inputs & Actions */}
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
            onBlur={() => lookupReputation()}
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

          {/* Upload Button */}
          <label
            className={`px-4 py-2 rounded-xl font-label-md font-semibold cursor-pointer text-center ${
              consent && !busy && (!sttStatus || sttStatus.key_configured || sttStatus.allow_mock)
                ? 'bg-primary text-on-primary hover:bg-primary/90'
                : 'bg-surface-container text-outline cursor-not-allowed opacity-50'
            }`}
          >
            Upload WAV/MP3
            <input
              type="file"
              accept=".wav,.mp3,.m4a,.ogg,.webm,audio/wav,audio/mpeg,audio/mp4,audio/ogg,audio/webm"
              className="hidden"
              disabled={!consent || busy || recording || (sttStatus && !sttStatus.key_configured && !sttStatus.allow_mock)}
              onChange={handleFileChange}
            />
          </label>

          {/* Record / Stop Button */}
          <button
            type="button"
            disabled={!consent || busy || (sttStatus && !sttStatus.key_configured && !sttStatus.allow_mock && !recording)}
            onClick={recording ? stopRecording : startRecording}
            className={`px-4 py-2 rounded-xl border border-outline-variant/30 font-label-md font-semibold transition-all ${
              recording
                ? 'bg-error text-on-error hover:bg-error/90 animate-pulse'
                : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface disabled:opacity-50'
            }`}
          >
            {recording ? 'Stop & Analyze' : 'Record Microphone'}
          </button>
        </div>

        {uploadProgress && (
          <div className="flex items-center justify-between text-xs text-outline px-1 font-mono-metric">
            <span>
              Processing: <strong>{uploadProgress.name}</strong> {uploadProgress.pacing ? '(Wall-clock paced)' : ''}
            </span>
            <button
              type="button"
              onClick={() => {
                cancelPacingRef.current = true;
                setBusy(false);
                setCallActive(false);
                setUploadProgress(null);
              }}
              className="text-error hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* Grid: Left Assessment & Right Transcript */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Threat Assessment & Signals */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-black/5 shadow-sm flex flex-col items-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-[18px]">security</span>
                <span className="font-label-md text-label-md font-semibold text-on-surface uppercase tracking-wide">
                  Threat Assessment
                </span>
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
                  {threatLevel === 'IDLE' ? '—' : `${fusedScore}%`}
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase mt-1.5 px-2 py-0.5 rounded-full text-on-surface-variant bg-surface-container">
                  {threatLevel}
                </span>
              </div>
            </div>
            <p className="text-[12px] text-outline text-center px-4">
              {analysis?.explanation ||
                'Upload or record a consented call to transcribe with ElevenLabs and score scam indicators in real time.'}
            </p>
            <span className="text-[10px] font-mono-metric text-outline/80 mt-2">
              Partial signals: acoustic unavailable · fusion 0.50 / 0.30 / 0.20
            </span>
          </div>

          {/* Signal Decomposition */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-black/5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-outline">tune</span>
                <h3 className="font-title text-title font-semibold text-on-surface">Signal Decomposition</h3>
              </div>
              <span className="text-[12px] font-mono-metric text-outline">Rules · Acoustic · Reputation</span>
            </div>
            <ScoreRow
              label="1. Conversation Analysis"
              weight="rules"
              value={conversationScore}
              note="Social-engineering regex + indicators"
            />
            <ScoreRow
              label="2. Voice / Acoustic Pressure"
              weight="acoustic"
              value={voiceScore}
              note="Non-identifying pause cues (AASIST unavailable)"
            />
            <ScoreRow
              label="3. Caller Reputation"
              weight="watchlist"
              value={reputationScore != null ? reputationScore : 0}
              note={
                reputation?.signals?.length
                  ? reputation.signals.map(humanizeSignal).slice(0, 2).join(' · ')
                  : callerNumber.trim()
                    ? 'No negative reputation records'
                    : 'No number provided'
              }
            />
          </div>

          {/* Spectral Flux */}
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
                  className={`w-1 rounded-full bg-primary/70 ${audioStreaming && callActive ? 'waveform-animate' : ''}`}
                  style={{ height: `${8 + ((idx * 13) % 28)}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Acoustic Transcript */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-black/5 shadow-sm flex flex-col h-full min-h-[580px]">
            {/* Transcript Card Header */}
            <div className="flex flex-col gap-3 pb-4 border-b border-outline-variant/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">chat_bubble</span>
                  <h3 className="font-title text-title font-semibold text-on-surface">Live Acoustic Transcript</h3>
                </div>

                <div className="flex items-center gap-3">
                  {/* Copy & Clear Actions */}
                  <button
                    type="button"
                    onClick={copyTranscript}
                    disabled={!utterances.length && !partialTranscript}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-on-surface disabled:opacity-40"
                    title="Copy transcript"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    <span>Copy</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearTranscript}
                    disabled={!utterances.length && !partialTranscript && !analysis}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-surface-container-high hover:bg-error-container/30 border border-outline-variant/30 text-outline hover:text-error disabled:opacity-40"
                    title="Clear transcript"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    <span>Clear</span>
                  </button>

                  {/* Status Pill */}
                  <div className="flex items-center gap-1.5 text-outline text-[12px] font-mono-metric pl-2 border-l border-outline-variant/30">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        callActive || recording ? 'bg-tertiary animate-pulse' : hasError ? 'bg-error' : 'bg-outline'
                      }`}
                    />
                    <span>{statusLabel}</span>
                  </div>
                </div>
              </div>

              {/* Indicator Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {indicators.length === 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm">
                    Waiting for speech
                  </span>
                )}
                {indicators.map((ind) => {
                  const meta = INDICATOR_META[ind.category] || { icon: 'info', label: ind.title, tone: 'warn' };
                  const cls =
                    meta.tone === 'error'
                      ? 'bg-error-container/70 border-error/30 text-error'
                      : 'bg-[#FF9500]/10 border-[#FF9500]/30 text-[#FF9500]';
                  return (
                    <span
                      key={ind.category}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-label-sm text-label-sm font-semibold ${cls}`}
                    >
                      <span className="material-symbols-outlined text-[13px]">{meta.icon}</span>
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Transcript Scroll Area */}
            <div
              ref={transcriptScrollRef}
              onScroll={handleTranscriptScroll}
              className="flex-1 py-4 flex flex-col gap-4 overflow-y-auto pr-1 max-h-[460px] custom-scrollbar"
            >
              {utterances.length === 0 && !partialTranscript && (
                <p className="text-sm text-outline px-2">
                  No transcript yet. Confirm consent, then upload a call recording or capture the microphone. Chunks are
                  transcribed with ElevenLabs Scribe (Hinglish / hi-IN / en-IN) and scanned for scam patterns.
                </p>
              )}

              {utterances.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-1 items-start max-w-[92%]">
                  <div className="flex items-center gap-2 pl-2">
                    <span
                      className={`font-label-sm text-label-sm font-semibold ${
                        msg.type === 'critical' ? 'text-error' : msg.type === 'warning' ? 'text-[#FF9500]' : 'text-primary'
                      }`}
                    >
                      {msg.name}
                    </span>
                    <span className="font-mono-metric text-[11px] text-outline">{msg.time}</span>
                    {msg.language ? (
                      <span className="font-mono-metric text-[10px] text-outline uppercase">{msg.language}</span>
                    ) : null}
                  </div>
                  <div
                    className={`p-3.5 rounded-2xl rounded-tl-sm leading-relaxed text-body-md relative ${
                      msg.type === 'critical'
                        ? 'bg-error-container/40 border border-error/30'
                        : msg.type === 'danger'
                          ? 'bg-error-container/30 border border-error/20'
                          : 'bg-surface-container-high/60 border border-outline-variant/30'
                    }`}
                  >
                    {msg.badge && (
                      <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded bg-error text-on-error text-[10px] font-bold font-mono-metric uppercase tracking-wide">
                        {msg.badge}
                      </div>
                    )}
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Partial Streaming Transcript (Muted / Italicized at bottom) */}
              {partialTranscript && (
                <div className="flex flex-col gap-1 items-start max-w-[92%] opacity-85">
                  <div className="flex items-center gap-2 pl-2 text-primary text-xs font-mono-metric">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    <span>LIVE INTERIM HYPOTHESIS:</span>
                  </div>
                  <div className="p-3.5 rounded-2xl rounded-tl-sm leading-relaxed text-body-md italic bg-surface-container-high/30 border border-dashed border-primary/40 text-on-surface-variant">
                    {partialTranscript}
                  </div>
                </div>
              )}

              {(callActive || recording) && !partialTranscript && (
                <div className="flex items-center gap-2 text-outline text-[12px] pt-2 italic pl-2">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span>{recording ? 'Listening to microphone stream…' : 'Processing audio stream…'}</span>
                </div>
              )}
            </div>

            {/* Footer with STT Provider badge and Latency */}
            <div className="pt-3 border-t border-outline-variant/15 flex items-center justify-between text-[11px] text-outline font-mono-metric">
              <div>
                {sttStatus?.key_configured ? (
                  <span>
                    STT: elevenlabs · <strong>{sttStatus.model || 'scribe_v1'}</strong>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30 font-semibold">
                    STT: MOCK (no ElevenLabs key set)
                  </span>
                )}
              </div>
              <span>Latency: {latencyMs != null ? `${latencyMs}ms` : analysis?.processing_ms ? `${analysis.processing_ms}ms analysis` : 'live'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Guardian Bar (Untouched) */}
      <div className="fixed bottom-4 left-4 right-4 md:left-80 md:right-8 z-30 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-full max-w-4xl bg-surface-container-lowest/90 backdrop-blur-2xl border border-white/60 p-2.5 md:p-3 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface-container-high/60 border border-outline-variant/30 text-on-surface">
            <div className={`w-2.5 h-2.5 rounded-full ${callActive ? 'bg-tertiary-container animate-pulse' : 'bg-outline'}`} />
            <span className="font-label-md text-label-md">
              Guardian Rohan linked <span className="font-mono-metric text-on-surface-variant font-medium">(+91 9820XXXXXX)</span> •{' '}
              <strong className="text-tertiary font-semibold">Armed</strong>
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
          <span className="text-[11px] font-mono-metric text-outline bg-surface-container-high px-1.5 py-0.5 rounded">
            {weight}
          </span>
        </div>
        <span className="font-mono-metric font-semibold text-on-surface">{value}%</span>
      </div>
      <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FF9500] rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-[11px] text-outline">{note}</span>
    </div>
  );
}
