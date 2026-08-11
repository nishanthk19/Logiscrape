import React, { useState } from 'react';
import { X, Plus, Truck } from 'lucide-react';

interface NewTruckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    transaction_id: string;
    license_plate: string;
    driver_name: string;
    mill_destination: string;
    gate_status: string;
    tonnage: number;
  }) => void;
}

export const NewTruckModal: React.FC<NewTruckModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [txId, setTxId] = useState(`G-${Math.floor(29400 + Math.random() * 500)}`);
  const [plate, setPlate] = useState('ABC-1234');
  const [driver, setDriver] = useState('Robert Miller');
  const [mill, setMill] = useState('Mill A - North Row');
  const [status, setStatus] = useState('Approved');
  const [tonnage, setTonnage] = useState(34.2);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      transaction_id: txId,
      license_plate: plate,
      driver_name: driver,
      mill_destination: mill,
      gate_status: status,
      tonnage: Number(tonnage)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base">Log New Truck Gate Entry</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Transaction ID</label>
            <input
              type="text"
              required
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">License Plate</label>
              <input
                type="text"
                required
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md uppercase font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Tonnage (Tons)</label>
              <input
                type="number"
                step="0.1"
                required
                value={tonnage}
                onChange={(e) => setTonnage(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Driver Name</label>
            <input
              type="text"
              required
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Mill Destination</label>
            <select
              value={mill}
              onChange={(e) => setMill(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Mill A - North Row">Mill A - North Row</option>
              <option value="Mill B - Silo 2">Mill B - Silo 2</option>
              <option value="Mill B - Silo 1">Mill B - Silo 1</option>
              <option value="Mill C - Storage">Mill C - Storage</option>
              <option value="Mill A - Grain Elevator">Mill A - Grain Elevator</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Gate Clearance Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Approved">Approved</option>
              <option value="Processing">Processing</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 text-slate-700 font-semibold rounded-md hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
