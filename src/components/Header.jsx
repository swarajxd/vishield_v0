import React, { useState } from 'react';

export default function Header({ 
  onDeployProbe, 
  onExportTelemetry, 
  setMobileOpen, 
  searchQuery, 
  setSearchQuery,
  activeStreamFilter,
  setActiveStreamFilter
}) {
  const [timeHorizon, setTimeHorizon] = useState('Realtime');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notifications = [
    { id: 1, title: 'High-Risk Intercept #TRK-8921-X', desc: 'Synthesized voice clone auto-terminated', time: '1m ago', unread: true },
    { id: 2, title: 'Guardian Alert Delivered', desc: 'Rohan Sharma notified via encrypted WhatsApp SMS', time: '4m ago', unread: true },
    { id: 3, title: 'TRAI Blacklist Synchronized', desc: '14 new carrier trunks added to watchdog', time: '18m ago', unread: false },
  ];

  return (
    <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-md border-b border-outline-variant/30 transition-all">
      <div className="flex justify-between items-center w-full px-4 sm:px-6 lg:px-space-lg py-2.5 md:pl-80">
        {/* Left: Mobile Toggle & Title & Quick Search */}
        <div className="flex items-center gap-3 sm:gap-6 flex-1 max-w-3xl">
          {/* Mobile hamburger menu */}
          <button 
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 rounded-xl text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>

          {/* Title */}
          <div className="flex items-center gap-2">
            <h1 className="font-title text-[17px] sm:text-title font-bold text-on-surface tracking-tight whitespace-nowrap">
              Sentinel Voice Phishing Evaluator
            </h1>
          </div>

          {/* ⌘K Spotlight Input */}
          <div className="relative hidden md:block w-72 lg:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
              <span className="material-symbols-outlined text-[18px]">search</span>
            </div>
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-12 py-1.5 bg-surface-container-low border border-outline-variant/40 rounded-xl font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Search callers, acoustic vectors, flags..." 
              type="text"
            />
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono-metric text-outline bg-surface-container-highest/60 rounded border border-outline-variant/30">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Quick Stream Navigation Links Segment */}
          <div className="hidden 2xl:flex items-center gap-5 ml-2">
            {[
              { id: 'all', label: 'All Streams' },
              { id: 'live', label: 'Live Priority', badge: true },
              { id: 'synthetic', label: 'Flagged Synthetic' },
              { id: 'archived', label: 'Archived Logs' }
            ].map(stream => (
              <button
                key={stream.id}
                onClick={() => setActiveStreamFilter(stream.id)}
                className={`pb-1 text-label-md font-label-md transition-all flex items-center gap-1.5 ${
                  activeStreamFilter === stream.id
                    ? 'text-primary font-semibold border-b-2 border-primary'
                    : 'text-on-surface-variant hover:text-on-surface font-medium'
                }`}
              >
                {stream.badge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>
                )}
                {stream.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trailing Controls & Operator Avatar */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Segmented Control: Realtime | Hourly | Daily (Desktop) */}
          <div className="hidden xl:inline-flex p-0.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface-variant">
            {['Realtime', 'Hourly', 'Daily'].map((tab) => (
              <button
                key={tab}
                onClick={() => setTimeHorizon(tab)}
                className={`px-2.5 py-1 font-label-md text-label-md rounded-lg transition-all ${
                  timeHorizon === tab
                    ? 'font-semibold bg-surface-container-lowest text-on-surface shadow-xs'
                    : 'font-medium hover:text-on-surface'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Trailing Action: Deploy Active Probe */}
          <button 
            onClick={onDeployProbe}
            className="px-3 py-1.5 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-semibold hover:brightness-105 active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-sm shadow-primary/20"
          >
            <span className="material-symbols-outlined text-[16px]">sensors</span>
            <span className="hidden sm:inline">Deploy Active Probe</span>
          </button>

          {/* Secondary Action: Export Telemetry */}
          <button 
            onClick={onExportTelemetry}
            className="hidden sm:flex p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/30 rounded-xl transition-all"
            title="Export Telemetry"
          >
            <span className="material-symbols-outlined text-[18px]">file_download</span>
          </button>

          {/* Notifications Flyout */}
          <div className="relative">
            <button 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/30 rounded-xl transition-all relative"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-[18px]">notifications_active</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface"></span>
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest/95 backdrop-blur-xl border border-outline-variant/40 rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20 mb-2">
                  <span className="font-label-md text-label-md font-bold text-on-surface">Security Intercepts</span>
                  <span className="font-mono-metric text-[11px] text-error font-semibold">2 Critical</span>
                </div>
                <div className="space-y-2">
                  {notifications.map(n => (
                    <div key={n.id} className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm font-semibold text-on-surface">{n.title}</span>
                        <span className="font-mono-metric text-[10px] text-outline">{n.time}</span>
                      </div>
                      <p className="font-body-md text-[12px] text-on-surface-variant mt-0.5">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Operator Profile */}
          <div className="flex items-center pl-1 sm:pl-2">
            <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-primary/20 shadow-xs cursor-pointer group" title="Chief Security Operations Officer - Authenticated">
              <img 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                alt="CSO Officer Avatar" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQ2tPMYjFeBtJgt2HYzJ8JRWRAGK26cpXbieCRPLTVOopJh8D1OxhWO9Ea7S-fDDrReGLcyAZy2hU215dFCHEF03MT7vu5ckrkFGuV79QHakqj_2xJqUa5b5g72Sxr1LuvbgK9JR1VVefBZ5XJAn56JhsaNYz9yFG_MMjn031T_RmJHY-dFfB8Ba9rGeQLLeIbhuXnml3xo4ka5LMMP9y0N-q0Bd2ekepJcFQAqOQ06jn5MkSeUmgg-g"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="hidden w-full h-full bg-primary text-on-primary text-xs font-bold items-center justify-center">
                CSO
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-tertiary ring-1 ring-surface-container-lowest"></span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
