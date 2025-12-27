import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import * as dotenv from "dotenv";

// Ensure environment variables are loaded if running locally
dotenv.config();

// Initialize Genkit
// We use googleAI plugin which works with the Gemini API Key.
// Ensure GEMINI_API_KEY (or GOOGLE_GENAI_API_KEY) is set in your .env file.
const ai = genkit({
    plugins: [
        googleAI({
            apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY,
        })
    ],
    // Set default model. Use the string identifier.
    // Note: Model availability depends on the API Key.
    model: "googleai/gemini-2.0-flash-exp",
});

// Define Zod Schema used for Input and Output
export const SearchRestaurantsInputSchema = z.object({
    location: z.string(),
    keywords: z.string().optional(),
    radius: z.string().optional().default("1km"),
    limit: z.number().optional().default(6),
    language: z.enum(['zh-TW', 'en', 'ja']).optional().default('zh-TW'),
    excludeNames: z.array(z.string()).optional().default([]),
    context: z.string().optional(),
    model: z.string().optional(),
});

export const RestaurantSchema = z.object({
    name: z.string().describe("Name of the restaurant"),
    address: z.string().describe("Full address"),
    rating: z.number().describe("Rating from 1.0 to 5.0"),
    priceLevel: z.string().describe("One of: '$', '$$', '$$$', '$$$$', or '-'"),
    tags: z.array(z.string()).describe("2-3 short tags describing the food"),
    description: z.string().describe("Brief appetizing description in target language"),
    recommendedDishes: z.array(z.string()).describe("Top 3 popular dishes"),
    isOpen: z.boolean().describe("Is likely open now?"),
    lat: z.number(),
    lng: z.number(),
});

export const RestaurantListSchema = z.array(RestaurantSchema);

// Define the Flow
export const searchRestaurantsFlow = ai.defineFlow({
    name: "searchRestaurants",
    inputSchema: SearchRestaurantsInputSchema,
    outputSchema: RestaurantListSchema,
}, async (input) => {
    const {
        location,
        keywords,
        radius,
        limit,
        language,
        excludeNames,
        context,
        model
    } = input;

    const finalKeywords = keywords?.trim() ? keywords : (language === 'en' ? "good food, high rating" : "美食, 高評分");

    let excludeInstruction = "";
    if (excludeNames && excludeNames.length > 0) {
        excludeInstruction = `DO NOT include these restaurants: ${excludeNames.join(", ")}.`;
    }

    const radiusConstraint = radius === 'unlimited'
        ? "Location: Prioritize nearby but allow wider search if needed."
        : `Location: Must be strictly within ${radius} of the center point.`;

    const langMap: Record<string, string> = {
        'zh-TW': 'Traditional Chinese (繁體中文)',
        'en': 'English',
        'ja': 'Japanese (日本語)'
    };
    const targetLanguage = langMap[language] || langMap['zh-TW'];

    const promptText = `
      Task: Find exactly ${limit} real, existing restaurants near "${location}" matching "${finalKeywords}".
      ${excludeInstruction}
      ${context ? `\n      User Personal Preferences:\n      ${context}` : ""}
      
      Constraints:
      1. Language: Output ONLY in ${targetLanguage}.
      2. Sort Order: Sort strictly by Recommendation Strength (Highest Rating + Best Keyword Match) DESCENDING.
      3. ${radiusConstraint}
      4. Ensure coordinates (lat/lng) are accurate for the specific restaurant.
    `;

    // Genkit automatically handles the structured output generation based on outputSchema
    const { output } = await ai.generate({
        prompt: promptText,
        output: { schema: RestaurantListSchema }, // Enforce structured output
        model: model || "googleai/gemini-2.0-flash-exp",
        config: {
            temperature: 0.2,
        }
    });

    // output is already a typed object (Restaurant[]) thanks to Zod
    if (!output) {
        return [];
    }

    return output;
}
);
