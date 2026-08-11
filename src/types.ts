export interface TruckEntry {
  id: number;
  transaction_id: string;
  license_plate: string;
  driver_name: string;
  mill_destination: string;
  gate_status: 'Approved' | 'Processing' | 'Pending' | 'Rejected' | string;
  tonnage: number;
  entry_timestamp: string;
}

export interface MillStat {
  mill_destination: string;
  count: number;
  percentage: number;
}

export interface StatusStat {
  gate_status: string;
  count: number;
}

export interface KPIStats {
  totalTrucksToday: number;
  activeEntries: number;
  avgProcessingTimeMinutes: number;
  millBreakdown: MillStat[];
  statusBreakdown: StatusStat[];
}

export interface ScraperLog {
  id: number;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING';
  items_scraped: number;
  message: string;
  timestamp: string;
}

export interface MicroserviceFile {
  path: string;
  name: string;
  folder: string;
  content: string;
}
