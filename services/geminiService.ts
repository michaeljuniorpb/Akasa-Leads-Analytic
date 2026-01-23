
import { GoogleGenAI } from "@google/genai";

export const getAIInsights = async (stats: any) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      As a real estate marketing analyst, analyze these lead statistics:
      - Total Raw Leads: ${stats.funnel.raw}
      - Unique Leads: ${stats.funnel.unique}
      - Leads to Booking Conversion: ${(stats.funnel.booking / stats.funnel.raw * 100).toFixed(2)}%
      - Top Performing Source: ${stats.topSource.source} (${stats.topSource.count} leads)
      - Top Agent: ${stats.topAgent.name} (Converted ${stats.topAgent.bookings} bookings)
      - Marketing Budget Effectiveness: Based on the source distribution.

      Provide 3 actionable insights in Indonesian language to improve the sales performance and lead quality. 
      Keep it professional, data-driven, and concise.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("AI Insights Error:", error);
    return "Maaf, sistem AI sedang tidak tersedia saat ini untuk memberikan analisis otomatis.";
  }
};
