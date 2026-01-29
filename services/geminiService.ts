
import { GoogleGenAI } from "@google/genai";

export const getAIInsights = async (stats: any) => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    console.error("API Key tidak terdeteksi di environment.");
    return "Gagal memuat analisis AI. API Key belum terkonfigurasi di server.";
  }

  if (!stats || !stats.funnel) {
    return "Data statistik belum lengkap untuk analisis.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const topSourceStr = stats.topSource?.source || 'Data source tidak tersedia';
    const topAgentName = stats.topAgent?.name || 'Tidak ada agent aktif';
    const topAgentBookings = stats.topAgent?.bookings || 0;
    const bookingRate = stats.funnel.raw > 0 ? (stats.funnel.booking / stats.funnel.raw * 100).toFixed(2) : 0;

    const prompt = `
      Anda adalah seorang Senior Real Estate Analyst. Analisis data penjualan properti berikut:
      - Total Leads: ${stats.funnel.raw}
      - Unique Leads: ${stats.funnel.unique}
      - Conversion rate Booking: ${bookingRate}%
      - Top Source: ${topSourceStr}
      - Top Agent: ${topAgentName} (Converted ${topAgentBookings} units)

      Berikan 3 poin insight strategis dalam Bahasa Indonesia yang singkat, padat, dan profesional untuk meningkatkan penjualan bulan depan.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Insight tidak dapat digenerate saat ini.";
  } catch (error: any) {
    console.error("AI Insights Error:", error);
    if (error.message?.includes("API key not valid")) {
      return "API Key yang dimasukkan tidak valid. Silakan cek kembali di Google AI Studio.";
    }
    return "Gagal menghubungkan ke AI. Silakan coba beberapa saat lagi.";
  }
};
