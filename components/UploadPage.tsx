
import React, { useState } from 'react';
import { Upload, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, Loader2, Cloud, Database } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { mapRawToLead } from '../services/dataProcessor';
import { saveLeadsToCloud } from '../services/firebaseService';
import { LeadData } from '../types';
import { useNavigate } from 'react-router-dom';

interface Props {
  onDataLoaded: (data: LeadData[]) => void;
}

const UploadPage: React.FC<Props> = ({ onDataLoaded }) => {
  const [sourceMode, setSourceMode] = useState<'file' | 'sheets'>('file');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [sheetId, setSheetId] = useState('');
  const [range, setRange] = useState('Sheet1!A1:Z');
  const navigate = useNavigate();

  const processData = async (rawRows: any[]) => {
    try {
      if (!rawRows || rawRows.length === 0) {
         setError('Data kosong atau tidak terbaca.');
         setLoading(false);
         return;
      }

      setSyncStatus('Memetakan kolom data...');
      const mapped = rawRows.map(mapRawToLead);
      
      setSyncStatus('Menyimpan ke Cloud Firestore...');
      await saveLeadsToCloud(mapped);
      
      onDataLoaded(mapped);
      setSuccess(true);
      setSyncStatus('Selesai!');
      setTimeout(() => navigate('/'), 1200);
    } catch (err: any) {
      console.error("Processing error:", err);
      setError(err.message || 'Gagal sinkronisasi data.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(false);
    setSyncStatus('Membaca file...');

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data),
        error: (err) => {
          console.error("PapaParse error:", err);
          setError('Gagal membaca file CSV.');
          setLoading(false);
        }
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          processData(data);
        } catch (err) {
          console.error("XLSX error:", err);
          setError('Gagal memproses file Excel.');
          setLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setError('Format tidak didukung. Gunakan .csv atau .xlsx');
      setLoading(false);
    }
  };

  const handleSheetsPull = async () => {
    if (!sheetId.trim()) {
      setError('Masukkan Spreadsheet ID terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setSyncStatus('Menghubungkan ke Google Sheets API...');

    try {
      const response = await fetch(`/api/sheets?sheetId=${sheetId}&range=${range}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengambil data dari Google Sheets.');
      }

      const { headers, rows } = data;
      
      if (!headers || headers.length === 0) {
        throw new Error('Tidak ada header ditemukan di sheet tersebut.');
      }

      setSyncStatus(`Memproses ${rows.length} baris data...`);
      
      // Convert raw rows array to objects with header keys
      const dataObjects = rows.map((row: any[]) => {
        const obj: any = {};
        headers.forEach((h: string, i: number) => {
          obj[h] = row[i];
        });
        return obj;
      });

      // Save credentials to localStorage for refresh later
      localStorage.setItem('gsheet_id', sheetId);
      localStorage.setItem('gsheet_range', range);

      await processData(dataObjects);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 px-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Cloud size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Ingestion Center</h2>
            <p className="text-slate-500 text-sm">Pilih sumber data untuk dianalisis oleh sistem.</p>
          </div>

          <div className="flex p-1 bg-slate-100 rounded-xl mb-8">
            <button 
              onClick={() => setSourceMode('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${sourceMode === 'file' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              <FileSpreadsheet size={18} />
              File Upload
            </button>
            <button 
              onClick={() => setSourceMode('sheets')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${sourceMode === 'sheets' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
            >
              <Database size={18} />
              Google Sheets
            </button>
          </div>

          {sourceMode === 'file' ? (
            <div className="relative group">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={loading}
              />
              <div className={`border-2 border-dashed rounded-2xl p-16 transition-all flex flex-col items-center justify-center gap-4 ${
                loading ? 'bg-slate-50 border-slate-200' : 
                success ? 'bg-green-50 border-green-200' :
                'bg-slate-50 border-slate-300 group-hover:border-blue-400 group-hover:bg-blue-50'
              }`}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                    <span className="font-bold text-slate-600 text-sm">{syncStatus}</span>
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 className="text-green-600" size={40} />
                    <span className="font-bold text-green-700">Berhasil!</span>
                  </>
                ) : (
                  <>
                    <Upload className="text-slate-400 group-hover:text-blue-500 transition-colors" size={40} />
                    <div className="text-sm font-black text-slate-700 uppercase tracking-tight">Klik atau Drop File</div>
                    <p className="text-xs text-slate-400 font-medium">CSV atau Excel (.xlsx)</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Spreadsheet ID</label>
                <input 
                  type="text" 
                  value={sheetId}
                  onChange={e => setSheetId(e.target.value)}
                  placeholder="Contoh: 1BxiMVs0XRA5nFMdKvBdBAngmUUla-f..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Data Range (A1 Notation)</label>
                <input 
                  type="text" 
                  value={range}
                  onChange={e => setRange(e.target.value)}
                  placeholder="Sheet1!A1:Z"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                />
              </div>
              <button 
                onClick={handleSheetsPull}
                disabled={loading}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs shadow-lg transition-all ${
                  loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                }`}
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Cloud size={20} />}
                {loading ? syncStatus : 'Tarik & Sinkronkan Data'}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium animate-shake">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
