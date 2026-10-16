import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Header({ 
  setMobileOpen,
  isCollapsed = false
}) {
  const location = useLocation();
  const navigate = useNavigate();

  // Navigation items for the middle of the navbar
  const navLinks = [
    { path: '/', label: 'Overview', icon: 'dashboard' },
    { path: '/audioPipeline', label: 'Audio Pipeline', icon: 'model_training' },
    { path: '/callAnalysis', label: 'Call Analysis', icon: 'description' },
    { path: '/numberChecker', label: 'Number Checker', icon: 'manage_search' },
    { path: '/incidentHistory', label: 'Incident History', icon: 'history' },
    { path: '/systemArchitecture', label: 'Architecture', icon: 'account_tree' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-md border-b border-outline-variant/30 transition-all">
      <div className={`flex justify-between items-center w-full px-4 sm:px-6 lg:px-space-lg py-2.5 transition-all duration-300 ease-in-out gap-4 ${
        isCollapsed ? 'md:pl-24' : 'md:pl-80'
      }`}>
        {/* Left Side: Project Name */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Mobile hamburger menu button */}
          <button 
            onClick={() => setMobileOpen?.(true)}
            className="md:hidden p-2 rounded-xl text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>

          {/* Project Identity */}
          <div 
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer group hover:opacity-90 transition-opacity"
            title="ViShield - Voice Phishing Evaluator"
          >
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-xs shadow-primary/20 shrink-0">
              <span className="material-symbols-outlined text-[20px] fill-icon">shield</span>
            </div>
            <div className="flex flex-col">
              <span className="font-title text-[16px] font-bold text-on-surface tracking-tight leading-tight whitespace-nowrap">
                ViShield
              </span>
              <span className="hidden sm:inline text-[9px] font-mono-metric text-outline uppercase tracking-wider leading-none">
                Voice Phishing Evaluator
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Other Pages Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto custom-scrollbar py-0.5 px-1 max-w-full justify-center flex-1">
          {navLinks.map((link) => {
            const currentPath = location.pathname.toLowerCase();
            const isActive = link.path === '/' 
              ? (currentPath === '/' || currentPath === '/dashboard' || currentPath === '/overview')
              : currentPath === link.path.toLowerCase();

            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`px-3 py-1.5 rounded-xl font-label-md text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-primary/10 text-primary font-bold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60 font-medium'
                }`}
              >
                <span className={`material-symbols-outlined text-[17px] ${isActive ? 'fill-icon' : ''}`}>
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Side: ONLY Profile */}
        <div className="flex items-center shrink-0">
          <div 
            className="flex items-center gap-2 p-1 sm:pr-3 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 transition-all cursor-pointer shadow-xs"
            title="Logged In Profile: Security Admin"
          >
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs shadow-xs">
              VS
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="font-label-sm text-[11px] font-bold text-on-surface leading-tight">
                Security Admin
              </span>
              <span className="text-[9px] font-mono-metric text-outline leading-none">
                Active Node
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
