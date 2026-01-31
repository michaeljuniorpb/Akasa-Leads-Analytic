
import { LeadData } from '../types';

export const parseDate = (val: any): Date | null => {
  if (val === undefined || val === null || val === '') return null;
  
  let num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 100000) {
    return new Date(Math.round((num - 25569) * 86400 * 1000));
  }

  const strVal = String(val).trim();
  if (!strVal) return null;

  const d = new Date(strVal);
  if (!isNaN(d.getTime())) return d;

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
  if (!val || val === '') return 0;
  
  let str = String(val).trim();
  
  // Standardize potential Indonesian format from formulas (e.g. 1.500.000,50)
  if (str.includes(',') && str.includes('.')) {
    // Has both: assume Indo if comma is last (1.000,00) or US if dot is last (1,000.00)
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',') && !str.includes('.')) {
    // Only comma: check if it's thousands or decimals.
    // In ID context, usually decimal if it's like 10,5.
    // But if it's 1,000 it's US. Let's assume decimal if it's the formula result context.
    str = str.replace(',', '.');
  }

  const clean = str.replace(/[^0-9.-]+/g, "");
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

  const rawUniqueVal = String(getVal(['Unique?']) || '').trim();

  return {
    custId: String(getVal(['Cust ID', 'cust_id', 'CustomerID']) || ''),
    namaLeads: String(getVal(['Nama Leads', 'Name', 'Lead Name']) || ''),
    agent: String(getVal(['Agent', 'agent_name']) || ''),
    assignedAt: parseDate(getVal(['Assigned At'])),
    source: String(getVal(['Source']) || 'Unknown'),
    noAttempt: parseNumber(getVal(['no Attempt'])),
    statusLeads: String(getVal(['Status leads']) || ''),
    remarks: String(getVal(['Remarks']) || ''),
    domisili: String(getVal(['Domisili']) || ''),
    pekerjaan: String(getVal(['Pekerjaan (User yg klik)']) || ''),
    slaDuration: String(getVal(['Time duration SLA']) || ''),
    overdue: String(getVal(['Overdue?'])).toLowerCase() === 'yes',
    tanggalSiteVisit: parseDate(getVal(['Tanggal Site Visit']) || getVal(['Tanggal Visit Aja'])),
    statusSiteVisit: String(getVal(['Status Site Visit']) || '').trim(),
    bookingDate: parseDate(getVal(['Booking Date'])),
    id: String(getVal(['ID', 'lead_id']) || ''),
    linkIklan: String(getVal(['LINK IKLAN']) || ''),
    unique: rawUniqueVal.toLowerCase() === 'unique',
    uniqueRawStatus: rawUniqueVal, 
    sourceTracker: String(getVal(['Source Tracker']) || ''),
    daysToVisit: parseNumber(getVal(['Assigned to Visit (Days)'])),
    daysToBooking: parseNumber(getVal(['Assign to Booking (Days)'])),
    tower: String(getVal(['Tower']) || ''),
    lantai: String(getVal(['Lantai']) || ''),
    nomor: String(getVal(['Nomor']) || ''),
    type: String(getVal(['Type (Auto)']) || ''),
    revenue: parseNumber(getVal(['Revenue (auto)'])),
    // Mapping requested by user for formula result column
    revenueExclPpn: parseNumber(getVal(['Revenue exclude ppn (auto)'])),
    tanggalVisitAja: parseDate(getVal(['Tanggal Visit Aja'])),
    terhitungVisit: String(getVal(['Terhitung Visit'])).toLowerCase() === 'yes',
    receivedAtHour: parseNumber(getVal(['Received At (hour)'])),
  };
};
