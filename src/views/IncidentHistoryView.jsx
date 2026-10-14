import React, { useState, useMemo } from 'react';
import { POSTGRESQL_CALL_RECORDS } from '../data/projectData';

export default function IncidentHistoryView({ onInspectReport, onTriggerToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [selectedLanguage, setSelectedLanguage] = useState('ALL');

  const filteredRecords = useMemo(() => {
    return POSTGRESQL_CALL_RECORDS.filter(rec => {
      const matchesSearch = 
        rec.callId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.callerNumber.includes(searchTerm) ||
        rec.detectedIndicators.some(ind => ind.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesRisk = selectedRisk === 'ALL' || rec.riskLevel === selectedRisk;
      const matchesLang = selectedLanguage === 'ALL' || rec.language.toLowerCase().includes(selectedLanguage.toLowerCase());

      return matchesSearch && matchesRisk && matchesLang;
    });
  }, [searchTerm, selectedRisk, selectedLanguage]);

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-[1520px] w-full mx-auto animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono-metric text-xs font-semibold">
              POSTGRESQL DATA STORAGE (SECTION 9)
            </span>
            <span className="text-xs text-outline font-mono-metric">Audited Call Archives</span>
          </div>
          <h2 className="font-headline-md text-2xl font-bold tracking-tight text-on-surface mt-1">
            Incident History &amp; Post-Call Audit Log
          </h2>
          <p className="font-body-md text-xs text-on-surface-variant max-w-2xl mt-0.5">
            Full forensic archive of evaluated calls containing caller metadata, 3-signal scores, and guardian delivery logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onTriggerToast('Exporting entire incident history database as CSV table...')}
            className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-label-md text-xs font-semibold border border-outline-variant/30 flex items-center gap-1.5 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-3xl border border-outline-variant/30 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Search by Call ID, number (+91...), or indicator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs font-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Risk Level Filter */}
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/25 text-xs font-label-md">
            {['ALL', 'HIGH RISK', 'SUSPICIOUS', 'SAFE'].map(tier => (
              <button
                key={tier}
                onClick={() => setSelectedRisk(tier)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  selectedRisk === tier
                    ? 'bg-surface-container-lowest text-on-surface font-bold shadow-xs'
                    : 'text-outline hover:text-on-surface'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>

          {/* Language Filter */}
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="px-3 py-1.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs font-label-md text-on-surface focus:outline-none"
          >
            <option value="ALL">All Languages</option>
            <option value="Hindi">Hindi (hi-IN)</option>
            <option value="English">English (en-IN)</option>
            <option value="Hinglish">Hinglish</option>
          </select>
        </div>
      </div>

      {/* Incidents Table (Section 9 Specs) */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-container-low/50 text-outline font-mono-metric uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Call ID</th>
                <th className="py-3 px-4">Caller Identifier</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Conv. (w1)</th>
                <th className="py-3 px-4">AASIST (w2)</th>
                <th className="py-3 px-4">Rep. (w3)</th>
                <th className="py-3 px-4">Final Risk</th>
                <th className="py-3 px-4">Guardian Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15 font-body-md">
              {filteredRecords.map(rec => {
                const isHigh = rec.riskLevel === 'HIGH RISK';
                const isSuspicious = rec.riskLevel === 'SUSPICIOUS';
                const badgeColor = isHigh 
                  ? 'bg-error/10 text-error border-error/20' 
                  : isSuspicious 
                  ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' 
                  : 'bg-tertiary/10 text-tertiary border-tertiary/20';

                return (
                  <tr key={rec.callId} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono-metric font-bold text-on-surface">{rec.callId}</div>
                      <div className="text-[10px] text-outline">{rec.timestamp}</div>
                    </td>
                    <td className="py-3 px-4 font-mono-metric font-medium text-on-surface">
                      {rec.callerNumber}
                    </td>
                    <td className="py-3 px-4 font-mono-metric text-on-surface-variant">
                      {rec.duration}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-mono-metric text-[10px]">
                        {rec.language.split(' ')[0]}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono-metric text-purple-700 font-semibold">
                      {(rec.conversationScore * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-4 font-mono-metric text-amber-700 font-semibold">
                      {(rec.aasistScore * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-4 font-mono-metric text-teal-700 font-semibold">
                      {(rec.reputationScore * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono-metric font-bold text-on-surface">
                        <span>{(rec.finalRisk * 100).toFixed(1)}%</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                          {rec.riskLevel}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-on-surface-variant">
                      {rec.guardianStatus.split(' ')[0]}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onInspectReport(rec.callId)}
                        className="px-3 py-1 bg-surface-container hover:bg-primary hover:text-on-primary rounded-lg font-label-md text-xs font-semibold text-on-surface transition-all"
                      >
                        Inspect Report
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
