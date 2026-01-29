
import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LeadData, FunnelStats, SourceStats, LeadClassification } from '../types';
import { 
  Tooltip, ResponsiveContainer, Funnel, FunnelChart, LabelList,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Legend
} from 'recharts';
import { 
  Users, Target, CheckCircle2, Sparkles, 
  Calendar, UserCheck, Search, X, BarChart3, AlertCircle, Info, TrendingUp, CloudOff, 
  ShoppingBag, Banknote, Landmark, Snowflake, Flame, Ban, Trash2, HelpCircle,
  Megaphone, Zap, Award
} from 'lucide-react';
import { getAIInsights } from '../services/geminiService';

interface Props {
  leads: LeadData[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const Dashboard: React.FC<Props> = ({ leads }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>('Menganalisis data kampanye dan sales...');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const stats = useMemo(() => {
    if (leads.length === 0) return null;

    const formatDateToComparable = (date: Date | null): string => {
      if (!date || isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const leadsInPeriod = leads.filter(l => {
      if (!startDate && !endDate) return true;
      if (!l.assignedAt) return false;
      const leadDateStr = formatDateToComparable(l.assignedAt);
      if (startDate && leadDateStr < startDate) return false;
      if (endDate && leadDateStr > endDate) return false;
      return true;
    });

    const rawLeadsCount = leadsInPeriod.length;
    if (rawLeadsCount === 0 && (startDate || endDate)) {
      return { status: "NO_DATA" };
    }

    const uniqueLeadsCount = leadsInPeriod.filter(l => 
      String(l.uniqueRawStatus).trim().toLowerCase() === 'unique'
    ).length;

    // --- Source Journey Logic (Leads -> Visit -> Booking) ---
    const sourceJourneyMap = new Map<string, { leads: number, visits: number, bookings: number, revenue: number }>();
    leadsInPeriod.forEach(l => {
      const s = String(l.source || 'Unknown').trim() || 'Unknown';
      const current = sourceJourneyMap.get(s) || { leads: 0, visits: 0, bookings: 0, revenue: 0 };
      
      current.leads += 1;
      if (l.tanggalSiteVisit !== null && String(l.statusSiteVisit || '').toLowerCase().includes('visit done')) {
        current.visits += 1;
      }
      if (l.bookingDate !== null) {
        current.bookings += 1;
        current.revenue += (l.revenueExclPpn || 0);
      }
      sourceJourneyMap.set(s, current);
    });

    const sourceJourneyData = Array.from(sourceJourneyMap.entries()).map(([source, data]) => ({
      source,
      leads: data.leads,
      visits: data.visits,
      bookings: data.bookings,
      visit_rate: data.leads > 0 ? (data.visits / data.leads) * 100 : 0,
      booking_rate: data.leads > 0 ? (data.bookings / data.leads) * 100 : 0,
      revenue: data.revenue
    })).sort((a, b) => b.leads - a.leads);

    // Source Visit Effectiveness (Sorted by Quality)
    const sourceVisitEffectiveness = [...sourceJourneyData]
      .filter(d => d.leads >= 1) 
      .sort((a, b) => b.visit_rate - a.visit_rate);

    // Sales Effectiveness Ranking
    const agentEffMap = new Map<string, { uniqueCount: number, visits: number, bookings: number, revenue: number }>();
    leadsInPeriod.forEach(l => {
      const agentName = String(l.agent || '').trim();
      const isUnique = String(l.uniqueRawStatus).trim().toLowerCase() === 'unique';
      
      if (agentName && isUnique) {
        const current = agentEffMap.get(agentName) || { uniqueCount: 0, visits: 0, bookings: 0, revenue: 0 };
        current.uniqueCount += 1;
        if (l.tanggalSiteVisit !== null && String(l.statusSiteVisit || '').toLowerCase().includes('visit done')) {
          current.visits += 1;
        }
        if (l.bookingDate !== null) {
          current.bookings += 1;
          current.revenue += (l.revenueExclPpn || 0);
        }
        agentEffMap.set(agentName, current);
      }
    });

    const agentRanking = Array.from(agentEffMap.entries()).map(([agent, data]) => {
      const visitRate = data.uniqueCount > 0 ? (data.visits / data.uniqueCount) * 100 : 0;
      const bookingFromVisitRate = data.visits > 0 ? (data.bookings / data.visits) * 100 : 0;
      const score = (visitRate * 0.4) + (bookingFromVisitRate * 0.4) + ((data.revenue / 1000000000) * 0.2);
      return { agent, ...data, visitRate, bookingFromVisitRate, score };
    }).sort((a, b) => b.score - a.score);

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
      rawLeadsCount,
      uniqueLeadsCount,
      visitedCount: leadsInPeriod.filter(l => l.tanggalSiteVisit !== null && l.statusSiteVisit.toLowerCase() === 'visit done').length,
      bookingCount: leadsInPeriod.filter(l => l.bookingDate !== null).length,
      revenuePeriod: leadsInPeriod.filter(l => l.bookingDate !== null).reduce((s, l) => s + (l.revenueExclPpn || 0), 0),
      sourceJourneyData,
      sourceVisitEffectiveness,
      agentRanking,
      classification,
      topPerformance: {
        visit: agentRanking.sort((a, b) => b.visitRate - a.visitRate)[0]?.agent,
        booking: agentRanking.sort((a, b) => b.bookingFromVisitRate - a.bookingFromVisitRate)[0]?.agent
      },
      status: "OK"
    };
  }, [leads, startDate, endDate]);

  useEffect(() => {
    if (stats && stats.status === "OK") {
      setAiAnalysis('Menyusun rangkuman eksekutif...');
      getAIInsights(stats).then(setAiAnalysis);
    }
  }, [stats]);

  const renderHeader = () => (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Leads Analyzer <span className="text-blue-600">Pro</span></h1>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
          <Info size={12} /> Dashboard Evaluasi Marketing & Sales
        </p>
      </div>
      <div className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
        <Calendar size={18} className="text-blue-500 ml-2" />
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border-none rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-100" />
          <span className="text-slate-300 font-bold">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border-none rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-100" />
          {(startDate || endDate) && <button onClick={() => {setStartDate(''); setEndDate('')}} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><X size={16} /></button>}
        </div>
      </div>
    </div>
  );

  if (leads.length === 0) return (
    <div className="h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <CloudOff size={64} className="text-slate-200 mb-6" />
      <h2 className="text-2xl font-bold text-slate-800">Database Kosong</h2>
      <p className="text-slate-500 mb-8">Upload data CSV/Excel untuk memulai analisis performa.</p>
      <Link to="/upload" className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg">Upload Data</Link>
    </div>
  );

  if (stats?.status === "NO_DATA") return (
    <div className="space-y-8">
      {renderHeader()}
      <div className="h-[40vh] bg-white rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
         <Search size={48} className="mb-4 opacity-20" />
         <h3 className="text-lg font-bold text-slate-600">Data Tidak Ditemukan</h3>
         <button onClick={() => {setStartDate(''); setEndDate('')}} className="mt-4 text-blue-600 font-bold">Tampilkan Semua Data</button>
      </div>
    </div>
  );

  if (!stats || stats.status !== "OK") return null;

  return (
    <div className="space-y-12 pb-20 max-w-[1600px] mx-auto">
      {renderHeader()}

      {/* --- SECTION 1: CAMPAIGN JOURNEY EVALUATION (MARKETING) --- */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg"><Megaphone size={20} /></div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Campaign & Source Evaluation</h2>
          <div className="h-px flex-1 bg-slate-200 ml-4"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-l-4 border-l-blue-500">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Inbound</div>
            <div className="text-3xl font-black text-slate-900">{stats.rawLeadsCount}</div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-l-4 border-l-indigo-500">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unique Leads</div>
            <div className="text-3xl font-black text-slate-900">{stats.uniqueLeadsCount}</div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-l-4 border-l-emerald-500">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visit Ratio</div>
            <div className="text-3xl font-black text-slate-900">{((stats.visitedCount / (stats.uniqueLeadsCount || 1)) * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Best Source (Volume)</div>
            <div className="text-lg font-black truncate">{stats.sourceJourneyData[0]?.source || '---'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart Volume */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="mb-8">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 size={16} /> Source Volume Breakdown
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Distribusi jumlah leads berdasarkan sumber</p>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.sourceJourneyData} layout="vertical" margin={{ right: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="source" width={120} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="leads" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={20}>
                    <LabelList dataKey="leads" position="right" formatter={(v: number) => `${v} Leads`} style={{fontSize: 10, fontWeight: 800, fill: '#1e293b'}} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart Visit Effectiveness (UPDATED: Added Count Info) */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="mb-8">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 text-emerald-600">
                <Zap size={16} /> Source to Visit Quality
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Journey: Persentase leads menjadi Visit Done (dan Jumlah Visit)</p>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.sourceVisitEffectiveness.slice(0, 10)} layout="vertical" margin={{ right: 80 }}>
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis type="category" dataKey="source" width={120} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: '#f0fdf4'}} 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl">
                            <p className="text-xs font-black text-slate-800 mb-1">{data.source}</p>
                            <p className="text-[10px] font-bold text-emerald-600">Visit Rate: {data.visit_rate.toFixed(1)}%</p>
                            <p className="text-[10px] font-bold text-slate-500">Total Visit: {data.visits}</p>
                            <p className="text-[10px] font-bold text-slate-400">Total Leads: {data.leads}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="visit_rate" fill="#10b981" radius={[0, 8, 8, 0]} barSize={20}>
                    {/* Display both % and absolute count on labels */}
                    <LabelList 
                      dataKey="visit_rate" 
                      position="right" 
                      content={(props: any) => {
                        const { x, y, width, value, index } = props;
                        const visitCount = stats.sourceVisitEffectiveness[index]?.visits;
                        return (
                          <text x={x + width + 5} y={y + 14} fill="#065f46" fontSize={10} fontWeight={800} textAnchor="start">
                            {`${value.toFixed(1)}% (${visitCount} Vst)`}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION 2: SALES PERFORMANCE (SALES) --- */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg"><TrendingUp size={20} /></div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Sales Performance & Revenue</h2>
          <div className="h-px flex-1 bg-slate-200 ml-4"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
             <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-8">Sales Pipeline</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <Tooltip />
                      <Funnel dataKey="value" data={[
                        { value: stats.rawLeadsCount, name: 'Raw', fill: '#cbd5e1' },
                        { value: stats.uniqueLeadsCount, name: 'Unique', fill: '#6366f1' },
                        { value: stats.visitedCount, name: 'Visited', fill: '#10b981' },
                        { value: stats.bookingCount, name: 'Booking', fill: '#059669' },
                      ]} isAnimationActive>
                        <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" style={{ fontSize: '10px', fontWeight: '800' }} />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                </div>
             </div>
             
             <div className="bg-emerald-600 p-8 rounded-3xl shadow-xl text-white">
                <div className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-1">Total Revenue (Period)</div>
                <div className="text-3xl font-black tracking-tight">{formatCurrency(stats.revenuePeriod)}</div>
                <div className="mt-4 flex items-center gap-2 text-emerald-100 font-bold text-xs">
                  <ShoppingBag size={14} /> {stats.bookingCount} Units Converted
                </div>
             </div>
          </div>

          <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
              <BarChart3 size={16} /> Lead Inventory Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Cold', val: stats.classification.cold, icon: Snowflake, color: 'text-blue-500' },
                { label: 'Warm/Prospect', val: stats.classification.prospect_warm, icon: Flame, color: 'text-orange-500' },
                { label: 'Booking', val: stats.classification.booking, icon: CheckCircle2, color: 'text-emerald-600' },
                { label: 'Junk', val: stats.classification.junk, icon: Trash2, color: 'text-slate-400' },
                { label: 'Drop', val: stats.classification.drop, icon: Ban, color: 'text-red-400' },
                { label: 'Others', val: stats.classification.unclassified, icon: HelpCircle, color: 'text-slate-300' },
              ].map(item => (
                <div key={item.label} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all">
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

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl overflow-hidden mt-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-800">Sales Effectiveness Ranking</h3>
            <div className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">Berdasarkan Konversi Visit & Booking</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Rank</th>
                  <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Agent Name</th>
                  <th className="py-4 px-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Unique Leads</th>
                  <th className="py-4 px-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Visit (%)</th>
                  <th className="py-4 px-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Bk/Vst (%)</th>
                  <th className="py-4 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.agentRanking.map((data, index) => {
                  const isTop3 = index < 3;
                  return (
                    <tr key={data.agent} className={`border-b border-slate-50 transition-colors hover:bg-slate-50/50 ${isTop3 ? 'bg-blue-50/10' : ''}`}>
                      <td className="py-5 px-4">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                          index === 0 ? 'bg-amber-400 text-white shadow-lg' : 
                          index === 1 ? 'bg-slate-300 text-slate-600' : 
                          index === 2 ? 'bg-amber-700/20 text-amber-900' : 
                          'bg-slate-50 text-slate-400'
                        }`}>#{index + 1}</div>
                      </td>
                      <td className="py-5 px-4">
                        <div className="font-bold text-slate-800 text-sm">{data.agent}</div>
                        <div className="flex gap-1 mt-1">
                          {data.agent === stats.topPerformance.visit && <span className="bg-blue-100 text-blue-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Top Opener</span>}
                          {data.agent === stats.topPerformance.booking && <span className="bg-emerald-100 text-emerald-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Top Closer</span>}
                        </div>
                      </td>
                      <td className="py-5 px-2 text-center text-sm font-bold text-slate-500">{data.uniqueCount}</td>
                      <td className="py-5 px-2 text-center">
                        <div className="text-sm font-black text-slate-700">{data.visitRate.toFixed(1)}%</div>
                        <div className="text-[10px] text-slate-400 font-bold">{data.visits} Visits</div>
                      </td>
                      <td className="py-5 px-2 text-center">
                        <div className="text-sm font-black text-emerald-600">{data.bookingFromVisitRate.toFixed(1)}%</div>
                        <div className="text-[10px] text-slate-400 font-bold">{data.bookings} Units</div>
                      </td>
                      <td className="py-5 px-4 text-right font-black text-slate-900 text-sm">{formatCurrency(data.revenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- SECTION 3: AI EXECUTIVE SUMMARY (THE CONCLUSION) --- */}
      <div className="space-y-6 pt-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg"><Sparkles size={20} /></div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">AI Executive Summary</h2>
          <div className="h-px flex-1 bg-slate-200 ml-4"></div>
        </div>

        <div className="bg-gradient-to-br from-indigo-950 to-blue-900 p-10 rounded-[3rem] text-white flex flex-col relative overflow-hidden shadow-2xl shadow-indigo-100 border border-white/10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full -mr-40 -mt-40 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
          
          <div className="flex items-center gap-5 mb-10 relative z-10">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
              <Sparkles className="text-blue-200" size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight leading-none">Strategic Insights</h3>
              <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mt-1.5">Kesimpulan Akhir & Rekomendasi AI</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto bg-black/20 backdrop-blur-sm rounded-[2rem] p-10 text-xl leading-relaxed relative z-10 scrollbar-hide text-blue-50/90 italic font-medium">
            {aiAnalysis}
          </div>
          
          <div className="mt-10 pt-8 border-t border-white/10 relative z-10 flex flex-wrap gap-6 text-[10px] font-black uppercase tracking-widest text-blue-300/60">
            <span className="flex items-center gap-2"><CheckCircle2 size={12} /> Campaign Journey Evaluated</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={12} /> Sales Velocity Verified</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={12} /> Target Revenue Tracked</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
