import React, { useState, useEffect } from 'react';
import { Activity, Terminal, Code2, Server, Clock, RefreshCw } from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'scraper' | 'codebase';
  setActiveTab: (tab: 'dashboard' | 'scraper' | 'codebase') => void;
  isScraperRunning: boolean;
  onRefreshData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isScraperRunning,
  onRefreshData
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) +
          ' | ' +
          now.toLocaleTimeString('en-US', { hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="h-16 bg-slate-900 flex items-center px-6 justify-between text-white shrink-0 shadow-md">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-xl text-white shadow-sm">
            G
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-white leading-tight">
                Logistics Gate Portal
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-900/80 text-indigo-300 border border-indigo-700/60">
                OPMS Microservice
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Automated Government Portal Scraper</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="hidden md:flex items-center gap-1 ml-6 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-xs font-medium">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Gate Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('scraper')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all relative ${
              activeTab === 'scraper'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Scraper Control</span>
            {isScraperRunning && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute top-1.5 right-1.5"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('codebase')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all ${
              activeTab === 'codebase'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Architecture Code</span>
          </button>
        </div>
      </div>

      {/* Right Info Section */}
      <div className="flex items-center gap-6 text-xs font-medium">
        <div className="hidden lg:flex items-center gap-2 text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-md border border-slate-700/40">
          <Server className="w-3.5 h-3.5 text-emerald-400" />
          <span>Server: <span className="text-emerald-400 font-semibold">Operational</span></span>
          <span className="text-slate-600 mx-1">|</span>
          <span className="text-slate-400">PostgreSQL: <span className="text-indigo-300">Connected</span></span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefreshData}
            title="Refresh All Feed Data"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

          <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime || 'Loading clock...'}</span>
          </div>
        </div>
      </div>
    </nav>
  );
};
