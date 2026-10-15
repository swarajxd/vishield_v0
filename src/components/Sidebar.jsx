import React, { useState } from 'react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  onTriggerKillswitch, 
  mobileOpen, 
  setMobileOpen,
  isCollapsed: controlledCollapsed,
  setIsCollapsed: controlledSetCollapsed
}) {
  // Support both controlled and uncontrolled collapsed state
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const setIsCollapsed = controlledSetCollapsed || setInternalCollapsed;

  const mainNavItems = [
    { id: 'architecture', label: 'System Architecture', icon: 'account_tree', badge: 'SPEC', badgeColor: 'bg-primary' },
    { id: 'overview', label: 'Overview Dashboard', icon: 'dashboard', badge: null },
    { id: 'live', label: 'Live Stream Analysis', icon: 'graphic_eq', badge: 'LIVE', badgeColor: 'bg-primary' },
    { id: 'pipeline', label: 'Audio Pipeline Runner', icon: 'model_training', badge: 'EVAL', badgeColor: 'bg-primary' },
    { id: 'report', label: 'Call Analysis Report', icon: 'description', badge: null },
    { id: 'history', label: 'Incident History', icon: 'history', badge: '1,420', badgeColor: 'bg-surface-container' },
    { id: 'checker', label: 'Number Checker', icon: 'manage_search', badge: 'NEW', badgeColor: 'bg-primary' },
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

      <aside className={`fixed top-0 left-0 bottom-0 z-40 h-screen flex flex-col justify-between shrink-0 bg-surface-container-lowest/90 backdrop-blur-xl border-r border-outline-variant/30 shadow-sm transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20 px-2.5 py-4' : 'w-72 p-space-md'
      } ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Top Area: Crest Branding & Main Navigation */}
        <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-0.5">
          {/* Header Branding + Desktop Collapse Toggle */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-2'} pt-1`}>
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setIsCollapsed(false)}
                  className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                  title="Click to expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <span className="material-symbols-outlined text-[24px] fill-icon">shield</span>
                </button>
                <button
                  onClick={() => setIsCollapsed(false)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm shadow-primary/20 shrink-0">
                    <span className="material-symbols-outlined text-[24px] fill-icon">shield</span>
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-title text-[17px] font-bold text-on-surface tracking-tight leading-snug truncate">
                      Voice Phishing
                    </span>
                    <span className="font-mono-metric text-[11px] text-outline tracking-wide truncate">
                      Sentinel Evaluator v1.0
                    </span>
                  </div>
                </div>

                {/* Desktop shrink/collapse button */}
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="hidden md:flex p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high active:scale-95 transition-all"
                  title="Shrink sidebar onto left"
                  aria-label="Shrink sidebar onto left"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>

                {/* Mobile close button */}
                <button 
                  className="md:hidden p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container"
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </>
            )}
          </div>

          {/* Section Divider */}
          <div className="h-px bg-outline-variant/20 mx-1"></div>

          {/* Main Navigation Views */}
          <div className="flex flex-col gap-1">
            {!isCollapsed && (
              <span className="px-3 text-[10px] uppercase font-mono-metric font-semibold text-outline tracking-wider mb-1">
                Core Consoles
              </span>
            )}

            {mainNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen(false);
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center rounded-xl text-left font-label-md text-label-md transition-all active:scale-[0.98] ${
                    isCollapsed 
                      ? 'justify-center py-2.5 px-0 relative group' 
                      : 'gap-3 px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60'
                  }`}
                >
                  <span 
                    className={`material-symbols-outlined text-[21px] shrink-0 ${
                      item.fill || isActive ? 'fill-icon' : ''
                    }`}
                  >
                    {item.icon}
                  </span>

                  {!isCollapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-metric font-bold ${
                          item.id === 'live' 
                            ? 'bg-primary text-on-primary animate-pulse' 
                            : item.id === 'alert'
                            ? 'bg-error text-on-error animate-pulse'
                            : item.id === 'checker'
                            ? 'bg-primary/15 text-primary'
                            : 'bg-surface-container-highest text-on-surface-variant'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                      {isActive && !item.badge && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary ml-auto"></span>
                      )}
                    </>
                  )}

                  {/* Collapsed active dot indicator */}
                  {isCollapsed && isActive && (
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"></span>
                  )}

                  {/* Tooltip on hover when collapsed */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-surface-container-highest text-on-surface text-xs font-medium rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                      {item.label}
                      {item.badge && (
                        <span className="ml-1.5 text-[10px] font-mono-metric text-primary font-bold">
                          [{item.badge}]
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Bottom Container */}
        <div className="flex flex-col gap-2.5 pt-3 border-t border-outline-variant/30 mt-2">
          {/* CTA Action Button: Emergency Killswitch */}
          <button 
            onClick={onTriggerKillswitch}
            title={isCollapsed ? "Emergency Killswitch" : undefined}
            className={`w-full flex items-center rounded-xl bg-error/10 hover:bg-error/20 text-error border border-error/30 font-label-md text-label-md font-bold shadow-sm hover:brightness-105 active:scale-[0.98] transition-all duration-150 ${
              isCollapsed ? 'justify-center p-2.5 relative group' : 'justify-center gap-2 py-2.5 px-3'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-error animate-ping shrink-0"></span>
            <span className="material-symbols-outlined text-[19px] shrink-0">power_settings_new</span>
            {!isCollapsed && <span>Emergency Killswitch</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-error text-on-error text-xs font-bold rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Emergency Killswitch
              </div>
            )}
          </button>

          {/* Expand/Shrink Toggle button at bottom for easy access */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`hidden md:flex items-center rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high/60 font-label-md text-xs transition-all ${
              isCollapsed ? 'justify-center py-2 px-0' : 'gap-2.5 px-3 py-1.5'
            }`}
            title={isCollapsed ? "Expand sidebar (w-72)" : "Shrink sidebar onto left (w-20)"}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isCollapsed ? "dock_to_right" : "dock_to_left"}
            </span>
            {!isCollapsed && <span>Shrink Sidebar</span>}
          </button>
        </div>
      </aside>
    </>
  );
}