import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { KPICards } from './components/KPICards';
import { GateTable } from './components/GateTable';
import { ScraperControl } from './components/ScraperControl';
import { CodeInspector } from './components/CodeInspector';
import { NewTruckModal } from './components/NewTruckModal';
import { TruckDetailModal } from './components/TruckDetailModal';
import { TruckEntry, KPIStats, ScraperLog, MicroserviceFile } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scraper' | 'codebase'>('dashboard');
  const [entries, setEntries] = useState<TruckEntry[]>([]);
  const [stats, setStats] = useState<KPIStats | null>(null);
  const [logs, setLogs] = useState<ScraperLog[]>([]);
  const [files, setFiles] = useState<MicroserviceFile[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoopActive, setIsLoopActive] = useState<boolean>(true);
  const [selectedEntry, setSelectedEntry] = useState<TruckEntry | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. Fetch Truck Entries
  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/trucks');
      const json = await res.json();
      if (json.success) {
        setEntries(json.data);
      }
    } catch (err) {
      console.error('Error fetching truck entries:', err);
    }
  }, []);

  // 2. Fetch KPI Statistics
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/trucks/stats');
      const json = await res.json();
      if (json.success) {
        setStats(json);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // 3. Fetch Scraper Logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/scraper/logs');
      const json = await res.json();
      if (json.success) {
        setLogs(json.logs);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  }, []);

  // 4. Fetch Microservice Architecture Files
  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      const json = await res.json();
      if (json.success) {
        setFiles(json.files);
      }
    } catch (err) {
      console.error('Error fetching codebase files:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchEntries();
    fetchStats();
    fetchLogs();
    fetchFiles();
  }, [fetchEntries, fetchStats, fetchLogs, fetchFiles]);

  // Automated 15-minute loop simulation
  useEffect(() => {
    if (!isLoopActive) return;
    const interval = setInterval(() => {
      fetchEntries();
      fetchStats();
      fetchLogs();
    }, 30000); // 30s auto-refresh for responsive demo
    return () => clearInterval(interval);
  }, [isLoopActive, fetchEntries, fetchStats, fetchLogs]);

  // Trigger Manual Scrape
  const handleTriggerScrape = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/scraper/trigger', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showToast('Playwright Scraper run completed! OPMS portal data synchronized.');
        await fetchEntries();
        await fetchStats();
        await fetchLogs();
      }
    } catch (err) {
      showToast('Scraper triggered in simulation mode.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add New Entry
  const handleAddEntry = async (newTruck: {
    transaction_id: string;
    license_plate: string;
    driver_name: string;
    mill_destination: string;
    gate_status: string;
    tonnage: number;
  }) => {
    try {
      const res = await fetch('/api/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTruck)
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Gate record #${newTruck.transaction_id} logged successfully.`);
        await fetchEntries();
        await fetchStats();
      }
    } catch (err) {
      console.error('Failed to log new truck:', err);
    }
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl border border-indigo-500/50 flex items-center gap-3 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{notification}</span>
        </div>
      )}

      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isScraperRunning={isLoopActive}
        onRefreshData={() => {
          fetchEntries();
          fetchStats();
          fetchLogs();
          showToast('Data feed refreshed from database.');
        }}
      />

      {/* Main Content Body */}
      <main className="flex-1 p-6 flex flex-col gap-6 overflow-hidden max-w-7xl w-full mx-auto">
        {activeTab === 'dashboard' && (
          <>
            {/* KPI Cards Section */}
            <KPICards stats={stats} />

            {/* Gate Entries Data Table */}
            <GateTable
              entries={entries}
              isLoading={isLoading}
              onTriggerScrape={handleTriggerScrape}
              onOpenNewModal={() => setIsNewModalOpen(true)}
              onSelectEntry={(entry) => setSelectedEntry(entry)}
            />
          </>
        )}

        {activeTab === 'scraper' && (
          <ScraperControl
            logs={logs}
            isLoopActive={isLoopActive}
            setIsLoopActive={setIsLoopActive}
            onTriggerScrape={handleTriggerScrape}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'codebase' && (
          <CodeInspector files={files} />
        )}
      </main>

      {/* New Truck Modal */}
      <NewTruckModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleAddEntry}
      />

      {/* Truck Receipt Detail Modal */}
      <TruckDetailModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}
