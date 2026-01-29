
import { LeadData } from '../types';

export const parseDate = (val: any): Date | null => {
  if (val === undefined || val === null || val === '') return null;
  
  // Deteksi angka Excel (Serial Date). Jan 1 2026 adalah ~46022.
  // Jika angka di atas 30000, hampir pasti itu Serial Date Excel (bukan milidetik atau tahun)
  let num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 100000) {
    return new Date(Math.round((num - 25569) * 86400 * 1000));
  }

  const strVal = String(val).trim();
  if (!strVal) return null;

  // Handle format DD/MM/YYYY atau DD MMM YYYY (seperti di screenshot "01 Jan 2026")
  const d = new Date(strVal);
  if (!isNaN(d.getTime())) return d;

  // Fallback regex manual untuk format Indonesia
  const ddmmyyyyRegex = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;
  const match = strVal.match(ddmmyyyyRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; 
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  return null;
};

export const parseNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/[^0-9.-]+/g, "");
  return parseFloat(clean) || 0;
};

export const mapRawToLead = (row: any): LeadData => {
  const rowKeys = Object.keys(row);
  
  const getVal = (possibleKeys: string[]) => {
    for (const searchKey of possibleKeys) {
      const foundKey = rowKeys.find(k => 
        k.trim().toLowerCase() === searchKey.toLowerCase().trim()
      );
      if (foundKey !== undefined) return row[foundKey];
    }
    return undefined;
  };

  // LOGIK: Unique? = "Unique" (Case sensitive)
  const rawUniqueVal = String(getVal(['Unique?']) || '').trim();

  return {
    custId: String(getVal(['Cust ID', 'cust_id', 'CustomerID']) || ''),
    namaLeads: String(getVal(['Nama Leads', 'Name', 'Lead Name']) || ''),
    agent: String(getVal(['Agent', 'agent_name']) || ''),
    
    // STRICT: Harus "Assigned At"
    assignedAt: parseDate(getVal(['Assigned At'])),
    
    source: String(getVal(['Source']) || 'Unknown'),
    noAttempt: parseNumber(getVal(['no Attempt'])),
    statusLeads: String(getVal(['Status leads']) || ''),
    remarks: String(getVal(['Remarks']) || ''),
    domisili: String(getVal(['Domisili']) || ''),
    pekerjaan: String(getVal(['Pekerjaan (User yg klik)']) || ''),
    slaDuration: String(getVal(['Time duration SLA']) || ''),
    overdue: String(getVal(['Overdue?'])).toLowerCase() === 'yes',
    
    // Gunakan 'Tanggal Site Visit' sebagai prioritas untuk metric visit
    tanggalSiteVisit: parseDate(getVal(['Tanggal Site Visit']) || getVal(['Tanggal Visit Aja'])),
    
    statusSiteVisit: String(getVal(['Status Site Visit']) || '').trim(),
    bookingDate: parseDate(getVal(['Booking Date'])),
    id: String(getVal(['ID', 'lead_id']) || ''),
    linkIklan: String(getVal(['LINK IKLAN']) || ''),
    
    // Flag bantuan
    unique: rawUniqueVal.toLowerCase() === 'unique',
    uniqueRawStatus: rawUniqueVal, // Simpan nilai asli "Unique" atau "Not Unique"
    
    sourceTracker: String(getVal(['Source Tracker']) || ''),
    daysToVisit: parseNumber(getVal(['Assigned to Visit (Days)'])),
    daysToBooking: parseNumber(getVal(['Assign to Booking (Days)'])),
    tower: String(getVal(['Tower']) || ''),
    lantai: String(getVal(['Lantai']) || ''),
    nomor: String(getVal(['Nomor']) || ''),
    type: String(getVal(['Type (Auto)']) || ''),
    revenue: parseNumber(getVal(['Revenue (auto)'])),
    revenueExclPpn: parseNumber(getVal(['Revenue exclude ppn (auto)'])),
    tanggalVisitAja: parseDate(getVal(['Tanggal Visit Aja'])),
    terhitungVisit: String(getVal(['Terhitung Visit'])).toLowerCase() === 'yes',
    receivedAtHour: parseNumber(getVal(['Received At (hour)'])),
  };
};
