
import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LeadData, FunnelStats, LeadClassification } from '../types';
import { 
  Tooltip, ResponsiveContainer, Funnel, FunnelChart, LabelList
} from 'recharts';
import { 
  Calendar, Search, Info, TrendingUp, CloudOff, 
  ShoppingBag, Snowflake, Flame, Ban, Trash2, HelpCircle,
  Megaphone, CheckCircle2, Sparkles, RefreshCw, BarChart3,
  Database, Layers
} from 'lucide-react';
import { getAIInsights } from '../services/geminiService';
import { mapRawToLead } from '../services/dataProcessor';
import { saveLeadsToCloud } from '../services/firebaseService';
import Papa from 'papaparse';

interface Props {
  leads: LeadData[];
  refreshData?: () => Promise<void>;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const Dashboard: React.FC<Props> = ({ leads, refreshData }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>('Menunggu data untuk dianalisis...');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const storedSheetId = localStorage.getItem('gsheet_id');
  const storedRange = localStorage.getItem('gsheet_range');

  const stats = useMemo(() => {
    if (leads.length === 0) return null;

    const formatDateToComparable = (date: Date | null): string => {
      if (!date || isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const isInRange = (d: Date | null): boolean => {
      if (!d || isNaN(d.getTime())) return false;
      if (!startDate && !endDate) return true;
      const ds = formatDateToComparable(d);
      if (startDate && ds < startDate) return false;
      if (endDate && ds > endDate) return false;
      return true;
    };

    const leadsInPeriod = leads.filter(l => isInRange(l.assignedAt));

    if (leadsInPeriod.length === 0 && (startDate || endDate)) {
      const hasActivity = leads.some(l => isInRange(l.bookingDate) || isInRange(l.tanggalSiteVisit));
      if (!hasActivity) return { status: "NO_DATA" };
    }

    const rawCount = leadsInPeriod.length;
    const uniqueCount = leadsInPeriod.filter(l => 
      String(l.uniqueRawStatus).trim().toLowerCase() === 'unique'
    ).length;
    
    const visitedCount = leadsInPeriod.filter(l => l.tanggalSiteVisit !== null && String(l.statusSiteVisit || '').toLowerCase().includes('visit done')).length;
    const bookingCount = leadsInPeriod.filter(l => l.bookingDate !== null).length;

    const periodVisitCount = leads.filter(l => 
      isInRange(l.tanggalSiteVisit) && 
      String(l.statusSiteVisit || '').toLowerCase().includes('visit done')
    ).length;

    const periodBookingCount = leads.filter(l => isInRange(l.bookingDate)).length;

    const revenuePeriod = leads
      .filter(l => isInRange(l.bookingDate))
      .reduce((s, l) => s + (l.revenueExclPpn || 0), 0);

    const visitPerformanceRatio = uniqueCount > 0 ? (periodVisitCount / uniqueCount) * 100 : 0;
    const bookingPerformanceRatio = uniqueCount > 0 ? (periodBookingCount / uniqueCount) * 100 : 0;

    const sourceMap = new Map<string, { leads: number, visits: number, bookings: number, revenue: number }>();
    
    leadsInPeriod.forEach(l => {
      const s = String(l.source || 'Unknown').trim() || 'Unknown';
      const current = sourceMap.get(s) || { leads: 0, visits: 0, bookings: 0, revenue: 0 };
      current.leads += 1;
      if (l.tanggalSiteVisit !== null && String(l.statusSiteVisit || '').toLowerCase().includes('visit done')) {
        current.visits += 1;
      }
      sourceMap.set(s, current);
    });

    leads.filter(l => isInRange(l.bookingDate)).forEach(l => {
      const s = String(l.source || 'Unknown').trim() || 'Unknown';
      const current = sourceMap.get(s) || { leads: 0, visits: 0, bookings: 0, revenue: 0 };
      current.bookings += 1;
      current.revenue += (l.revenueExclPpn || 0);
      sourceMap.set(s, current);
    });

    const totalLeadsInPeriod = leadsInPeriod.length;
    const sourceJourneyData = Array.from(sourceMap.entries())
      .map(([source, data]) => ({
        source,
        leads: data.leads,
        visits: data.visits,
        bookings: data.bookings,
        visit_rate: data.leads > 0 ? (data.visits / data.leads) * 100 : 0,
        share: totalLeadsInPeriod > 0 ? (data.leads / totalLeadsInPeriod) * 100 : 0,
        revenue: data.revenue
      }))
      .filter(item => item.leads > 0 || item.visits > 0 || item.bookings > 0)
      .sort((a, b) => b.leads - a.leads);

    const agentMap = new Map<string, { uniqueCount: number, visits: number, bookings: number, revenue: number }>();
    
    leadsInPeriod.forEach(l => {
      const agentName = String(l.agent || 'Unassigned').trim();
      const isUnique = String(l.uniqueRawStatus).trim().toLowerCase() === 'unique';
      if (isUnique) {
        const current = agentMap.get(agentName) || { uniqueCount: 0, visits: 0, bookings: 0, revenue: 0 };
        current.uniqueCount += 1;
        if (l.tanggalSiteVisit !== null && String(l.statusSiteVisit || '').toLowerCase().includes('visit done')) {
          current.visits += 1;
        }
        agentMap.set(agentName, current);
      }
    });

    leads.filter(l => isInRange(l.bookingDate)).forEach(l => {
      const agentName = String(l.agent || 'Unassigned').trim();
      const current = agentMap.get(agentName) || { uniqueCount: 0, visits: 0, bookings: 0, revenue: 0 };
      current.bookings += 1;
      current.revenue += (l.revenueExclPpn || 0);
      agentMap.set(agentName, current);
    });

    const agentRanking = Array.from(agentMap.entries()).map(([agent, data]) => {
      const visitRate = data.uniqueCount > 0 ? (data.visits / data.uniqueCount) * 100 : 0;
      const bookingFromVisitRate = data.visits > 0 ? (data.bookings / data.visits) * 100 : 0;
      return { agent, ...data, visitRate, bookingFromVisitRate };
    }).sort((a, b) => b.bookings - a.bookings || b.visits - a.visits);

    const classification: LeadClassification = { cold: 0, prospect_warm: 0, booking: 0, junk: 0, drop: 0, unclassified: 0 };
    leadsInPeriod.forEach(l => {
      const status = (l.statusLeads || '').trim();
      if (["Belum diangkat/ belum respond", "Sedang sibuk & akan dihubungi ke", "Tertarik Project", "Kirim PL & Brochure"].includes(status)) classification.cold++;
      else if (["Jadwal Site Visit", "Site Visit Done", "Diskusi", "Negosiasi", "BI Checking", "Reservasi"].includes(status)) classification.prospect_warm++;
      else if (status === "Booking") classification.booking++;
      else if (["Nomor Invalid", "Spam", "Tidak Jawab Lebih dari 7x Followup"].includes(status)) classification.junk++;
      else if (["Budget kurang sesuai", "Sudah beli hunian lain", "Others", "Lokasi kurang sesuai", "Layout / spesifikasi kurang sesuai", "Agent", "Tidak berminat", "Butuh Sewa", "Masalah BI Checking", "Tunda Beli", "Pernah Balas, Menghilang", "Double Leads"].includes(status)) classification.drop++;
      else classification.unclassified++;
    });

    return {
      status: "OK",
      funnel: {
        raw: rawCount,
        unique: uniqueCount,
        visited: visitedCount,
        booking: bookingCount,
        qualified: classification.prospect_warm,
        prospect: classification.prospect_warm
      } as FunnelStats,
      classification,
      sourceJourneyData,
      sourceVisitEffectiveness: [...sourceJourneyData].sort((a, b) => b.visit_rate - a.visit_rate),
      agentRanking,
      revenuePeriod,
      topSource: { source: sourceJourneyData[0]?.source || '---' },
      topAgent: { name: agentRanking[0]?.agent || '---', bookings: agentRanking[0]?.bookings || 0 },
      topPerformance: {
        visit: [...agentRanking].sort((a, b) => b.visitRate - a.visitRate)[0]?.agent,
        booking: [...agentRanking].sort((a, b) => b.bookingFromVisitRate - a.bookingFromVisitRate)[0]?.agent
      },
      periodVisitCount,
      periodBookingCount,
      visitPerformanceRatio,
      bookingPerformanceRatio,
      totalLoadedLeads: leads.length
    };
  }, [leads, startDate, endDate]);

  useEffect(() => {
    if (stats && stats.status === "OK") {
      setAiAnalysis('Menyusun analisis strategis...');
      getAIInsights(stats).then(setAiAnalysis);
    }
  }, [stats]);

  const handleRefreshFromSheets = async () => {
    const sheetIdToUse = storedSheetId || '1N_As68ZpxsDnJuxojt6Z_li65ZL918pXvyl0F_B53Tw';
    const rangeToUse = storedRange || 'New Assign Leads!A1:AF';
    
    if (isRefreshing) return;
    setIsRefreshing(true);
    
    try {
      const response = await fetch(`/api/sheets?sheetId=${sheetIdToUse}&range=${encodeURIComponent(rangeToUse)}`);
      const responseText = await response.text();

      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        await handleFallbackRefresh(sheetIdToUse, rangeToUse);
        return;
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        await handleFallbackRefresh(sheetIdToUse, rangeToUse);
        return;
      }

      if (!response.ok) throw new Error(data.error || 'Refresh API Gagal');

      const { headers, rows } = data;
      const dataObjects = rows.map((row: any[]) => {
        const obj: any = {};
        headers.forEach((h: string, i: number) => { obj[h] = row[i]; });
        return obj;
      });

      const mapped = dataObjects.map(mapRawToLead);
      await saveLeadsToCloud(mapped);
      if (refreshData) await refreshData();
    } catch (err: any) {
      console.warn("API Gagal, mencoba mode Fallback...");
      await handleFallbackRefresh(sheetIdToUse, rangeToUse);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFallbackRefresh = async (sId: string, r: string) => {
    try {
      const sheetName = r.includes('!') ? r.split('!')[0] : '';
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sId}/gviz/tq?tqx=out:csv${sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : ''}`;

      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error('Sheet Access Error');
      
      const csvData = await res.text();
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          if (results.data && results.data.length > 0) {
            const mapped = results.data.map(mapRawToLead);
            await saveLeadsToCloud(mapped);
            if (refreshData) await refreshData();
          }
        }
      });
    } catch (err: any) {
      console.error("Fallback Sync Error:", err);
    }
  };

  if (leads.length === 0) return (
    <div className="h-[70vh] flex flex-col items-center justify-center text-center">
      <CloudOff size={64} className="text-slate-200 mb-6" />
      <h2 className="text-2xl font-bold text-slate-800">Database Kosong</h2>
      <Link to="/upload" className="mt-4 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold">Upload Data</Link>
    </div>
  );

  if (stats?.status === "NO_DATA") return (
    <div className="p-8 text-center">
      <Search size={48} className="mx-auto mb-4 text-slate-300" />
      <p className="text-slate-500">Tidak ada data pada periode ini.</p>
      <button onClick={() => {setStartDate(''); setEndDate('')}} className="mt-2 text-blue-600 font-bold underline">Reset Filter</button>
    </div>
  );

  if (!stats || stats.status !== "OK") return null;

  return (
    <div className="space-y-12 max-w-[1600px] mx-auto pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Leads Analyzer <span className="text-blue-600">Pro</span></h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Info size={12}/> Campaign & Sales Intelligence</p>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
               <Layers size={10} className="font-bold"/>
               <span className="text-[10px] font-black uppercase tracking-wider">Scope: {stats.totalLoadedLeads.toLocaleString()} Recent Leads</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleRefreshFromSheets} disabled={isRefreshing} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl hover:bg-emerald-100 transition-all font-bold text-sm shadow-sm">
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh from Sheets'}
          </button>
          <div className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
            <Calendar size={18} className="text-blue-500 ml-2" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border-none rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
            <span className="text-slate-300">to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border-none rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg"><Megaphone size={20} /></div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Campaign Evaluation</h2>
          <div className="h-px flex-1 bg-slate-200 ml-4"></div>
        </div>
        
        {stats.totalLoadedLeads >= 3000 && (
           <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800 mb-4">
             <Info className="shrink-0" size={20} />
             <p className="text-xs font-medium">Database mencapai limit tampilan (3.000 data terbaru). Jika Anda memiliki 10.000+ baris di Sheet, gunakan filter tanggal di atas untuk memfokuskan analisa pada periode tertentu saja agar angka akurat.</p>
           </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-l-4 border-l-blue-500">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Leads In</div>
             <div className="text-3xl font-black text-slate-900">{stats.funnel.raw}</div>
             <p className="text-[9px] text-slate-400 font-bold mt-1">Based on Assigned At</p>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-l-4 border-l-indigo-500">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unique Quality</div>
             <div className="text-3xl font-black text-slate-900">{stats.funnel.unique}</div>
             <p className="text-[9px] text-slate-400 font-bold mt-1">Denominator for Ratios</p>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-l-4 border-l-emerald-500">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visit Performance</div>
             <div className="flex items-baseline gap-2">
               <div className="text-3xl font-black text-slate-900">{stats.periodVisitCount}</div>
               <div className="text-sm font-bold text-emerald-600">({stats.visitPerformanceRatio.toFixed(1)}%)</div>
             </div>
             <p className="text-[9px] text-slate-400 font-bold mt-1">Based on Visit Date / Unique Assigned</p>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-l-4 border-l-orange-500">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Closing Performance</div>
             <div className="flex items-baseline gap-2">
               <div className="text-3xl font-black text-slate-900">{stats.periodBookingCount}</div>
               <div className="text-sm font-bold text-orange-600">({stats.bookingPerformanceRatio.toFixed(1)}%)</div>
             </div>
             <p className="text-[9px] text-slate-400 font-bold mt-1">Based on Booking Date / Unique Assigned</p>
           </div>
           <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white">
             <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Top Volume Source</div>
             <div className="text-lg font-black truncate">{stats.topSource.source}</div>
             <p className="text-[9px] text-slate-500 font-bold mt-1">By Raw Lead Count</p>
           </div>
        </div>

        {stats.sourceJourneyData.length > 0 && (
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm mt-8">
             <div className="flex items-center gap-3 mb-8">
               <BarChart3 className="text-blue-600" size={24} />
               <h3 className="text-lg font-black text-slate-800">Source Performance Distribution</h3>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full">
                 <thead>
                   <tr className="border-b border-slate-100 text-left">
                     <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-1/4">Source Channel</th>
                     <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Volume</th>
                     <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Share (%)</th>
                     <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Visit Rate</th>
                     <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Bookings</th>
                   </tr>
                 </thead>
                 <tbody>
                   {stats.sourceJourneyData.map((s, idx) => (
                     <tr key={s.source} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                       <td className="py-4 px-4">
                         <div className="font-bold text-slate-800">{s.source}</div>
                       </td>
                       <td className="py-4 px-4 text-center">
                         <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-black text-sm">{s.leads}</span>
                       </td>
                       <td className="py-4 px-4">
                          <div className="flex flex-col gap-1.5 items-center">
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${s.share}%` }}></div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">{s.share.toFixed(1)}%</span>
                          </div>
                       </td>
                       <td className="py-4 px-4 text-center">
                          <div className="font-black text-slate-700">{s.visit_rate.toFixed(1)}%</div>
                          <div className="text-[10px] text-slate-400 font-bold">{s.visits} Visit Done</div>
                       </td>
                       <td className="py-4 px-4 text-right">
                         <div className="font-black text-emerald-600">{s.bookings} Units</div>
                         <div className="text-[10px] text-slate-400 font-bold">{formatCurrency(s.revenue)}</div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg"><TrendingUp size={20} /></div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Sales & Revenue Performance</h2>
          <div className="h-px flex-1 bg-slate-200 ml-4"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-8">Conversion Funnel</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <Tooltip />
                      <Funnel dataKey="value" data={[
                        { value: stats.funnel.raw, name: 'Raw', fill: '#cbd5e1' },
                        { value: stats.funnel.unique, name: 'Unique', fill: '#6366f1' },
                        { value: stats.funnel.visited, name: 'Visited', fill: '#10b981' },
                        { value: stats.funnel.booking, name: 'Booking', fill: '#059669' },
                      ]} isAnimationActive>
                        <LabelList position="right" fill="#64748b" dataKey="name" style={{ fontSize: '10px', fontWeight: '800' }} />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-emerald-600 p-8 rounded-3xl shadow-xl text-white">
                <div className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-1">Period Revenue</div>
                <div className="text-3xl font-black">{formatCurrency(stats.revenuePeriod)}</div>
                <div className="mt-4 flex items-center gap-2 text-emerald-100 font-bold text-xs"><ShoppingBag size={14}/> {stats.periodBookingCount} Units Converted</div>
              </div>
           </div>
           <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
             <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-8">Lead Inventory Status</h3>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
               {[
                 { label: 'Cold', val: stats.classification.cold, icon: Snowflake, color: 'text-blue-500' },
                 { label: 'Warm/Prospect', val: stats.classification.prospect_warm, icon: Flame, color: 'text-orange-500' },
                 { label: 'Booking', val: stats.classification.booking, icon: CheckCircle2, color: 'text-emerald-600' },
                 { label: 'Junk', val: stats.classification.junk, icon: Trash2, color: 'text-slate-400' },
                 { label: 'Drop', val: stats.classification.drop, icon: Ban, color: 'text-red-400' },
                 { label: 'Others', val: stats.classification.unclassified, icon: HelpCircle, color: 'text-slate-300' },
               ].map(item => (
                 <div key={item.label} className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                   <div className={`flex items-center gap-2 ${item.color} mb-1`}>
                     <item.icon size={14} />
                     <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                   </div>
                   <div className="text-3xl font-black text-slate-800">{item.val}</div>
                 </div>
               ))}
             </div>
           </div>
        </div>
      </div>

      <div className="space-y-6 pt-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg"><Sparkles size={20} /></div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">AI Executive Summary</h2>
          <div className="h-px flex-1 bg-slate-200 ml-4"></div>
        </div>
        <div className="bg-gradient-to-br from-indigo-950 to-blue-900 p-10 rounded-[3rem] text-white flex flex-col relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full -mr-40 -mt-40 blur-3xl"></div>
          <div className="flex-1 bg-black/20 backdrop-blur-sm rounded-[2rem] p-10 text-xl leading-relaxed relative z-10 text-blue-50/90 italic font-medium whitespace-pre-wrap">
            {aiAnalysis}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
