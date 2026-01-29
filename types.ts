
export interface LeadData {
  custId: string;
  namaLeads: string;
  agent: string;
  assignedAt: Date | null;
  source: string;
  noAttempt: number;
  statusLeads: string;
  remarks: string;
  domisili: string;
  pekerjaan: string;
  slaDuration: string;
  overdue: boolean;
  tanggalSiteVisit: Date | null;
  statusSiteVisit: string;
  bookingDate: Date | null;
  id: string;
  linkIklan: string;
  unique: boolean;
  // Added uniqueRawStatus to track the original status string from the spreadsheet
  uniqueRawStatus: string;
  sourceTracker: string;
  daysToVisit: number;
  daysToBooking: number;
  tower: string;
  lantai: string;
  nomor: string;
  type: string;
  revenue: number;
  revenueExclPpn: number;
  tanggalVisitAja: Date | null;
  terhitungVisit: boolean;
  receivedAtHour: number;
}

export interface FunnelStats {
  raw: number;
  unique: number;
  qualified: number;
  prospect: number;
  visited: number;
  booking: number;
}

export interface LeadClassification {
  cold: number;
  prospect_warm: number;
  booking: number;
  junk: number;
  drop: number;
  unclassified: number;
}

export interface AgentPerformance {
  name: string;
  leads: number;
  visits: number;
  bookings: number;
  conversionRate: number;
  revenue: number;
}

export interface SourceStats {
  source: string;
  count: number;
  percentage: number;
  effectiveness: number; // Booking / Leads
}
