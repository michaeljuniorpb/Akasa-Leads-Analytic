
import { google } from 'googleapis';

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { sheetId, range = 'New Assign Leads!A1:AF' } = req.query;

  if (!sheetId) {
    return res.status(400).json({ error: 'Parameter "sheetId" diperlukan.' });
  }

  try {
    const serviceAccountString = process.env.GOOGLE_SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
      return res.status(500).json({ 
        error: 'GOOGLE_SERVICE_ACCOUNT tidak ditemukan di Environment Variables.' 
      });
    }

    let credentials;
    try {
      // Jika sudah berupa objek, gunakan langsung, jika string, parse ke JSON
      credentials = typeof serviceAccountString === 'string' 
        ? JSON.parse(serviceAccountString.trim()) 
        : serviceAccountString;

      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (parseErr) {
      return res.status(500).json({ 
        error: 'Format JSON Service Account tidak valid.' 
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

    // Pastikan respon selalu JSON yang bersih
    return res.status(200).json({
      headers: values && values.length > 0 ? values[0] : [],
      rows: values && values.length > 1 ? values.slice(1) : [],
    });
  } catch (error: any) {
    console.error('Google Sheets API Error:', error);
    
    const statusCode = error.code === 403 ? 403 : 500;
    const message = error.code === 403 
      ? 'Akses Ditolak: Email Service Account belum di-Share di Google Sheets ini.' 
      : `Google API Error: ${error.message}`;
    
    return res.status(statusCode).json({ error: message });
  }
}
