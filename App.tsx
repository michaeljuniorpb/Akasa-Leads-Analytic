
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LayoutDashboard, FileUp, TrendingUp, Loader2 } from 'lucide-react';
import Dashboard from './components/Dashboard';
import UploadPage from './components/UploadPage';
import { LeadData } from './types';
import { fetchLeadsFromCloud } from './services/firebaseService';

const App: React.FC = () => {
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const cloudData = await fetchLeadsFromCloud();
        setLeads(cloudData);
      } catch (error) {
        console.error("Failed to load data from Firebase:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const handleDataLoaded = (data: LeadData[]) => {
    // Append new data to existing list
    setLeads(prev => [...data, ...prev]);
  };

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
          <div className="p-6 border-b border-slate-100">
            <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
              <TrendingUp size={24} />
              LeadAnalytica
            </h1>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link to="/" className="flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
              <LayoutDashboard size={20} />
              Dashboard
            </Link>
            <Link to="/upload" className="flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
              <FileUp size={20} />
              Upload Data
            </Link>
          </nav>
          <div className="p-4 border-t border-slate-100">
            <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
              <p className="font-semibold mb-1">Cloud Sync Active</p>
              <p>Data tersimpan otomatis di Firebase Cloud.</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-auto">
          {/* Header Mobile */}
          <header className="md:hidden bg-white p-4 border-b flex justify-between items-center">
             <h1 className="text-lg font-bold text-blue-600 flex items-center gap-2">
              <TrendingUp size={20} />
              Analytica
            </h1>
            <nav className="flex gap-4">
              <Link to="/"><LayoutDashboard size={20} className="text-slate-600" /></Link>
              <Link to="/upload"><FileUp size={20} className="text-slate-600" /></Link>
            </nav>
          </header>

          <div className="p-4 md:p-8">
            {isLoading ? (
              <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-blue-600" size={48} />
                <p className="text-slate-500 font-medium">Menghubungkan ke Cloud...</p>
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
