import React, { useState } from 'react';
import { Play, CheckCircle2, ShieldAlert, Key, Terminal, Database, Server, RefreshCw } from 'lucide-react';
import { ScraperLog } from '../types';

interface ScraperControlProps {
  logs: ScraperLog[];
  isLoopActive: boolean;
  setIsLoopActive: (active: boolean) => void;
  onTriggerScrape: () => void;
  isLoading: boolean;
}

export const ScraperControl: React.FC<ScraperControlProps> = ({
  logs,
  isLoopActive,
  setIsLoopActive,
  onTriggerScrape,
  isLoading
}) => {
  const [opmsUsername, setOpmsUsername] = useState('admin_gate');
  const [opmsPassword, setOpmsPassword] = useState('••••••••••••');
  const [captchaKey, setCaptchaKey] = useState('2captcha_api_key_8849102');
  const [portalUrl, setPortalUrl] = useState('https://opms.gov.example/login');
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult('OPMS Credentials and 2Captcha API key updated successfully.');
    setTimeout(() => setTestResult(null), 4000);
  };

  return (
    <div className="flex-1 overflow-auto flex flex-col gap-6">
      {/* Top Banner Status */}
      <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/40 rounded-lg flex items-center justify-center">
            <Terminal className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Python Playwright Scraper Engine</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase tracking-wider">
                Container Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Automated headless browser scraping OPMS government gate entries every 15 minutes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Loop toggle */}
          <button
            onClick={() => setIsLoopActive(!isLoopActive)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border ${
              isLoopActive
                ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLoopActive ? 'bg-emerald-300 animate-ping' : 'bg-slate-500'}`}></span>
            <span>{isLoopActive ? '15m Loop: ACTIVE' : '15m Loop: PAUSED'}</span>
          </button>

          {/* Manual Run */}
          <button
            onClick={onTriggerScrape}
            disabled={isLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Play className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Executing Playwright...' : 'Trigger Immediate Run'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Console Logs */}
        <div className="lg:col-span-7 bg-slate-950 rounded-xl border border-slate-800 p-5 flex flex-col font-mono text-xs shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-slate-400">
            <span className="flex items-center gap-2 font-semibold text-slate-200">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>Live Scraper Console Stream</span>
            </span>
            <span className="text-[11px] text-slate-500">psycopg2 & Playwright stdout</span>
          </div>

          <div className="flex-1 min-h-[340px] max-h-[420px] overflow-y-auto space-y-2 pr-2">
            <div className="text-slate-500">[INFO] Initialized OPMS Scraper daemon thread.</div>
            <div className="text-slate-500">[INFO] Connected to PostgreSQL at postgres:5432/truck_gate_db.</div>
            <div className="text-slate-400">[INFO] Playwright launching headless Chromium browser instance...</div>
            <div className="text-emerald-400">[SUCCESS] Browser context created (Viewport: 1280x720).</div>

            {logs.map((log) => (
              <div key={log.id} className="p-2.5 rounded bg-slate-900/80 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className={`font-bold ${log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    [{log.status}] Scrape Run Completed
                  </span>
                  <span className="text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">{log.message}</p>
                <div className="text-[10px] text-indigo-300">
                  + Scraped {log.items_scraped} truck gate entries → PostgreSQL upsert done.
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Portal & 2Captcha Configuration */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Configuration Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600" />
              <span>Government Portal Credentials</span>
            </h3>

            {testResult && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{testResult}</span>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  OPMS Portal Login URL
                </label>
                <input
                  type="text"
                  value={portalUrl}
                  onChange={(e) => setPortalUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Portal Username (OPMS_USERNAME)
                </label>
                <input
                  type="text"
                  value={opmsUsername}
                  onChange={(e) => setOpmsUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Portal Password (OPMS_PASSWORD)
                </label>
                <input
                  type="password"
                  value={opmsPassword}
                  onChange={(e) => setOpmsPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1 flex items-center justify-between">
                  <span>2Captcha API Key (CAPTCHA_KEY)</span>
                  <span className="text-[10px] text-slate-400">2captcha.com</span>
                </label>
                <input
                  type="text"
                  value={captchaKey}
                  onChange={(e) => setCaptchaKey(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-slate-900 text-white font-bold rounded-md hover:bg-slate-800 transition-colors shadow-sm"
              >
                Save Scraper Settings
              </button>
            </form>
          </div>

          {/* Database Specs Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <span>PostgreSQL Database Target</span>
            </h3>

            <div className="space-y-2 text-xs font-mono text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-400">Host:</span>
                <span className="text-slate-900 font-bold">postgres (Port 5432)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Database Name:</span>
                <span className="text-slate-900 font-bold">truck_gate_db</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Table:</span>
                <span className="text-indigo-600 font-bold">public.truck_entries</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
