
# Leads Analyzer Pro - Google Sheets API Setup

Sistem ini mendukung pengambilan data langsung dari Google Sheets secara aman melalui Vercel Serverless Functions.

## Langkah Konfigurasi Google Cloud

1. **Google Cloud Console**:
   - Buka [Google Cloud Console](https://console.cloud.google.com/).
   - Buat project baru atau pilih project yang sudah ada.
   - Aktifkan **Google Sheets API**.

2. **Service Account**:
   - Buka menu **IAM & Admin > Service Accounts**.
   - Klik **Create Service Account**.
   - Beri nama (misal: `sheets-reader`) dan simpan.
   - Setelah dibuat, klik pada email Service Account tersebut, buka tab **Keys**.
   - Klik **Add Key > Create New Key > JSON**.
   - File JSON akan terunduh. **Simpan file ini dengan aman!**

3. **Share Spreadsheet**:
   - Buka Google Sheet yang ingin digunakan.
   - Klik tombol **Share**.
   - Masukkan email Service Account (yang berakhiran `@...gserviceaccount.com`).
   - Beri akses sebagai **Viewer**.

## Langkah Konfigurasi Vercel

1. Buka dashboard Vercel project Anda.
2. Masuk ke **Settings > Environment Variables**.
3. Tambahkan variable baru:
   - **Key**: `GOOGLE_SERVICE_ACCOUNT`
   - **Value**: Copy dan paste seluruh isi file JSON yang Anda unduh tadi (termasuk tanda kurung kurawal `{}`).
4. Pastikan juga `API_KEY` untuk Gemini sudah terpasang.
5. Klik **Save** dan lakukan **Redeploy**.

## Cara Penggunaan API

Endpoint tersedia di: `/api/sheets?sheetId=YOUR_SPREADSHEET_ID&range=Sheet1!A1:Z`

- `sheetId`: ID spreadsheet dari URL (string antara `/d/` dan `/edit`).
- `range`: Range data dalam notasi A1 (default: `Sheet1!A1:Z`).

Respon akan berupa JSON:
```json
{
  "headers": ["Cust ID", "Nama Leads", "Agent", "Assigned"],
  "rows": [
    ["101", "John Doe", "Agent A", "2024-01-20"],
    ["102", "Jane Smith", "Agent B", "2024-01-21"]
  ]
}
```
