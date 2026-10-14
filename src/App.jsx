import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import KillswitchModal from './components/KillswitchModal';
import OverviewDashboardView from './views/OverviewDashboardView';
import LiveCallMonitorView from './views/LiveCallMonitorView';
import HighRiskWarningView from './views/HighRiskWarningView';
import CallAnalysisReportView from './views/CallAnalysisReportView';
import IncidentHistoryView from './views/IncidentHistoryView';
import NumberCheckerView from './views/NumberCheckerView';
import DiagnosticsView from './views/DiagnosticsView';
import SettingsView from './views/SettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [killswitchOpen, setKillswitchOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStreamFilter, setActiveStreamFilter] = useState('all');
  const [activeIncidentId, setActiveIncidentId] = useState('#INC-2024-8841');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  };

  const handleDeployProbe = () => {
    showToast('Active telephony acoustic probe deployed to carrier trunks #12 - #16');
  };

  const handleExportTelemetry = () => {
    showToast('Exporting consolidated acoustic telemetry (JSON & CSV packages)...');
  };

  const handleConfirmKillswitch = () => {
    setKillswitchOpen(false);
    showToast('STAGE 4 EMERGENCY KILLSWITCH ENGAGED: 48 carrier trunks disconnected. Honeynet active.');
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body-md antialiased selection:bg-primary-fixed selection:text-on-primary-fixed-variant">
      {/* Shared Glass Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onTriggerKillswitch={() => setKillswitchOpen(true)}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Workspace Wrapper (Offset for md:pl-72 sidebar) */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 transition-all">
        {/* Shared Top Glass Nav Bar */}
        <Header
          onDeployProbe={handleDeployProbe}
          onExportTelemetry={handleExportTelemetry}
          setMobileOpen={setMobileOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeStreamFilter={activeStreamFilter}
          setActiveStreamFilter={setActiveStreamFilter}
        />

        {/* Dynamic View Canvas */}
        <main className="flex-1 px-4 sm:px-6 lg:px-space-xl py-space-md md:pl-80 transition-all">
          {activeTab === 'overview' && (
            <OverviewDashboardView
              onInspectReport={(id) => {
                setActiveIncidentId(id);
                setActiveTab('report');
              }}
              onNavigateToAlert={() => setActiveTab('alert')}
              onTriggerToast={showToast}
            />
          )}

          {activeTab === 'live' && (
            <LiveCallMonitorView
              onEndCall={() => showToast('Active call disconnected and quarantined.')}
              onNotifyGuardian={() => showToast('Guardian Rohan verified and connected to stream.')}
              onTriggerToast={showToast}
            />
          )}

          {activeTab === 'alert' && (
            <HighRiskWarningView
              onTerminateCall={() => showToast('Emergency Disconnect executed across carrier gateways.')}
              onTriggerToast={showToast}
              onOpenReport={() => setActiveTab('report')}
            />
          )}

          {activeTab === 'report' && (
            <CallAnalysisReportView
              incidentId={activeIncidentId}
              onTriggerToast={showToast}
            />
          )}

          {activeTab === 'history' && (
            <IncidentHistoryView
              onInspectReport={(id) => {
                setActiveIncidentId(id);
                setActiveTab('report');
              }}
              onTriggerToast={showToast}
            />
          )}

          {activeTab === 'checker' && (
            <NumberCheckerView onTriggerToast={showToast} />
          )}

          {activeTab === 'diagnostics' && (
            <DiagnosticsView onTriggerToast={showToast} />
          )}

          {activeTab === 'settings' && (
            <SettingsView onTriggerToast={showToast} />
          )}

          {/* Secondary views fallback with informative card */}
          {['baselines', 'synthetic_log', 'threat_intel', 'policies'].includes(activeTab) && (
            <div className="max-w-4xl mx-auto p-8 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 text-center space-y-4 my-8">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">psychology</span>
              </div>
              <h2 className="text-headline-md font-bold text-on-surface capitalize">
                {activeTab.replace('_', ' ')}
              </h2>
              <p className="text-on-surface-variant max-w-lg mx-auto">
                Connected to National Cybercrime Coordination Centre (I4C) acoustic neural database. Real-time synchronizations run every 60 seconds.
              </p>
              <button
                onClick={() => setActiveTab('overview')}
                className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md font-semibold hover:brightness-105 active:scale-95 transition-all"
              >
                Return to Overview Dashboard
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Emergency Killswitch Modal */}
      <KillswitchModal
        isOpen={killswitchOpen}
        onClose={() => setKillswitchOpen(false)}
        onConfirmKill={handleConfirmKillswitch}
      />

      {/* Apple HIG Frosted HUD Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
          <div className="bg-surface-container-lowest/95 backdrop-blur-2xl border border-outline-variant/40 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 text-on-surface font-label-md text-sm max-w-md">
            <span className="material-symbols-outlined text-primary text-[20px]">info</span>
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-auto text-outline hover:text-on-surface p-1"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
