
import { google } from 'googleapis';

/**
 * Serverless function to fetch data from Google Sheets securely.
 * Requires GOOGLE_SERVICE_ACCOUNT environment variable containing the Service Account JSON.
 * 
 * Query Parameters:
 * - sheetId: The Spreadsheet ID (found in URL)
 * - range: A1 notation range (e.g., 'Sheet1!A1:Z500')
 */
export default async function handler(req: any, res: any) {
  // Basic CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { sheetId, range = 'Sheet1!A1:Z' } = req.query;

  if (!sheetId) {
    return res.status(400).json({ 
      error: 'Parameter "sheetId" is required.' 
    });
  }

  try {
    const serviceAccountString = process.env.GOOGLE_SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
      console.error('Environment variable GOOGLE_SERVICE_ACCOUNT is missing.');
      return res.status(500).json({ 
        error: 'Server configuration error: Missing service account credentials.' 
      });
    }

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountString);
    } catch (parseErr) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT JSON:', parseErr);
      return res.status(500).json({ 
        error: 'Server configuration error: Invalid service account JSON format.' 
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
      return res.status(200).json({ 
        headers: [], 
        rows: [] 
      });
    }

    // Standard response format: Headers (first row) and Rows (rest)
    return res.status(200).json({
      headers: values[0],
      rows: values.slice(1),
    });
  } catch (error: any) {
    console.error('Google Sheets API Error:', error);
    return res.status(500).json({ 
      error: error.message || 'An internal error occurred while fetching sheet data.' 
    });
  }
}
