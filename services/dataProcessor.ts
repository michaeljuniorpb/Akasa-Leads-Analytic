
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
  
  // Deteksi format mata uang (ID vs US)
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Format Indonesia: 1.000.000,00 -> Hapus titik, ganti koma ke titik
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Format US: 1,000,000.00 -> Hapus koma
      str = str.replace(/,/g, '');
    }
  } else if (hasDot && !hasComma) {
    // Hanya titik: Bisa jadi ribuan (1.500.000) atau desimal (150.50)
    // Di konteks Rupiah, jika ada titik biasanya adalah ribuan, kecuali jika hanya ada 1 titik dan diikuti 2 angka di belakangnya.
    // Namun untuk amannya, jika string mengandung lebih dari satu titik, itu pasti ribuan.
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    } else {
      // Jika cuma 1 titik, cek apakah posisinya seperti desimal (misal .00 atau .5)
      // Jika diikuti 3 angka (misal 500.000), maka itu ribuan
      const parts = str.split('.');
      if (parts[1] && parts[1].length === 3) {
        str = str.replace(/\./g, '');
      }
      // Sebaliknya, biarkan titik sebagai desimal (parseFloat akan menanganinya)
    }
  } else if (hasComma && !hasDot) {
    // Hanya koma: Biasanya desimal di Indonesia (150,50)
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  const clean = str.replace(/[^0-9.-]+/g, "");
  const result = parseFloat(clean);
  return isNaN(result) ? 0 : result;
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
    revenueExclPpn: parseNumber(getVal(['Revenue exclude ppn (auto)'])),
    tanggalVisitAja: parseDate(getVal(['Tanggal Visit Aja'])),
    terhitungVisit: String(getVal(['Terhitung Visit'])).toLowerCase() === 'yes',
    receivedAtHour: parseNumber(getVal(['Received At (hour)'])),
  };
};
