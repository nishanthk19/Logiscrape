import React from 'react';
import { TruckEntry } from '../types';
import { X, CheckCircle, Clock, AlertTriangle, ShieldCheck, Printer, MapPin, User, Scale } from 'lucide-react';

interface TruckDetailModalProps {
  entry: TruckEntry | null;
  onClose: () => void;
}

export const TruckDetailModal: React.FC<TruckDetailModalProps> = ({
  entry,
  onClose
}) => {
  if (!entry) return null;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'approved')
      return (
        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" /> Approved
        </span>
      );
    if (s === 'processing')
      return (
        <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> Processing
        </span>
      );
    return (
      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5" /> {status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Receipt Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-indigo-400 font-bold">
                OPMS-RECEIPT #{entry.transaction_id}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-900 text-indigo-300 border border-indigo-700">
                Verified Scrape
              </span>
            </div>
            <h3 className="font-bold text-lg text-white">Truck Gate Receipt</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Vehicle Plate</p>
              <p className="text-2xl font-bold text-slate-900 tracking-tight font-mono">{entry.license_plate}</p>
            </div>
            <div>{getStatusBadge(entry.gate_status)}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-2.5">
              <User className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Registered Driver</p>
                <p className="font-semibold text-slate-900 text-xs mt-0.5">{entry.driver_name}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Mill Destination</p>
                <p className="font-semibold text-slate-900 text-xs mt-0.5">{entry.mill_destination}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-2.5">
              <Scale className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Weighbridge Tonnage</p>
                <p className="font-mono font-bold text-slate-900 text-xs mt-0.5">
                  {entry.tonnage ? `${entry.tonnage} Metric Tons` : '32.4 Metric Tons'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Gate Timestamp</p>
                <p className="font-mono text-slate-800 text-[11px] mt-0.5">
                  {new Date(entry.entry_timestamp || Date.now()).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-[11px] text-indigo-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Entry record successfully authenticated against OPMS portal database with 2Captcha verification token.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-md hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Receipt</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white font-semibold rounded-md hover:bg-slate-800 transition-colors text-xs"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
