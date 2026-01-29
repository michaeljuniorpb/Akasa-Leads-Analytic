
import React, { useState, useEffect } from 'react';
// Corrected imports for react-router-dom v6
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { LayoutDashboard, FileUp, TrendingUp, Loader2, AlertCircle, Trash2, AlertTriangle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import UploadPage from './components/UploadPage';
import { LeadData } from './types';
import { fetchLeadsFromCloud, deleteAllLeads } from './services/firebaseService';

const App: React.FC = () => {
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const cloudData = await fetchLeadsFromCloud();
      setLeads(cloudData);
      setHasError(false);
    } catch (error) {
      console.error("Failed to load data:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleDataLoaded = (data: LeadData[]) => {
    loadInitialData();
  };

  const handleResetData = async () => {
    // Jika belum dalam mode konfirmasi, aktifkan konfirmasi dulu
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Reset konfirmasi otomatis setelah 5 detik jika tidak diklik lagi
      setTimeout(() => setConfirmDelete(false), 5000);
      return;
    }

    setIsDeleting(true);
    setConfirmDelete(false);
    console.log("Reset data triggered...");
    
    try {
      await deleteAllLeads();
      setLeads([]); 
      alert("Database Berhasil Dikosongkan!");
    } catch (err: any) {
      console.error("Reset Data Error:", err);
      alert(err.message || "Gagal menghapus data. Silakan cek konsol browser (F12) untuk detail.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <HashRouter>
      <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
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
            
            <div className="mt-auto pt-4 space-y-2">
              {confirmDelete && (
                <div className="px-4 py-2 bg-red-50 rounded-lg border border-red-100 mb-2 animate-pulse">
                  <p className="text-[10px] text-red-600 font-bold uppercase leading-tight">Klik sekali lagi untuk menghapus permanen!</p>
                </div>
              )}
              <button 
                onClick={handleResetData}
                disabled={isDeleting}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all whitespace-nowrap font-medium border ${
                  isDeleting 
                    ? 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed' 
                    : confirmDelete 
                      ? 'bg-red-600 text-white border-red-700 shadow-lg scale-105' 
                      : 'text-red-500 hover:bg-red-50 border-transparent'
                }`}
              >
                {isDeleting ? <Loader2 size={20} className="animate-spin" /> : confirmDelete ? <AlertTriangle size={20} /> : <Trash2 size={20} />}
                {isDeleting ? 'Menghapus...' : confirmDelete ? 'YA, HAPUS SEMUA' : 'Clean Slate'}
              </button>
            </div>
          </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-y-auto max-h-screen">
          <div className="p-4 md:p-8">
            {isLoading ? (
              <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-blue-600" size={48} />
                <p className="text-slate-500 font-medium">Sinkronisasi data...</p>
              </div>
            ) : hasError ? (
              <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
                <AlertCircle className="text-red-500" size={48} />
                <h2 className="text-xl font-bold text-slate-800">Gagal Memuat Data</h2>
                <button onClick={loadInitialData} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Coba Lagi</button>
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
    </HashRouter>
  );
};

export default App;
