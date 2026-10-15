import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import KillswitchModal from './components/KillswitchModal';
import SystemArchitectureView from './views/SystemArchitectureView';
import OverviewDashboardView from './views/OverviewDashboardView';
import LiveCallMonitorView from './views/LiveCallMonitorView';
import HighRiskWarningView from './views/HighRiskWarningView';
import CallAnalysisReportView from './views/CallAnalysisReportView';
import IncidentHistoryView from './views/IncidentHistoryView';
import NumberCheckerView from './views/NumberCheckerView';
import AasistAzureModelView from './views/AasistAzureModelView';
import AudioPipelineEvaluatorView from './views/AudioPipelineEvaluatorView';

export default function App() {
  const [activeTab, setActiveTab] = useState('architecture');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [killswitchOpen, setKillswitchOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStreamFilter, setActiveStreamFilter] = useState('all');
  const [activeIncidentId, setActiveIncidentId] = useState('CALL-2026-9102');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleSimulateCall = () => {
    setActiveTab('pipeline');
    showToast('Opened Audio Pipeline Runner: Upload audio to evaluate AASIST and Scam Engine models.');
  };

  const handleExportReport = () => {
    showToast('Exporting consolidated post-call report (PDF & PostgreSQL dump)...');
  };

  const handleConfirmKillswitch = () => {
    setKillswitchOpen(false);
    showToast('EMERGENCY DISCONNECT EXECUTED: Audio stream dropped. Guardian notified via Firebase FCM.');
  };

  const handleNotifyGuardian = (guardianInfo) => {
    showToast(`Firebase Cloud Messaging (FCM) push dispatched to ${guardianInfo?.recipient || 'Guardian'}: "${guardianInfo?.snippet || 'High risk call detected'}"`);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body-md antialiased selection:bg-primary-fixed selection:text-on-primary-fixed-variant">
      {/* Sidebar with PDF Specification Navigation & Shrink Toggle */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onTriggerKillswitch={() => setKillswitchOpen(true)}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
      />

      {/* Main Workspace Wrapper (Offset transitions between md:pl-24 and md:pl-80) */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300">
        {/* Top Header */}
        <Header
          onSimulateCall={handleSimulateCall}
          onExportReport={handleExportReport}
          setMobileOpen={setMobileOpen}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeStreamFilter={activeStreamFilter}
          setActiveStreamFilter={setActiveStreamFilter}
        />

        {/* Dynamic View Canvas */}
        <main className={`flex-1 px-4 sm:px-6 lg:px-space-xl py-space-md transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'md:pl-24' : 'md:pl-80'
        }`}>
          {activeTab === 'architecture' && (
            <SystemArchitectureView
              onNavigateToLive={() => setActiveTab('live')}
              onTriggerToast={showToast}
            />
          )}

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
              onEndCall={() => showToast('Audio capture session ended. Structured report committed to PostgreSQL.')}
              onNotifyGuardian={handleNotifyGuardian}
              onTriggerToast={showToast}
              onNavigateToAlert={() => setActiveTab('alert')}
            />
          )}

          {activeTab === 'pipeline' && (
            <AudioPipelineEvaluatorView
              onTriggerToast={showToast}
              onOpenReport={() => setActiveTab('report')}
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

          {['model_engine', 'datasets', 'indicators'].includes(activeTab) && (
            <AasistAzureModelView onTriggerToast={showToast} />
          )}
        </main>
      </div>

      {/* Emergency Call Disconnect Modal */}
      <KillswitchModal
        isOpen={killswitchOpen}
        onClose={() => setKillswitchOpen(false)}
        onConfirmKill={handleConfirmKillswitch}
      />

      {/* HUD Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
          <div className="bg-surface-container-lowest/95 backdrop-blur-2xl border border-outline-variant/40 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 text-on-surface font-label-md text-xs sm:text-sm max-w-md">
            <span className="material-symbols-outlined text-primary text-[20px]">info</span>
            <span className="flex-1">{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-outline hover:text-on-surface p-1"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
