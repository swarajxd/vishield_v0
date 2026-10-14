import React from 'react';

export default function Sidebar({ activeTab, setActiveTab, onTriggerKillswitch, mobileOpen, setMobileOpen }) {
  const mainNavItems = [
    { id: 'architecture', label: 'System Architecture', icon: 'account_tree', badge: 'FLOW', badgeColor: 'bg-primary' },
    { id: 'overview', label: 'Overview Dashboard', icon: 'dashboard', badge: null },
    { id: 'live', label: 'Live Call Monitor', icon: 'graphic_eq', badge: 'LIVE', badgeColor: 'bg-primary' },
    { id: 'pipeline', label: 'Audio Pipeline Runner', icon: 'model_training', badge: 'EXECUTE', badgeColor: 'bg-primary' },
    { id: 'alert', label: 'High-Risk Warning', icon: 'crisis_alert', badge: 'ALERT', badgeColor: 'bg-error', fill: true },
    { id: 'report', label: 'Call Analysis Report', icon: 'description', badge: null },
    { id: 'history', label: 'Incident History', icon: 'history', badge: '1,420', badgeColor: 'bg-surface-container' },
    { id: 'checker', label: 'Caller Reputation & TRAI', icon: 'manage_search', badge: 'NEW', badgeColor: 'bg-primary' },
  ];

  const secondaryNavItems = [
    { id: 'model_engine', label: 'AASIST & Azure AI Engine', icon: 'network_intelligence' },
    { id: 'datasets', label: 'IndicVoices-R & IndicSynth', icon: 'dataset' },
    { id: 'indicators', label: 'The 6 Phishing Criteria', icon: 'psychology' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`fixed top-0 left-0 bottom-0 z-40 p-space-md h-screen w-72 flex flex-col justify-between shrink-0 bg-surface-container-lowest/90 backdrop-blur-xl border-r border-outline-variant/30 shadow-sm transition-transform duration-300 md:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Top Area: Crest Branding & Main Navigation */}
        <div className="flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-1">
          {/* Dossier / App Title */}
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm shadow-primary/25">
                <span className="material-symbols-outlined text-[24px] fill-icon">shield</span>
              </div>
              <div className="flex flex-col">
                <span className="font-title text-[17px] font-bold text-on-surface tracking-tight leading-snug">
                  Voice Phishing Evaluator
                </span>
                <span className="font-mono-metric text-[11px] text-outline tracking-wide">
                  Azure AI + AASIST Engine
                </span>
              </div>
            </div>

            {/* Mobile close button */}
            <button 
              className="md:hidden p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container"
              onClick={() => setMobileOpen(false)}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Section Divider */}
          <div className="h-px bg-outline-variant/20 mx-2"></div>

          {/* Main Navigation Views */}
          <div className="flex flex-col gap-1">
            <span className="px-3 text-[10px] uppercase font-mono-metric font-semibold text-outline tracking-wider mb-1">
              Core Modules (PDF Spec)
            </span>
            {mainNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left font-label-md text-label-md transition-all active:scale-[0.98] ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60'
                  }`}
                >
                  <span 
                    className={`material-symbols-outlined text-[20px] ${
                      item.fill || isActive ? 'fill-icon' : ''
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-metric font-bold ${
                      item.id === 'live' 
                        ? 'bg-primary text-on-primary animate-pulse' 
                        : item.id === 'alert'
                        ? 'bg-error text-on-error animate-pulse'
                        : item.id === 'architecture'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {isActive && !item.badge && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary ml-auto"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Secondary Deep-Dive Menus */}
          <div className="flex flex-col gap-1 pt-2">
            <span className="px-3 text-[10px] uppercase font-mono-metric font-semibold text-outline tracking-wider mb-1">
              Technical Foundations
            </span>
            {secondaryNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50 transition-all ${
                  activeTab === item.id ? 'bg-surface-container text-on-surface font-semibold' : ''
                }`}
              >
                <span className="material-symbols-outlined text-[19px] text-outline">
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Bottom Container */}
        <div className="flex flex-col gap-3 pt-3 border-t border-outline-variant/30 mt-2">
          {/* Emergency Call Termination CTA */}
          <button 
            onClick={onTriggerKillswitch}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-error/10 hover:bg-error/20 text-error border border-error/30 font-label-md text-label-md font-bold shadow-sm hover:brightness-105 active:scale-[0.98] transition-all duration-150"
          >
            <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
            <span className="material-symbols-outlined text-[18px]">call_end</span>
            <span>Emergency Call Disconnect</span>
          </button>

          {/* Model Engine Status Badge */}
          <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/25 text-[11px] font-mono-metric flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              <span className="text-on-surface-variant font-medium">Risk Fusion Node</span>
            </div>
            <span className="text-tertiary font-bold">ONLINE</span>
          </div>
        </div>
      </aside>
    </>
  );
}
