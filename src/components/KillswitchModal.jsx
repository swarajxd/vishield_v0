import React, { useState } from 'react';

export default function KillswitchModal({ isOpen, onClose, onConfirmKill }) {
  const [confirmStep, setConfirmStep] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  if (!isOpen) return null;

  const handleExecute = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setConfirmStep(false);
      onConfirmKill();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface-container-lowest/95 backdrop-blur-2xl border border-error/30 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Ambient Red Glow */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-error/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header Badge */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-error text-on-error flex items-center justify-center shrink-0 shadow-lg shadow-error/20">
            <span className="material-symbols-outlined text-[28px] fill-icon">crisis_alert</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-error/15 border border-error/30 text-error font-mono-metric text-[11px] font-bold uppercase tracking-wider">
                Stage 4 Isolation Protocol
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mt-1">
              Emergency Killswitch
            </h3>
            <p className="font-body-md text-on-surface-variant text-sm mt-1">
              Mandatory carrier disconnect and SIP RTP stream isolation under Section 43B.
            </p>
          </div>
        </div>

        {/* Warning Checklist */}
        <div className="mt-5 p-4 rounded-2xl bg-error-container/20 border border-error/20 space-y-2 font-body-md text-sm">
          <div className="flex items-center gap-2.5 text-on-surface">
            <span className="material-symbols-outlined text-error text-[18px]">check_circle</span>
            <span>Force sever 48 active telephony SIP carrier trunks</span>
          </div>
          <div className="flex items-center gap-2.5 text-on-surface">
            <span className="material-symbols-outlined text-error text-[18px]">check_circle</span>
            <span>Inject active decoy honeytrap speech stream to attacker node</span>
          </div>
          <div className="flex items-center gap-2.5 text-on-surface">
            <span className="material-symbols-outlined text-error text-[18px]">check_circle</span>
            <span>Broadcast instant high-priority alert to National Cyber Cell (I4C)</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-outline-variant/40 hover:bg-surface-container font-label-md text-label-md font-semibold text-on-surface transition-all"
          >
            Cancel Protocol
          </button>
          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-error hover:bg-error/90 text-on-error font-label-md text-label-md font-bold shadow-md shadow-error/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Terminating Trunks...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                <span>Confirm Killswitch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
