
import React, { useState } from 'react';
import { Upload, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, Loader2, Cloud } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const navigate = useNavigate();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(false);
    setSyncStatus('Membaca file...');

    const fileName = file.name.toLowerCase();
    
    const processData = async (rawRows: any[]) => {
      try {
        setSyncStatus('Memetakan kolom data...');
        const mapped = rawRows.map(mapRawToLead);
        
        setSyncStatus('Menyimpan ke Cloud Firestore...');
        await saveLeadsToCloud(mapped);
        
        onDataLoaded(mapped);
        setSuccess(true);
        setSyncStatus('Selesai!');
        setTimeout(() => navigate('/'), 1500);
      } catch (err) {
        console.error(err);
        setError('Gagal menyimpan data ke Cloud. Pastikan koneksi internet stabil.');
      } finally {
        setLoading(false);
      }
    };

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data),
        error: () => {
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
          setError('Gagal memproses file Excel.');
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setError('Gagal membaca file Excel.');
        setLoading(false);
      };
      reader.readAsBinaryString(file);
    } else {
      setError('Format file tidak didukung. Gunakan .csv atau .xlsx');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Cloud size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload & Sync</h2>
          <p className="text-slate-500 mb-8">
            Data yang diupload akan otomatis tersinkronisasi dengan database cloud<br/>
            untuk analisis tim secara real-time.
          </p>

          <div className="relative group">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={loading}
            />
            <div className={`border-2 border-dashed rounded-xl p-12 transition-all flex flex-col items-center justify-center gap-4 ${
              loading ? 'bg-slate-50 border-slate-200' : 
              success ? 'bg-green-50 border-green-200' :
              'bg-slate-50 border-slate-300 group-hover:border-blue-400 group-hover:bg-blue-50'
            }`}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin text-blue-600" size={40} />
                  <span className="font-medium text-slate-600">{syncStatus}</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="text-green-600" size={40} />
                  <span className="font-medium text-green-700">Berhasil Sinkron! Mengalihkan...</span>
                </>
              ) : (
                <>
                  <div className="flex gap-4">
                    <FileSpreadsheet className="text-green-600" size={32} />
                    <FileText className="text-blue-600" size={32} />
                  </div>
                  <div className="text-sm font-medium text-slate-700">
                    Klik atau tarik file CSV/Excel
                  </div>
                  <p className="text-xs text-slate-400">Database akan diperbarui di Cloud</p>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-600 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-8 py-6 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Informasi Sistem:</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Sistem menggunakan **Firebase Cloud Firestore** untuk penyimpanan. Pastikan kolom "Cust ID", "Agent", dan "Status leads" terisi dengan benar agar AI dapat memberikan analisis yang akurat.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
