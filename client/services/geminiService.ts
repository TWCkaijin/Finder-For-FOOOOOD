import { Restaurant, Language } from "../types";

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const fetchRestaurants = async (
  location: string,
  keywords: string,
  radius: string = "1km",
  limit: number = 6,
  model: string = "gemini-3-pro-preview", // Kept for signature compatibility/passing
  language: Language = 'zh-TW',
  excludeNames: string[] = [],
  onStreamUpdate?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<Restaurant[]> => {

  // Log start
  if (onStreamUpdate) {
    onStreamUpdate(`[${new Date().toLocaleTimeString()}] 🚀 Sending Request to Server...\n`);
  }

  try {
    const response = await fetch(`${SERVER_URL}/ai/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location,
        keywords,
        radius,
        limit,
        model,
        language,
        excludeNames
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.status} ${response.statusText}`);
    }

    // Logic for streaming?
    // Current server implementation returns JSON at once.
    // If we want to simulate "waiting", onStreamUpdate is already called above.
    // We just await the JSON.

    if (onStreamUpdate) {
      onStreamUpdate(`[${new Date().toLocaleTimeString()}] ⏳ Processing Server Response...\n`);
    }

    const data = await response.json();

    if (onStreamUpdate) {
      onStreamUpdate(`[SUCCESS] Received ${data.length} items.\n`);
    }

    return data as Restaurant[];

  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    console.error("Fetch Restaurants Error", error);
    if (onStreamUpdate) {
      onStreamUpdate(`\n❌ ERROR: ${error.message}\n`);
    }
    throw error;
  }
};
