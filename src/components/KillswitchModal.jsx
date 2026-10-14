import React, { useState } from 'react';

export default function KillswitchModal({ isOpen, onClose, onConfirmKill }) {
  const [isExecuting, setIsExecuting] = useState(false);

  if (!isOpen) return null;

  const handleExecute = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      onConfirmKill();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface-container-lowest/95 backdrop-blur-2xl border border-error/30 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Ambient Red Glow */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-error/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header Badge */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-error text-on-error flex items-center justify-center shrink-0 shadow-lg shadow-error/20">
            <span className="material-symbols-outlined text-[28px] fill-icon">call_end</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-error/15 border border-error/30 text-error font-mono-metric text-[11px] font-bold uppercase tracking-wider">
                Emergency Intercept Action
              </span>
            </div>
            <h3 className="font-headline-sm text-xl font-bold text-on-surface mt-1">
              Emergency Call Disconnect
            </h3>
            <p className="font-body-md text-on-surface-variant text-xs mt-1">
              Instantly terminates active audio capture, isolates the scammer, and alerts guardian.
            </p>
          </div>
        </div>

        {/* Action Checklist */}
        <div className="mt-5 p-4 rounded-2xl bg-error/5 border border-error/20 space-y-2 text-xs">
          <div className="flex items-center gap-2.5 text-on-surface">
            <span className="material-symbols-outlined text-error text-base">check_circle</span>
            <span>Terminate live telephony/VoIP audio stream immediately</span>
          </div>
          <div className="flex items-center gap-2.5 text-on-surface">
            <span className="material-symbols-outlined text-error text-base">check_circle</span>
            <span>Dispatch high-priority Firebase push notification to guardian with call snippet</span>
          </div>
          <div className="flex items-center gap-2.5 text-on-surface">
            <span className="material-symbols-outlined text-error text-base">check_circle</span>
            <span>Commit structured analysis report to PostgreSQL database for review</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-outline-variant/40 hover:bg-surface-container font-label-md text-xs font-semibold text-on-surface transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-error hover:bg-error/90 text-on-error font-label-md text-xs font-bold shadow-md shadow-error/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Disconnecting...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">call_end</span>
                <span>Confirm Immediate Disconnect</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
