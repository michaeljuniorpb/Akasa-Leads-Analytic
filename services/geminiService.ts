
import { GoogleGenAI } from "@google/genai";

// Function to generate strategic insights using Gemini API
export const getAIInsights = async (stats: any) => {
  // Assume process.env.API_KEY is pre-configured and valid
  if (!stats || !stats.funnel) {
    return "Data statistik belum lengkap untuk analisis.";
  }

  try {
    // Initialize GenAI client with named parameter and direct environment key access
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Safety check for properties
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

    // Use gemini-3-pro-preview for complex reasoning tasks as per task type guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });

    // Access the .text property directly (not as a method call) from the response
    return response.text || "Insight tidak dapat digenerate saat ini.";
  } catch (error) {
    console.error("AI Insights Error:", error);
    return "Gagal memuat analisis AI. Pastikan API Key valid.";
  }
};
