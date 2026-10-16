import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import KillswitchModal from './components/KillswitchModal';
import SystemArchitectureView from './views/SystemArchitectureView';
import OverviewDashboardView from './views/OverviewDashboardView';
import CallAnalysisReportView from './views/CallAnalysisReportView';
import IncidentHistoryView from './views/IncidentHistoryView';
import NumberCheckerView from './views/NumberCheckerView';
import AudioPipelineEvaluatorView from './views/AudioPipelineEvaluatorView';

export default function App() {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [killswitchOpen, setKillswitchOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStreamFilter, setActiveStreamFilter] = useState('all');
  const [activeIncidentId, setActiveIncidentId] = useState(null);
  const [activePipelineReport, setActivePipelineReport] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleOpenReportFromPipeline = (report) => {
    if (report) {
      setActivePipelineReport(report);
      if (report.callId) setActiveIncidentId(report.callId);
    }
    navigate('/callAnalysis');
    showToast('Loaded Audio Pipeline evaluation report in Call Analysis View.');
  };

  const handleSimulateCall = () => {
    navigate('/audioPipeline');
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

        {/* Dynamic View Canvas using React Router */}
        <main className={`flex-1 px-4 sm:px-6 lg:px-space-xl py-space-md transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'md:pl-24' : 'md:pl-80'
        }`}>
          <Routes>
            {/* Root localhost:5173 points to Overview Dashboard */}
            <Route path="/" element={
              <OverviewDashboardView
                onInspectReport={(id) => {
                  setActiveIncidentId(id);
                  navigate('/callAnalysis');
                }}
                onNavigateToAlert={() => navigate('/callAnalysis')}
                onTriggerToast={showToast}
              />
            } />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/overview" element={<Navigate to="/" replace />} />

            {/* /systemArchitecture */}
            <Route path="/systemArchitecture" element={
              <SystemArchitectureView
                onNavigateToLive={() => navigate('/audioPipeline')}
                onTriggerToast={showToast}
              />
            } />
            <Route path="/systemarchitecture" element={<Navigate to="/systemArchitecture" replace />} />
            <Route path="/architecture" element={<Navigate to="/systemArchitecture" replace />} />

            {/* Legacy /liveStream redirect to /audioPipeline */}
            <Route path="/liveStream" element={<Navigate to="/audioPipeline" replace />} />
            <Route path="/livestream" element={<Navigate to="/audioPipeline" replace />} />
            <Route path="/live" element={<Navigate to="/audioPipeline" replace />} />

            {/* /audioPipeline */}
            <Route path="/audioPipeline" element={
              <AudioPipelineEvaluatorView
                onTriggerToast={showToast}
                onOpenReport={handleOpenReportFromPipeline}
                onSavePipelineReport={(report) => {
                  setActivePipelineReport(report);
                  if (report?.callId) setActiveIncidentId(report.callId);
                }}
              />
            } />
            <Route path="/audiopipeline" element={<Navigate to="/audioPipeline" replace />} />
            <Route path="/pipeline" element={<Navigate to="/audioPipeline" replace />} />

            {/* /callAnalysis */}
            <Route path="/callAnalysis" element={
              <CallAnalysisReportView
                incidentId={activeIncidentId}
                activePipelineReport={activePipelineReport}
                onTriggerToast={showToast}
              />
            } />
            <Route path="/callanalysis" element={<Navigate to="/callAnalysis" replace />} />
            <Route path="/report" element={<Navigate to="/callAnalysis" replace />} />

            {/* /incidentHistory */}
            <Route path="/incidentHistory" element={
              <IncidentHistoryView
                onInspectReport={(id) => {
                  setActiveIncidentId(id);
                  navigate('/callAnalysis');
                }}
                onTriggerToast={showToast}
              />
            } />
            <Route path="/incidenthistory" element={<Navigate to="/incidentHistory" replace />} />
            <Route path="/history" element={<Navigate to="/incidentHistory" replace />} />

            {/* /numberChecker */}
            <Route path="/numberChecker" element={
              <NumberCheckerView onTriggerToast={showToast} />
            } />
            <Route path="/numberchecker" element={<Navigate to="/numberChecker" replace />} />
            <Route path="/checker" element={<Navigate to="/numberChecker" replace />} />

            {/* Wildcard redirect to Dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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
