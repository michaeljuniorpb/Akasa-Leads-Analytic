
import { LeadData } from '../types';

export const parseDate = (val: any): Date | null => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export const parseNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/[^0-9.-]+/g, "");
  return parseFloat(clean) || 0;
};

export const mapRawToLead = (row: any): LeadData => {
  // Try to match variations in column names
  const getVal = (possibleKeys: string[]) => {
    for (const key of possibleKeys) {
      if (row[key] !== undefined) return row[key];
    }
    return undefined;
  };

  return {
    custId: String(getVal(['Cust ID', 'cust_id', 'CustomerID']) || ''),
    namaLeads: String(getVal(['Nama Leads', 'nama_leads', 'Name']) || ''),
    agent: String(getVal(['Agent', 'agent_name']) || ''),
    assignedAt: parseDate(getVal(['Assigned at', 'assigned_at'])),
    source: String(getVal(['Source', 'source_leads']) || 'Unknown'),
    noAttempt: parseNumber(getVal(['no Attempt', 'attempt'])),
    statusLeads: String(getVal(['Status leads', 'status']) || ''),
    remarks: String(getVal(['Remarks', 'catatan']) || ''),
    domisili: String(getVal(['Domisili', 'city']) || ''),
    pekerjaan: String(getVal(['Pekerjaan (User yg klik)', 'occupation']) || ''),
    slaDuration: String(getVal(['Time duration SLA', 'sla']) || ''),
    overdue: String(getVal(['Overdue?'])).toLowerCase() === 'yes',
    tanggalSiteVisit: parseDate(getVal(['Tanggal Site Visit', 'visit_date'])),
    statusSiteVisit: String(getVal(['Status Site Visit', 'visit_status']) || ''),
    bookingDate: parseDate(getVal(['Booking Date', 'booking_at'])),
    id: String(getVal(['ID', 'lead_id']) || ''),
    linkIklan: String(getVal(['LINK IKLAN', 'ad_link']) || ''),
    unique: String(getVal(['Unique?', 'is_unique'])).toLowerCase() === 'yes' || getVal(['Unique?']) === 1,
    sourceTracker: String(getVal(['Source Tracker']) || ''),
    daysToVisit: parseNumber(getVal(['Assigned to Visit (Days)'])),
    daysToBooking: parseNumber(getVal(['Assign to Booking (Days)'])),
    tower: String(getVal(['Tower']) || ''),
    lantai: String(getVal(['Lantai']) || ''),
    nomor: String(getVal(['Nomor']) || ''),
    type: String(getVal(['Type (Auto)']) || ''),
    revenue: parseNumber(getVal(['Revenue (auto)', 'revenue'])),
    revenueExclPpn: parseNumber(getVal(['Revenue exclude ppn (auto)'])),
    tanggalVisitAja: parseDate(getVal(['Tanggal Visit Aja'])),
    terhitungVisit: String(getVal(['Terhitung Visit'])).toLowerCase() === 'yes',
    receivedAtHour: parseNumber(getVal(['Received At (hour)'])),
  };
};
