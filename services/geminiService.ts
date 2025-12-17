import { GoogleGenAI, Type } from "@google/genai";
import { Restaurant, Language } from "../types";

// Helper to generate a unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export const fetchRestaurants = async (
  location: string,
  keywords: string,
  radius: string = "1km",
  limit: number = 6,
  model: string = "gemini-3-pro-preview",
  language: Language = 'zh-TW',
  excludeNames: string[] = [],
  onStreamUpdate?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<Restaurant[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const finalKeywords = keywords.trim() ? keywords : (language === 'en' ? "good food, high rating" : "美食, 高評分");
  const excludeInstruction = excludeNames.length > 0 
    ? `DO NOT include these restaurants: ${excludeNames.join(", ")}.` 
    : "";

  const radiusConstraint = radius === 'unlimited' 
    ? "Location: Prioritize nearby but allow wider search if needed." 
    : `Location: Must be strictly within ${radius} of the center point.`;

  // Language mapping
  const langMap = {
    'zh-TW': 'Traditional Chinese (繁體中文)',
    'en': 'English',
    'ja': 'Japanese (日本語)'
  };
  const targetLanguage = langMap[language];

  const prompt = `
    Task: Find exactly ${limit} real, existing restaurants near "${location}" matching "${finalKeywords}".
    ${excludeInstruction}
    
    Constraints:
    1. Language: Output ONLY in ${targetLanguage}.
    2. Sort Order: Sort strictly by Recommendation Strength (Highest Rating + Best Keyword Match) DESCENDING.
    3. ${radiusConstraint}
    4. Ensure coordinates (lat/lng) are accurate for the specific restaurant.
  `;

  // Define JSON Schema using the SDK's Type enum
  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Name of the restaurant" },
        address: { type: Type.STRING, description: "Full address" },
        rating: { type: Type.NUMBER, description: "Rating from 1.0 to 5.0" },
        priceLevel: { type: Type.STRING, description: "One of: '$', '$$', '$$$', '$$$$', or '-'" },
        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 short tags describing the food" },
        description: { type: Type.STRING, description: `Brief appetizing description in ${targetLanguage}` },
        recommendedDishes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Top 3 popular dishes" },
        isOpen: { type: Type.BOOLEAN, description: "Is likely open now?" },
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER }
      },
      required: ["name", "address", "rating", "priceLevel", "tags", "description", "recommendedDishes", "lat", "lng"]
    }
  };

  // Log the prompt
  if (onStreamUpdate) {
    const timestamp = new Date().toLocaleTimeString();
    onStreamUpdate(`[${timestamp}] 🚀 Sending Request to Gemini (${model}) with Schema...\n\n--- PROMPT START ---\n${prompt.trim()}\n--- PROMPT END ---\n\n[${timestamp}] ⏳ Waiting for structured response...\n\n`);
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  try {
    // Note: When using responseSchema, we cannot use googleSearch tool in the current version.
    // We rely on the model's internal knowledge base for this strict schema mode.
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2, 
      },
    });

    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    const jsonStr = response.text || "[]";
    
    if (onStreamUpdate) {
        onStreamUpdate(`[RAW JSON]\n${jsonStr}\n`);
    }

    let rawData;
    try {
      rawData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON parse failure even with Schema", e);
      return [];
    }

    if (!Array.isArray(rawData)) {
      return [];
    }

    const restaurants: Restaurant[] = rawData.map((item: any) => ({
      id: generateId(),
      name: item.name || "Unknown",
      address: item.address || location,
      rating: typeof item.rating === 'number' ? item.rating : 4.0,
      priceLevel: formatPriceLevel(item.priceLevel, language),
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 3) : [],
      description: item.description || "",
      recommendedDishes: Array.isArray(item.recommendedDishes) ? item.recommendedDishes : [],
      distance: "nearby",
      isOpen: item.isOpen !== false,
      lat: item.lat || 25.0330,
      lng: item.lng || 121.5654
    }));

    return restaurants;

  } catch (error: any) {
    if (error.name === 'AbortError' || error.message === 'Aborted') {
        throw error;
    }

    console.error("Gemini API Error:", error);
    
    let errorMessage = language === 'en' ? "Connection error." : "連線發生錯誤，請稍後再試。";
    const errorStr = error.toString();
    
    if (errorStr.includes("503") || errorStr.includes("Overloaded")) {
      errorMessage = "Model Overloaded (503)";
    } else if (errorStr.includes("429")) {
      errorMessage = "Rate Limit Exceeded (429)";
    } else if (errorStr.includes("API Key")) {
      errorMessage = "Invalid API Key";
    }

    if (onStreamUpdate) {
        onStreamUpdate(`\n\n❌ ERROR: ${errorMessage} \n(Raw: ${errorStr})`);
    }
    
    throw new Error(errorMessage);
  }
};

const formatPriceLevel = (level: string, lang: Language): string => {
  const map: Record<string, string> = {
    '$': lang === 'en' ? '$ (Cheap)' : (lang === 'ja' ? '$ (安い)' : '$ (平價)'),
    '$$': lang === 'en' ? '$$ (Moderate)' : (lang === 'ja' ? '$$ (普通)' : '$$ (稍貴)'),
    '$$$': lang === 'en' ? '$$$ (Expensive)' : (lang === 'ja' ? '$$$ (高い)' : '$$$ (昂貴)'),
    '$$$$': lang === 'en' ? '$$$$ (Very Expensive)' : (lang === 'ja' ? '$$$$ (高級)' : '$$$$ (天價)'),
    '-': '-'
  };
  return map[level] || map['$'] || '-';
};
