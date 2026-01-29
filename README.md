
# Leads Analyzer Pro - Google Sheets API Setup

Sistem ini mendukung pengambilan data langsung dari Google Sheets secara aman melalui Vercel Serverless Functions.

## 🛠 Langkah Konfigurasi Google Cloud (Service Account)

1. **Google Cloud Console**: Aktifkan **Google Sheets API**.
2. **Service Account**: Buat Service Account baru, unduh file **JSON Key**.
3. **PENTING: Invite Email**:
   - Buka file JSON yang Anda unduh.
   - Cari baris `"client_email": "nama-akun@project.iam.gserviceaccount.com"`.
   - Buka Google Sheet target Anda, klik **Share**, lalu masukkan email tersebut sebagai **Viewer**.

## 🚀 Langkah Konfigurasi Vercel (Mengatasi Masalah Enter/Newline)

1. Buka dashboard Vercel -> **Settings** -> **Environment Variables**.
2. Tambahkan variable:
   - **Key**: `GOOGLE_SERVICE_ACCOUNT`
   - **Value**: 
     - Buka file JSON Key pakai Notepad atau Text Editor.
     - **Select All (Ctrl+A)** lalu **Copy (Ctrl+C)**.
     - Langsung **Paste (Ctrl+V)** ke kotak "Value" di Vercel. 
     - **Jangan edit apapun**, biarkan dia tetap berantakan/ada enter. Vercel akan menyimpannya dengan benar.
3. Klik **Save**.
4. **WAJIB REDEPLOY**:
   - Pergi ke tab **Deployments**.
   - Klik titik tiga `...` pada deployment terbaru Anda.
   - Pilih **Redeploy**. (Tanpa redeploy, variable baru tidak akan terbaca oleh fungsi API).

## 🔍 Cara Cek Jika Masih Error
Jika muncul pesan `Missing service account credentials`:
1. Cek apakah nama variablenya sudah tepat `GOOGLE_SERVICE_ACCOUNT` (semua huruf besar).
2. Cek apakah Anda sudah klik **Redeploy** setelah menyimpan variable.
