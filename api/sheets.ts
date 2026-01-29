
import { google } from 'googleapis';

export default async function handler(req: any, res: any) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { sheetId, range = 'Sheet1!A1:Z' } = req.query;

  if (!sheetId) {
    return res.status(400).json({ error: 'Parameter "sheetId" diperlukan.' });
  }

  try {
    const serviceAccountString = process.env.GOOGLE_SERVICE_ACCOUNT;
    
    if (!serviceAccountString || serviceAccountString.trim() === "") {
      return res.status(500).json({ 
        error: 'Variabel GOOGLE_SERVICE_ACCOUNT tidak ditemukan. 1. Pastikan di Vercel namanya GOOGLE_SERVICE_ACCOUNT. 2. Pastikan sudah klik REDEPLOY setelah save.' 
      });
    }

    let credentials;
    try {
      // Pembersihan string otomatis
      let cleaned = serviceAccountString.trim();
      
      // Menangani kasus jika string ter-wrap kutip dua ekstra karena cara paste tertentu
      if (cleaned.startsWith('"') && cleaned.endsWith('"') && !cleaned.includes('\n')) {
         try {
           cleaned = JSON.parse(cleaned);
         } catch(e) {}
      }

      credentials = JSON.parse(cleaned);
      
      // Memperbaiki Private Key agar newline (\n) terbaca benar oleh library Google
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (parseErr: any) {
      return res.status(500).json({ 
        error: `Format JSON tidak valid. Pastikan Anda meng-copy seluruh isi file JSON dari { sampai }. Error: ${parseErr.message}` 
      });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId as string,
      range: range as string,
    });

    const values = response.data.values;

    if (!values || values.length === 0) {
      return res.status(200).json({ headers: [], rows: [] });
    }

    return res.status(200).json({
      headers: values[0],
      rows: values.slice(1),
    });
  } catch (error: any) {
    console.error('Google Sheets API Error:', error);
    
    if (error.code === 403) {
      return res.status(403).json({ 
        error: 'Akses Ditolak (403): Email Service Account (ada di dalam file JSON) belum di-invite ke Google Sheet. Klik tombol Share di Google Sheet Anda dan masukkan email tersebut sebagai Viewer.' 
      });
    }

    return res.status(500).json({ 
      error: `Gagal menarik data: ${error.message}` 
    });
  }
}
