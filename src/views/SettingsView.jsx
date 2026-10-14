import React, { useState } from 'react';

export default function SettingsView({ onTriggerToast }) {
  const [sensitivity, setSensitivity] = useState(70);
  const [autoTerminate, setAutoTerminate] = useState(true);
  const [notifyGuardian, setNotifyGuardian] = useState(true);
  const [streamAudio, setStreamAudio] = useState(true);
  const [carrierBlacklist, setCarrierBlacklist] = useState(true);

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-[1440px] w-full mx-auto">
      <div className="pb-1 border-b border-black/[0.04]">
        <h2 className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">
          Node Configuration &amp; Policies
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
          Tune algorithmic thresholds, automated isolation rules, and multi-channel notification links.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detection Sensitivity */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-4">
          <h3 className="font-title text-title font-bold text-on-surface">Scam Probability Threshold</h3>
          <p className="text-sm text-outline">
            Determines the cutoff percentage for triggering Stage 4 Critical Lockout and automated call drops.
          </p>

          <div className="flex items-center justify-between pt-2">
            <span className="font-label-md font-semibold text-on-surface">Auto-Drop Trigger</span>
            <span className="font-mono-metric font-bold text-error text-lg">{sensitivity}%</span>
          </div>
          <input
            type="range"
            min="40"
            max="95"
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
            className="w-full h-2 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-xs text-outline font-mono-metric">
            <span>40% (Aggressive)</span>
            <span>70% (Recommended)</span>
            <span>95% (Conservative)</span>
          </div>
        </div>

        {/* Guardian Escalation Contacts */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-4">
          <h3 className="font-title text-title font-bold text-on-surface">Linked Guardian Entity</h3>
          <p className="text-sm text-outline">
            Verified trusted relative or security supervisor notified during live social engineering attempts.
          </p>

          <div className="p-3.5 rounded-xl bg-surface-container-low flex items-center justify-between">
            <div>
              <div className="font-label-md font-bold text-on-surface">Rohan Sharma (Primary Guardian)</div>
              <div className="text-xs font-mono-metric text-outline">+91 98201 XXXXX • WhatsApp / SMS Enabled</div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-label-sm text-xs font-semibold">
              ARMED
            </span>
          </div>

          <button
            onClick={() => onTriggerToast('Guardian settings updated')}
            className="self-start px-3.5 py-1.5 rounded-xl border border-outline-variant/30 font-label-md text-sm font-semibold hover:bg-surface-container"
          >
            Modify Guardian Contacts
          </button>
        </div>

        {/* Autonomous Interception Toggles */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-4 lg:col-span-2">
          <h3 className="font-title text-title font-bold text-on-surface">Automated Mitigation Rules</h3>
          
          <div className="divide-y divide-outline-variant/20 font-body-md text-sm">
            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-on-surface">Auto-Terminate High Risk Calls</div>
                <div className="text-xs text-outline">Automatically disconnect call if synthetic speech clone probability exceeds threshold</div>
              </div>
              <input
                type="checkbox"
                checked={autoTerminate}
                onChange={(e) => setAutoTerminate(e.target.checked)}
                className="w-4 h-4 text-primary rounded"
              />
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-on-surface">Broadcast WhatsApp Guardian Link</div>
                <div className="text-xs text-outline">Instantly deliver live audio listen-in link to verified guardian upon threat detection</div>
              </div>
              <input
                type="checkbox"
                checked={notifyGuardian}
                onChange={(e) => setNotifyGuardian(e.target.checked)}
                className="w-4 h-4 text-primary rounded"
              />
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-on-surface">Sync with TRAI &amp; I4C Cyber Watchlist</div>
                <div className="text-xs text-outline">Cross-reference live caller numbers with National Cybercrime Coordination Centre database</div>
              </div>
              <input
                type="checkbox"
                checked={carrierBlacklist}
                onChange={(e) => setCarrierBlacklist(e.target.checked)}
                className="w-4 h-4 text-primary rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
