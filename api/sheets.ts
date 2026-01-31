
import { google } from 'googleapis';

export default async function handler(req: any, res: any) {
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
      credentials = typeof serviceAccountString === 'string' 
        ? JSON.parse(serviceAccountString.trim()) 
        : serviceAccountString;

      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (parseErr) {
      return res.status(500).json({ error: 'Format JSON Service Account tidak valid.' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Pecah range untuk mendapatkan nama sheet
    const sheetName = range.includes('!') ? range.split('!')[0] : 'New Assign Leads';
    
    // Gunakan batchGet untuk menarik Header (Baris 1) DAN Data (Range Kustom) sekaligus
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId as string,
      ranges: [
        `${sheetName}!A1:AF1`, // Selalu ambil header asli di baris 1
        range as string         // Ambil data sesuai permintaan user
      ],
    });

    const valueRanges = response.data.valueRanges;
    const headerValues = valueRanges?.[0]?.values?.[0] || [];
    let dataValues = valueRanges?.[1]?.values || [];

    // Jika user minta dari A1, maka baris pertama dataValues adalah header yang sama.
    // Kita buang baris pertama data jika itu adalah header (untuk menghindari duplikasi)
    if (range.includes('A1:') || range.endsWith('!A1')) {
      dataValues = dataValues.slice(1);
    }

    return res.status(200).json({
      headers: headerValues,
      rows: dataValues
    });
  } catch (error: any) {
    console.error('Google Sheets API Error:', error);
    const statusCode = error.code === 403 ? 403 : 500;
    return res.status(statusCode).json({ error: error.message });
  }
}
