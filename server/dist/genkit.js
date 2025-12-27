"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRestaurantsFlow = exports.RestaurantListSchema = exports.RestaurantSchema = exports.SearchRestaurantsInputSchema = void 0;
const genkit_1 = require("genkit");
const google_genai_1 = require("@genkit-ai/google-genai");
const dotenv = __importStar(require("dotenv"));
// Ensure environment variables are loaded if running locally
dotenv.config();
// Initialize Genkit
// We use googleAI plugin which works with the Gemini API Key.
// Ensure GEMINI_API_KEY (or GOOGLE_GENAI_API_KEY) is set in your .env file.
const ai = (0, genkit_1.genkit)({
    plugins: [
        (0, google_genai_1.googleAI)({
            apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY,
        })
    ],
    // Set default model. Use the string identifier.
    // Note: Model availability depends on the API Key.
    model: "googleai/gemini-2.0-flash-exp",
});
// Define Zod Schema used for Input and Output
exports.SearchRestaurantsInputSchema = genkit_1.z.object({
    location: genkit_1.z.string(),
    keywords: genkit_1.z.string().optional(),
    radius: genkit_1.z.string().optional().default("1km"),
    limit: genkit_1.z.number().optional().default(6),
    language: genkit_1.z.enum(['zh-TW', 'en', 'ja']).optional().default('zh-TW'),
    excludeNames: genkit_1.z.array(genkit_1.z.string()).optional().default([]),
});
exports.RestaurantSchema = genkit_1.z.object({
    name: genkit_1.z.string().describe("Name of the restaurant"),
    address: genkit_1.z.string().describe("Full address"),
    rating: genkit_1.z.number().describe("Rating from 1.0 to 5.0"),
    priceLevel: genkit_1.z.string().describe("One of: '$', '$$', '$$$', '$$$$', or '-'"),
    tags: genkit_1.z.array(genkit_1.z.string()).describe("2-3 short tags describing the food"),
    description: genkit_1.z.string().describe("Brief appetizing description in target language"),
    recommendedDishes: genkit_1.z.array(genkit_1.z.string()).describe("Top 3 popular dishes"),
    isOpen: genkit_1.z.boolean().describe("Is likely open now?"),
    lat: genkit_1.z.number(),
    lng: genkit_1.z.number(),
});
exports.RestaurantListSchema = genkit_1.z.array(exports.RestaurantSchema);
// Define the Flow
exports.searchRestaurantsFlow = ai.defineFlow({
    name: "searchRestaurants",
    inputSchema: exports.SearchRestaurantsInputSchema,
    outputSchema: exports.RestaurantListSchema,
}, (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { location, keywords, radius, limit, language, excludeNames } = input;
    const finalKeywords = (keywords === null || keywords === void 0 ? void 0 : keywords.trim()) ? keywords : (language === 'en' ? "good food, high rating" : "美食, 高評分");
    let excludeInstruction = "";
    if (excludeNames && excludeNames.length > 0) {
        excludeInstruction = `DO NOT include these restaurants: ${excludeNames.join(", ")}.`;
    }
    const radiusConstraint = radius === 'unlimited'
        ? "Location: Prioritize nearby but allow wider search if needed."
        : `Location: Must be strictly within ${radius} of the center point.`;
    const langMap = {
        'zh-TW': 'Traditional Chinese (繁體中文)',
        'en': 'English',
        'ja': 'Japanese (日本語)'
    };
    const targetLanguage = langMap[language] || langMap['zh-TW'];
    const promptText = `
      Task: Find exactly ${limit} real, existing restaurants near "${location}" matching "${finalKeywords}".
      ${excludeInstruction}
      
      Constraints:
      1. Language: Output ONLY in ${targetLanguage}.
      2. Sort Order: Sort strictly by Recommendation Strength (Highest Rating + Best Keyword Match) DESCENDING.
      3. ${radiusConstraint}
      4. Ensure coordinates (lat/lng) are accurate for the specific restaurant.
    `;
    // Genkit automatically handles the structured output generation based on outputSchema
    const { output } = yield ai.generate({
        prompt: promptText,
        output: { schema: exports.RestaurantListSchema }, // Enforce structured output
        config: {
            temperature: 0.2,
        }
    });
    // output is already a typed object (Restaurant[]) thanks to Zod
    if (!output) {
        return [];
    }
    return output;
}));
