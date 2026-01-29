
import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LeadData, FunnelStats, LeadClassification } from '../types';
import { 
  Tooltip, ResponsiveContainer, Funnel, FunnelChart, LabelList,
  BarChart, Bar, XAxis, YAxis, TooltipProps
} from 'recharts';
import { 
  Calendar, Search, X, BarChart3, Info, TrendingUp, CloudOff, 
  ShoppingBag, Snowflake, Flame, Ban, Trash2, HelpCircle,
  Megaphone, Zap, CheckCircle2, Sparkles
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

    if (leadsInPeriod.length === 0 && (startDate || endDate)) {
      return { status: "NO_DATA" };
    }

    const rawCount = leadsInPeriod.length;
    const uniqueCount = leadsInPeriod.filter(l => 
      String(l.uniqueRawStatus).trim().toLowerCase() === 'unique'
    ).length;
    const visitedCount = leadsInPeriod.filter(l => l.tanggalSiteVisit !== null && String(l.statusSiteVisit || '').toLowerCase().includes('visit done')).length;
    const bookingCount = leadsInPeriod.filter(l => l.bookingDate !== null).length;

    // Source Journey Logic
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
      revenue: data.revenue
    })).sort((a, b) => b.leads - a.leads);

    const sourceVisitEffectiveness = [...sourceJourneyData].sort((a, b) => b.visit_rate - a.visit_rate);

    // Agent Ranking Logic
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
        if (l.bookingDate !== null) {
          current.bookings += 1;
          current.revenue += (l.revenueExclPpn || 0);
        }
        agentMap.set(agentName, current);
      }
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

    // Final Object Structure for both UI and AI
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
      sourceVisitEffectiveness,
      agentRanking,
      revenuePeriod: leadsInPeriod.filter(l => l.bookingDate !== null).reduce((s, l) => s + (l.revenueExclPpn || 0), 0),
      topSource: { source: sourceJourneyData[0]?.source || '---' },
      topAgent: { name: agentRanking[0]?.agent || '---', bookings: agentRanking[0]?.bookings || 0 },
      topPerformance: {
        visit: [...agentRanking].sort((a, b) => b.visitRate - a.visitRate)[0]?.agent,
        booking: [...agentRanking].sort((a, b) => b.bookingFromVisitRate - a.bookingFromVisitRate)[0]?.agent
      }
    };
  }, [leads, startDate, endDate]);

  useEffect(() => {
    if (stats && stats.status === "OK") {
      getAIInsights(stats).then(setAiAnalysis);
    }
  }, [stats]);

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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Leads Analyzer <span className="text-blue-600">Pro</span></h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mt-1"><Info size={12}/> Campaign & Sales Intelligence</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
          <Calendar size={18} className="text-blue-500 ml-2" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border-none rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
          <span className="text-slate-300">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border-none rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
        </div>
      </div>

      {/* Marketing Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg"><Megaphone size={20} /></div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Campaign Evaluation</h2>
          <div className="h-px flex-1 bg-slate-200 ml-4"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-l-4 border-l-blue-500">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Leads</div>
             <div className="text-3xl font-black text-slate-900">{stats.funnel.raw}</div>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-l-4 border-l-indigo-500">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unique Quality</div>
             <div className="text-3xl font-black text-slate-900">{stats.funnel.unique}</div>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-l-4 border-l-emerald-500">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visit Ratio</div>
             <div className="text-3xl font-black text-slate-900">{((stats.funnel.visited / (stats.funnel.unique || 1)) * 100).toFixed(1)}%</div>
           </div>
           <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white">
             <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Top Volume Source</div>
             <div className="text-lg font-black truncate">{stats.topSource.source}</div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2"><BarChart3 size={16}/> Volume Breakdown</h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.sourceJourneyData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="source" width={120} tick={{fontSize: 10, fontWeight: 700}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="leads" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={20}>
                    <LabelList dataKey="leads" position="right" formatter={(v: any) => `${v} Leads`} style={{fontSize: 10, fontWeight: 800}} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2 text-emerald-600"><Zap size={16}/> Source to Visit Quality</h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.sourceVisitEffectiveness.slice(0, 10)} layout="vertical" margin={{ right: 80 }}>
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis type="category" dataKey="source" width={120} tick={{fontSize: 10, fontWeight: 700}} axisLine={false} tickLine={false} />
                  <Bar dataKey="visit_rate" fill="#10b981" radius={[0, 8, 8, 0]} barSize={20}>
                    <LabelList 
                      dataKey="visit_rate" 
                      position="right" 
                      content={(props: any) => {
                        const { x, y, width, value, index } = props;
                        const visitCount = stats.sourceVisitEffectiveness[index]?.visits;
                        return (
                          <text x={x + width + 5} y={y + 14} fill="#065f46" fontSize={10} fontWeight={800}>
                            {`${Number(value).toFixed(1)}% (${visitCount} Vst)`}
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

      {/* Sales Section */}
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
                <div className="mt-4 flex items-center gap-2 text-emerald-100 font-bold text-xs"><ShoppingBag size={14}/> {stats.funnel.booking} Units Converted</div>
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

        {/* Agent Table */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl overflow-hidden mt-8">
           <h3 className="text-xl font-bold text-slate-800 mb-8">Sales Effectiveness Ranking</h3>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead>
                 <tr className="border-b border-slate-100">
                   <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Rank</th>
                   <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Agent Name</th>
                   <th className="py-4 px-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Visit (%)</th>
                   <th className="py-4 px-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Bk/Vst (%)</th>
                   <th className="py-4 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Revenue</th>
                 </tr>
               </thead>
               <tbody>
                 {stats.agentRanking.map((data, index) => (
                   <tr key={data.agent} className={`border-b border-slate-50 hover:bg-slate-50/50 ${index < 3 ? 'bg-blue-50/10' : ''}`}>
                     <td className="py-5 px-4">
                       <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black">#{index + 1}</div>
                     </td>
                     <td className="py-5 px-4">
                       <div className="font-bold text-slate-800 text-sm">{data.agent}</div>
                       <div className="flex gap-1 mt-1">
                         {data.agent === stats.topPerformance.visit && <span className="bg-blue-100 text-blue-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Top Opener</span>}
                         {data.agent === stats.topPerformance.booking && <span className="bg-emerald-100 text-emerald-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Top Closer</span>}
                       </div>
                     </td>
                     <td className="py-5 px-2 text-center">
                       <div className="text-sm font-black text-slate-700">{data.visitRate.toFixed(1)}%</div>
                       <div className="text-[10px] text-slate-400 font-bold">{data.visits} Vst</div>
                     </td>
                     <td className="py-5 px-2 text-center">
                       <div className="text-sm font-black text-emerald-600">{data.bookingFromVisitRate.toFixed(1)}%</div>
                       <div className="text-[10px] text-slate-400 font-bold">{data.bookings} Bk</div>
                     </td>
                     <td className="py-5 px-4 text-right font-black text-slate-900 text-sm">{formatCurrency(data.revenue)}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>

      {/* AI Summary - Di Paling Akhir */}
      <div className="space-y-6 pt-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg"><Sparkles size={20} /></div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">AI Executive Summary</h2>
          <div className="h-px flex-1 bg-slate-200 ml-4"></div>
        </div>

        <div className="bg-gradient-to-br from-indigo-950 to-blue-900 p-10 rounded-[3rem] text-white flex flex-col relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full -mr-40 -mt-40 blur-3xl"></div>
          <div className="flex items-center gap-5 mb-10 relative z-10">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
              <Sparkles className="text-blue-200" size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight leading-none">Strategic Insights</h3>
              <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mt-1.5">Rekomendasi Berbasis AI</p>
            </div>
          </div>
          <div className="flex-1 bg-black/20 backdrop-blur-sm rounded-[2rem] p-10 text-xl leading-relaxed relative z-10 text-blue-50/90 italic font-medium whitespace-pre-wrap">
            {aiAnalysis}
          </div>
          <div className="mt-10 pt-8 border-t border-white/10 relative z-10 flex flex-wrap gap-6 text-[10px] font-black uppercase tracking-widest text-blue-300/60">
            <span className="flex items-center gap-2"><CheckCircle2 size={12}/> Journey Evaluated</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={12}/> Performance Scored</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
