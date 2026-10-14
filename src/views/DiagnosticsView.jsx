import React from 'react';

export default function DiagnosticsView({ onTriggerToast }) {
  const engineNodes = [
    { name: 'Acoustic Synthesizer Neural Net (Whisper-Apex v3.4)', status: 'Operational', latency: '42ms', load: '18%', health: '99.98%' },
    { name: 'Spectral Glitch Detector (FFT-Spectra v2)', status: 'Operational', latency: '12ms', load: '34%', health: '100%' },
    { name: 'Voiceprint Biometric Verifier (XTTS-AntiClone)', status: 'Operational', latency: '68ms', load: '41%', health: '99.94%' },
    { name: 'TRAI National Registry Sync Node', status: 'Synchronized', latency: '120ms', load: '9%', health: '100%' },
    { name: 'SIP Trunk Honeynet Decoy Injector', status: 'Armed & Ready', latency: '5ms', load: '2%', health: '100%' },
  ];

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-[1440px] w-full mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-black/[0.04]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">
              Engine Diagnostics &amp; Acoustic Nodes
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container/10 border border-tertiary-container/20 text-tertiary font-mono-metric text-xs font-semibold">
              ALL SYSTEMS OPTIMAL
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Real-time latency profiling, memory allocations, and carrier trunk pipeline telemetry.
          </p>
        </div>

        <button
          onClick={() => onTriggerToast('Running comprehensive diagnostic self-test across all 48 trunks...')}
          className="px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md text-sm font-semibold hover:brightness-105 active:scale-95 transition-all shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">restart_alt</span>
          <span>Run Self-Diagnostic</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs">
          <span className="text-outline text-xs uppercase font-mono-metric font-semibold">Average Pipeline Latency</span>
          <div className="font-display-lg text-3xl font-bold text-on-surface mt-2 font-mono-metric">48.2 ms</div>
          <span className="text-xs text-tertiary font-medium">Within 75ms sub-audible SLA</span>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs">
          <span className="text-outline text-xs uppercase font-mono-metric font-semibold">Active SIP Mirrors</span>
          <div className="font-display-lg text-3xl font-bold text-primary mt-2 font-mono-metric">48 / 48</div>
          <span className="text-xs text-outline font-medium">All telco routes mirrored</span>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs">
          <span className="text-outline text-xs uppercase font-mono-metric font-semibold">Memory Buffer Usage</span>
          <div className="font-display-lg text-3xl font-bold text-on-surface mt-2 font-mono-metric">3.42 GB</div>
          <span className="text-xs text-tertiary font-medium">Zero packet drops reported</span>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 shadow-sm">
        <h3 className="font-title text-title font-bold text-on-surface mb-4">Core Neural &amp; Forensic Nodes</h3>
        <div className="divide-y divide-outline-variant/20">
          {engineNodes.map((node, i) => (
            <div key={i} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse"></span>
                <div>
                  <div className="font-label-md font-semibold text-on-surface">{node.name}</div>
                  <div className="text-xs text-outline font-mono-metric">Uptime: {node.health} • Load: {node.load}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 self-end sm:self-auto">
                <span className="font-mono-metric text-xs text-outline bg-surface-container px-2 py-0.5 rounded">
                  {node.latency}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-label-sm text-xs font-semibold">
                  {node.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
