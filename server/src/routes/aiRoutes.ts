import express, { Response } from 'express';
// import { GoogleGenAI, Type } from "@google/genai"; // Removed
import { authenticateUser, AuthenticatedRequest } from '../middleware/authMiddleware';
import { searchRestaurantsFlow } from '../genkit';
import { z } from "zod";

const router = express.Router();

// Helper to generate a unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Language definition matching client
type Language = 'zh-TW' | 'en' | 'ja';

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

// POST /api/ai/search
// We keep it open (no authenticateUser middleware required IF we want public search)
// But to use server resources, maybe we might want to restrict it later. 
// For now, let's keep it open or require auth as per requirement? 
// Requirement says "Server side component to store user preference... and user created account".
// It implies AI might also be behind auth, but let's assume we want to protect the API key.
// Let's use authenticateUser to prevent abuse if desired, OR just public.
// Given "user created account" context, let's require auth OR allow public for now but moving logic to server is the goal.
// I will NOT force auth for search strictly unless requested, but good practice. 
// However, the client App.tsx calls fetchRestaurants potentially before login? 
// Looking at App.tsx, user can search without likely being logged in initially?
// Actually App.tsx shows AuthButton, so maybe login is optional. 
// Let's make the route NOT require auth middleware for now to preserve existing "guest" usage if any.

// POST /api/ai/search
router.post('/search', async (req, res) => {
    try {
        const {
            location,
            keywords,
            radius = "1km",
            limit = 6,
            model = "gemini-2.0-flash-exp",
            language = 'zh-TW',
            excludeNames = []
        } = req.body;

        // Note: The 'model' param from client is currently unused in the flow definition 
        // because we hardcoded gemini-2.0-flash-exp (or provided default) in genkit.ts
        // You can update genkit.ts to accept model override if needed.

        // Call Genkit Flow
        const rawRestaurants = await searchRestaurantsFlow({
            location,
            keywords,
            radius,
            limit: Number(limit),
            language: language as any,
            excludeNames
        });

        const restaurants = rawRestaurants.map((item) => ({
            id: generateId(),
            name: item.name || "Unknown",
            address: item.address || location,
            rating: typeof item.rating === 'number' ? item.rating : 4.0,
            priceLevel: formatPriceLevel(item.priceLevel, language as Language),
            tags: Array.isArray(item.tags) ? item.tags.slice(0, 3) : [],
            description: item.description || "",
            recommendedDishes: Array.isArray(item.recommendedDishes) ? item.recommendedDishes : [],
            distance: "nearby",
            isOpen: item.isOpen !== false,
            lat: item.lat || 25.0330,
            lng: item.lng || 121.5654
        }));

        res.json(restaurants);

    } catch (error: any) {
        console.error("AI Search Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

export default router;
