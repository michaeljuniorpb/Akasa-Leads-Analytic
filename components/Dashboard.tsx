
import React, { useMemo, useState, useEffect } from 'react';
import { LeadData, FunnelStats, AgentPerformance, SourceStats } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart as RePieChart, Pie, Cell, Funnel, FunnelChart, LabelList, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, Target, CheckCircle2, Sparkles, Filter, 
  ChevronRight, Calendar, ArrowUpRight, ArrowDownRight, UserCheck
} from 'lucide-react';
import { getAIInsights } from '../services/geminiService';

interface Props {
  leads: LeadData[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const Dashboard: React.FC<Props> = ({ leads }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>('Menganalisis data...');

  const stats = useMemo(() => {
    if (leads.length === 0) return null;

    // 1. Funnel Calculation
    const funnel: FunnelStats = {
      raw: leads.length,
      unique: leads.filter(l => l.unique).length,
      qualified: leads.filter(l => ['Qualified', 'Hot', 'Interested'].includes(l.statusLeads)).length,
      prospect: leads.filter(l => l.statusLeads.includes('Prospect') || l.statusLeads.includes('Warm')).length,
      visited: leads.filter(l => l.tanggalSiteVisit !== null).length,
      booking: leads.filter(l => l.bookingDate !== null).length,
    };

    // 2. Source Analysis
    const sourceMap = new Map<string, { count: number; bookings: number }>();
    leads.forEach(l => {
      const s = l.source || 'Others';
      const current = sourceMap.get(s) || { count: 0, bookings: 0 };
      sourceMap.set(s, {
        count: current.count + 1,
        bookings: current.bookings + (l.bookingDate ? 1 : 0)
      });
    });

    const sources: SourceStats[] = Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      count: data.count,
      percentage: (data.count / leads.length) * 100,
      effectiveness: data.count > 0 ? (data.bookings / data.count) * 100 : 0
    })).sort((a, b) => b.count - a.count);

    // 3. Agent Performance
    const agentMap = new Map<string, AgentPerformance>();
    leads.forEach(l => {
      const a = l.agent || 'Unassigned';
      const current = agentMap.get(a) || { 
        name: a, leads: 0, visits: 0, bookings: 0, conversionRate: 0, revenue: 0 
      };
      
      current.leads += 1;
      if (l.tanggalSiteVisit) current.visits += 1;
      if (l.bookingDate) {
        current.bookings += 1;
        current.revenue += l.revenue;
      }
      current.conversionRate = (current.bookings / current.leads) * 100;
      agentMap.set(a, current);
    });

    const agents = Array.from(agentMap.values()).sort((a, b) => b.bookings - a.bookings);

    return {
      funnel,
      sources,
      agents,
      totalRevenue: leads.reduce((acc, curr) => acc + (curr.revenue || 0), 0),
      topAgent: agents[0],
      topSource: sources[0]
    };
  }, [leads]);

  useEffect(() => {
    if (stats) {
      getAIInsights(stats).then(setAiAnalysis);
    }
  }, [stats]);

  if (leads.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-6">
          <Users size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Belum ada data diupload</h2>
        <p className="text-slate-500 mb-6">Upload file CSV atau Excel Anda untuk mulai menganalisis performa penjualan.</p>
        <a href="#/upload" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
          Upload Sekarang
        </a>
      </div>
    );
  }

  if (!stats) return null;

  const funnelData = [
    { value: stats.funnel.raw, name: 'Raw Leads', fill: '#94a3b8' },
    { value: stats.funnel.unique, name: 'Unique', fill: '#64748b' },
    { value: stats.funnel.qualified, name: 'Qualified', fill: '#3b82f6' },
    { value: stats.funnel.prospect, name: 'Prospect', fill: '#2563eb' },
    { value: stats.funnel.visited, name: 'Visited', fill: '#1d4ed8' },
    { value: stats.funnel.booking, name: 'Booking', fill: '#1e40af' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ringkasan Eksekutif</h1>
          <p className="text-slate-500">Menganalisis total {leads.length} leads dari berbagai sumber.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600">
            <Calendar size={16} />
            All Time
          </div>
          <button className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={20} /></div>
            <div className="flex items-center gap-1 text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-full">
              <ArrowUpRight size={12} />
              12%
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-1">Total Leads (Raw)</p>
          <h3 className="text-2xl font-bold text-slate-800">{stats.funnel.raw}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Target size={20} /></div>
            <div className="flex items-center gap-1 text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-full">
              <ArrowUpRight size={12} />
              8%
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-1">Unique Leads</p>
          <h3 className="text-2xl font-bold text-slate-800">{stats.funnel.unique}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle2 size={20} /></div>
            <div className="flex items-center gap-1 text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-full">
              <ArrowUpRight size={12} />
              5%
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-1">Conversion Booking</p>
          <h3 className="text-2xl font-bold text-slate-800">{stats.funnel.booking}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><TrendingUp size={20} /></div>
            <div className="flex items-center gap-1 text-red-600 text-xs font-medium bg-red-50 px-2 py-1 rounded-full">
              <ArrowDownRight size={12} />
              2%
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-1">Total Est. Revenue</p>
          <h3 className="text-2xl font-bold text-slate-800">
            Rp {(stats.totalRevenue / 1000000).toFixed(0)}M
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Funnel Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Sales Funnel Analysis</h3>
            <div className="p-2 bg-slate-50 rounded-lg cursor-pointer"><Filter size={18} className="text-slate-400" /></div>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                   formatter={(value: any) => [`${value} Leads`, 'Total']}
                />
                <Funnel
                  dataKey="value"
                  data={funnelData}
                  isAnimationActive
                >
                  <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insights Panel */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl text-white shadow-xl flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="animate-pulse" size={24} />
            <h3 className="text-lg font-bold">AI Business Insights</h3>
          </div>
          <div className="flex-1 overflow-auto bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/20 whitespace-pre-line text-sm leading-relaxed">
            {aiAnalysis}
          </div>
          <button className="mt-4 w-full py-2 bg-white text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
            Minta Strategi Baru
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Source Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Efektivitas Sumber Iklan</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={stats.sources.slice(0, 6)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="source"
                >
                  {stats.sources.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {stats.sources.slice(0, 4).map((source, i) => (
              <div key={source.source} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <div className="flex-1">
                  <div className="flex justify-between text-xs font-medium text-slate-600">
                    <span>{source.source}</span>
                    <span>{source.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                    <div className="h-full rounded-full" style={{ width: `${source.percentage}%`, backgroundColor: COLORS[i] }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Agents */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Performa Sales Terbaik</h3>
          <div className="space-y-4">
            {stats.agents.slice(0, 5).map((agent, i) => (
              <div key={agent.name} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors group">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-slate-800">{agent.name}</h4>
                    <span className="text-xs font-bold text-green-600">{agent.bookings} Bookings</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Users size={12} /> {agent.leads} Leads</span>
                    <span className="flex items-center gap-1"><UserCheck size={12} /> {(agent.visits / agent.leads * 100).toFixed(0)}% Visit Rate</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-700">{agent.conversionRate.toFixed(1)}%</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Conv. Rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
