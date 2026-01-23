
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LayoutDashboard, FileUp, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import UploadPage from './components/UploadPage';
import { LeadData } from './types';
import { fetchLeadsFromCloud } from './services/firebaseService';

const App: React.FC = () => {
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const cloudData = await fetchLeadsFromCloud();
        setLeads(cloudData);
      } catch (error) {
        console.error("Failed to load data:", error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const handleDataLoaded = (data: LeadData[]) => {
    setLeads(prev => [...data, ...prev]);
  };

  return (
    <Router>
      <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
              <TrendingUp size={24} />
              LeadAnalytica
            </h1>
          </div>
          <nav className="flex-1 p-4 space-y-1 flex md:flex-col overflow-x-auto md:overflow-x-visible">
            <Link to="/" className="flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors whitespace-nowrap">
              <LayoutDashboard size={20} />
              Dashboard
            </Link>
            <Link to="/upload" className="flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors whitespace-nowrap">
              <FileUp size={20} />
              Upload Data
            </Link>
          </nav>
          <div className="hidden md:block p-4 border-t border-slate-100">
            <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
              <p className="font-semibold mb-1">Status: Online</p>
              <p>Sistem siap untuk deployment produksi.</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-y-auto max-h-screen">
          <div className="p-4 md:p-8">
            {isLoading ? (
              <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-blue-600" size={48} />
                <p className="text-slate-500 font-medium">Memuat data dari Cloud...</p>
              </div>
            ) : hasError ? (
              <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
                <AlertCircle className="text-red-500" size={48} />
                <h2 className="text-xl font-bold text-slate-800">Gagal Sinkronisasi</h2>
                <p className="text-slate-500">Koneksi ke database terhambat, tapi Anda tetap bisa mencoba upload data baru.</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Retry</button>
              </div>
            ) : (
              <Routes>
                <Route path="/" element={<Dashboard leads={leads} />} />
                <Route path="/upload" element={<UploadPage onDataLoaded={handleDataLoaded} />} />
              </Routes>
            )}
          </div>
        </main>
      </div>
    </Router>
  );
};

export default App;
