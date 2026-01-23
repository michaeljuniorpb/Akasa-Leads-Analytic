
import { GoogleGenAI } from "@google/genai";

export const getAIInsights = async (stats: any) => {
  // Vite menggunakan import.meta.env untuk environment variables
  // Pastikan di Vercel Anda menambahkan variable bernama VITE_API_KEY
  // Atau jika menggunakan sistem sandbox ini, tetap gunakan process.env
  const apiKey = (import.meta as any).env?.VITE_API_KEY || (typeof process !== 'undefined' ? process.env.API_KEY : null);

  if (!apiKey) {
    return "AI Insights belum aktif. Silakan tambahkan API Key di Environment Variables.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Anda adalah seorang Senior Real Estate Analyst. Analisis data penjualan properti berikut:
      - Total Leads: ${stats.funnel.raw}
      - Unique Leads: ${stats.funnel.unique}
      - Conversion rate Booking: ${(stats.funnel.booking / stats.funnel.raw * 100).toFixed(2)}%
      - Top Source: ${stats.topSource.source}
      - Top Agent: ${stats.topAgent?.name || 'Unknown'} (Converted ${stats.topAgent?.bookings || 0} units)

      Berikan 3 poin insight strategis dalam Bahasa Indonesia yang singkat, padat, dan profesional untuk meningkatkan penjualan bulan depan.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Insight tidak dapat digenerate saat ini.";
  } catch (error) {
    console.error("AI Insights Error:", error);
    return "Gagal memuat analisis AI. Pastikan API Key valid.";
  }
};
