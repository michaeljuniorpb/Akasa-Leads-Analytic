
import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Cloud, Database } from 'lucide-react';
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
  
  const [sheetId, setSheetId] = useState(localStorage.getItem('gsheet_id') || '1N_As68ZpxsDnJuxojt6Z_li65ZL918pXvyl0F_B53Tw');
  const [range, setRange] = useState(localStorage.getItem('gsheet_range') || 'New Assign Leads!A1:AF');
  
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

  const handleSheetsPull = async () => {
    if (!sheetId.trim()) {
      setError('Masukkan Spreadsheet ID terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setSyncStatus('Menghubungkan ke API...');

    try {
      const response = await fetch(`/api/sheets?sheetId=${sheetId}&range=${encodeURIComponent(range)}`);
      const responseText = await response.text();
      
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        await handleFallbackPull();
        return;
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        await handleFallbackPull();
        return;
      }

      if (!response.ok) throw new Error(data.error || 'Gagal mengambil data.');

      const { headers, rows } = data;
      const dataObjects = rows.map((row: any[]) => {
        const obj: any = {};
        // Gunakan headers yang sudah dijamin baris 1 oleh API baru kita
        headers.forEach((h: string, i: number) => { if(h) obj[h] = row[i]; });
        return obj;
      });

      localStorage.setItem('gsheet_id', sheetId);
      localStorage.setItem('gsheet_range', range);
      await processData(dataObjects);
    } catch (err: any) {
      await handleFallbackPull();
    }
  };

  const handleFallbackPull = async () => {
    setSyncStatus('Menarik data (Mode Fallback)...');
    try {
      const sheetName = range.includes('!') ? range.split('!')[0] : '';
      
      // Untuk fallback CSV, jika user pakai range kustom, kita harus ambil header baris 1 dulu
      const headerUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : ''}&range=A1:AF1`;
      const dataUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : ''}&range=${encodeURIComponent(range)}`;

      const [hRes, dRes] = await Promise.all([fetch(headerUrl), fetch(dataUrl)]);
      if (!hRes.ok || !dRes.ok) throw new Error('Akses ditolak. Pastikan Sheet "Anyone with link can view".');
      
      const hCsv = await hRes.text();
      const dCsv = await dRes.text();
      
      const headers = Papa.parse(hCsv).data[0] as string[];
      let dataRows = Papa.parse(dCsv).data as any[][];

      // Hilangkan header dari dataRows jika range-nya mulai dari A1
      if (range.includes('A1:') || range.endsWith('!A1')) {
        dataRows = dataRows.slice(1);
      }

      const dataObjects = dataRows.filter(row => row.length > 0).map(row => {
        const obj: any = {};
        headers.forEach((h, i) => { if(h) obj[h] = row[i]; });
        return obj;
      });

      localStorage.setItem('gsheet_id', sheetId);
      localStorage.setItem('gsheet_range', range);
      await processData(dataObjects);
    } catch (err: any) {
      setError('Sinkronisasi Gagal. Harap set akses Sheet menjadi "Anyone with the link can view" untuk mode ini.');
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
        error: () => { setError('Gagal membaca file CSV.'); setLoading(false); }
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          processData(data);
        } catch (err) { setError('Gagal memproses file Excel.'); setLoading(false); }
      };
      reader.readAsBinaryString(file);
    } else {
      setError('Format file tidak didukung.');
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
            <p className="text-slate-500 text-sm">Pilih sumber data untuk dianalisis.</p>
          </div>

          <div className="flex p-1 bg-slate-100 rounded-xl mb-8">
            <button onClick={() => setSourceMode('file')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${sourceMode === 'file' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><FileSpreadsheet size={18} />File Upload</button>
            <button onClick={() => setSourceMode('sheets')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${sourceMode === 'sheets' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}><Database size={18} />Google Sheets</button>
          </div>

          {sourceMode === 'file' ? (
            <div className="relative group">
              <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={loading} />
              <div className={`border-2 border-dashed rounded-2xl p-16 transition-all flex flex-col items-center justify-center gap-4 ${loading ? 'bg-slate-50 border-slate-200' : success ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-300 group-hover:border-blue-400 group-hover:bg-blue-50'}`}>
                {loading ? <><Loader2 className="animate-spin text-blue-600" size={40} /><span className="font-bold text-slate-600 text-sm">{syncStatus}</span></> : success ? <><CheckCircle2 className="text-green-600" size={40} /><span className="font-bold text-green-700">Berhasil!</span></> : <><Upload className="text-slate-400 group-hover:text-blue-500" size={40} /><div className="text-sm font-black text-slate-700 uppercase">Klik atau Drop File</div></>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Spreadsheet ID</label>
                <input type="text" value={sheetId} onChange={e => setSheetId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Data Range</label>
                <input type="text" placeholder="Contoh: A7000:AF" value={range} onChange={e => setRange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium" />
              </div>
              <button onClick={handleSheetsPull} disabled={loading} className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs shadow-lg transition-all ${loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'}`}>
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Cloud size={20} />}
                {loading ? syncStatus : 'Tarik & Sinkronkan Data'}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm font-medium">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="break-words w-full">{error}</div>
            </div>
          )}
          
          <div className="mt-8 p-4 bg-blue-50 rounded-xl text-[11px] text-blue-700 leading-relaxed border border-blue-100">
            <p className="font-bold mb-1 uppercase tracking-wider">Tips Baris Banyak:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Jika data Anda 10.000+ baris, gunakan range seperti <strong>A7000:AF</strong> untuk menarik data terbaru.</li>
              <li>Sistem tetap akan menggunakan baris 1 sebagai nama kolom secara otomatis.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
