import React, { useState } from 'react';
import { TruckEntry } from '../types';
import { Search, Download, Play, Plus, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface GateTableProps {
  entries: TruckEntry[];
  isLoading: boolean;
  onTriggerScrape: () => void;
  onOpenNewModal: () => void;
  onSelectEntry: (entry: TruckEntry) => void;
}

export const GateTable: React.FC<GateTableProps> = ({
  entries,
  isLoading,
  onTriggerScrape,
  onOpenNewModal,
  onSelectEntry
}) => {
  const [search, setSearch] = useState('');
  const [millFilter, setMillFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filtering
  const filteredEntries = entries.filter((item) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.transaction_id.toLowerCase().includes(q) ||
      item.license_plate.toLowerCase().includes(q) ||
      item.driver_name.toLowerCase().includes(q);

    const matchesMill =
      millFilter === 'All' || item.mill_destination.toLowerCase().includes(millFilter.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' || item.gate_status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesMill && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage) || 1;
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // CSV Export
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) return;
    const headers = ['Transaction ID', 'License Plate', 'Driver Name', 'Mill Destination', 'Gate Status', 'Tonnage', 'Timestamp'];
    const rows = filteredEntries.map((e) => [
      `"${e.transaction_id}"`,
      `"${e.license_plate}"`,
      `"${e.driver_name}"`,
      `"${e.mill_destination}"`,
      `"${e.gate_status}"`,
      `"${e.tonnage || 32.5}"`,
      `"${e.entry_timestamp}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gate_transactions_${Date.now()}.csv`;
    a.click();
  };

  const getBadgeStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'processing') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (s === 'pending') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s === 'rejected') return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <section className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
      {/* Table Header Controls */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-slate-800 text-base">Recent Gate Transactions</h3>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
            {filteredEntries.length} Records
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search plate, driver, ID..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Mill Filter */}
          <select
            value={millFilter}
            onChange={(e) => {
              setMillFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All Mills</option>
            <option value="Mill A">Mill A</option>
            <option value="Mill B">Mill B</option>
            <option value="Mill C">Mill C</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All Statuses</option>
            <option value="Approved">Approved</option>
            <option value="Processing">Processing</option>
            <option value="Pending">Pending</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Add Entry */}
          <button
            onClick={onOpenNewModal}
            className="px-3 py-1.5 text-xs bg-slate-800 text-white border border-slate-700 rounded-md font-medium hover:bg-slate-900 transition-colors flex items-center gap-1 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Entry</span>
          </button>

          {/* Scrape Trigger */}
          <button
            onClick={onTriggerScrape}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Play className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Scraping OPMS...' : 'Refresh Feed'}</span>
          </button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-white shadow-xs z-10">
            <tr className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
              <th className="px-6 py-3.5">Transaction ID</th>
              <th className="px-6 py-3.5">License Plate</th>
              <th className="px-6 py-3.5">Driver Name</th>
              <th className="px-6 py-3.5">Mill Destination</th>
              <th className="px-6 py-3.5">Gate Status</th>
              <th className="px-6 py-3.5">Tonnage</th>
              <th className="px-6 py-3.5">Timestamp</th>
              <th className="px-4 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-50">
            {paginatedEntries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">
                  No matching truck gate records found in database.
                </td>
              </tr>
            ) : (
              paginatedEntries.map((item) => {
                const formattedTime = new Date(
                  item.entry_timestamp || Date.now()
                ).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                return (
                  <tr
                    key={item.id || item.transaction_id}
                    onClick={() => onSelectEntry(item)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-mono text-slate-400 font-medium group-hover:text-indigo-600 transition-colors">
                      #{item.transaction_id}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {item.license_plate}
                    </td>
                    <td className="px-6 py-4 text-slate-700">{item.driver_name}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {item.mill_destination}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getBadgeStyle(
                          item.gate_status
                        )}`}
                      >
                        {item.gate_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-700 font-medium">
                      {item.tonnage ? `${item.tonnage} Tons` : '32.4 Tons'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                      {formattedTime}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEntry(item);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                        title="View Gate Receipt Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] font-medium text-slate-500 shrink-0">
        <span>
          Showing entries{' '}
          {filteredEntries.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
          {Math.min(currentPage * itemsPerPage, filteredEntries.length)} of{' '}
          {filteredEntries.length}
        </span>

        <div className="flex gap-1 items-center">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold transition-all ${
                currentPage === page
                  ? 'border border-indigo-600 bg-indigo-600 text-white shadow-2xs'
                  : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              {page}
            </button>
          ))}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
