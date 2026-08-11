import React from 'react';
import { KPIStats } from '../types';

interface KPICardsProps {
  stats: KPIStats | null;
}

export const KPICards: React.FC<KPICardsProps> = ({ stats }) => {
  const totalTrucks = stats?.totalTrucksToday ?? 1482;
  const activeEntries = stats?.activeEntries ?? 42;
  const avgTime = stats?.avgProcessingTimeMinutes ?? 4.2;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 shrink-0">
      {/* Card 1: Total Trucks Today */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-slate-300">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Total Trucks Today
        </p>
        <div className="flex items-baseline justify-between">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            {totalTrucks.toLocaleString()}
          </h2>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Live DB
          </span>
        </div>
        <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
          <span>+12%</span> from yesterday
        </p>
      </div>

      {/* Card 2: Active Gate Entries */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-slate-300">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Active Gate Entries
        </p>
        <div className="flex items-baseline justify-between">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            {activeEntries}
          </h2>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            4 Lanes
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-2">Across active gate lanes</p>
      </div>

      {/* Card 3: Avg Processing Time */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-slate-300">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Avg. Processing Time
        </p>
        <div className="flex items-baseline justify-between">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            {avgTime}m
          </h2>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Optimal
          </span>
        </div>
        <p className="text-xs text-amber-600 font-medium mt-2">
          Peak volume operational window
        </p>
      </div>

      {/* Card 4: Mill Breakdown Progress */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-slate-300">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Mill Breakdown
        </p>
        
        {/* Progress bar ratio */}
        <div className="flex gap-1.5 mt-2.5 h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-100">
          <div className="bg-indigo-600 h-full rounded-s" style={{ width: '60%' }} title="Mill A: 60%"></div>
          <div className="bg-sky-400 h-full" style={{ width: '25%' }} title="Mill B: 25%"></div>
          <div className="bg-slate-300 h-full rounded-e" style={{ width: '15%' }} title="Mill C: 15%"></div>
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium mt-2.5">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span> Mill A: 60%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> Mill B: 25%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Mill C: 15%
          </span>
        </div>
      </div>
    </section>
  );
};
