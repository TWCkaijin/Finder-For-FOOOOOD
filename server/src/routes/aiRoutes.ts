import express, { Response } from 'express';
import * as admin from 'firebase-admin';
import { authenticateUser, AuthenticatedRequest } from '../middleware/authMiddleware';
import { searchRestaurantsFlow } from '../genkit';
import { z } from "zod";

import { searchPlace } from '../services/placesService';

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

/**
 * POST /api/ai/search
 * Core endpoint for searching restaurants using Genkit AI flow.
 * Optional authentication: If a valid token is provided, history is used to refine results.
 */

const inputSchema = z.object({
    location: z.string(),
    keywords: z.string().optional(),
    radius: z.string().optional(),
    limit: z.number().optional().default(10),
    language: z.string().optional().default('en'),
    excludeNames: z.array(z.string()).optional().default([]),
    userLat: z.number().optional(),
    userLng: z.number().optional()
});

function parseRadiusMeters(radiusStr?: string): number {
    if (!radiusStr || radiusStr === 'unlimited') return 5000; // Default 5km
    if (radiusStr.endsWith('km')) return parseFloat(radiusStr) * 1000;
    if (radiusStr.endsWith('m')) return parseFloat(radiusStr);
    return 5000;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}

function formatDistance(km: number): string {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
}

// POST /api/ai/search
router.post('/search', async (req, res) => {
    try {
        const { location, keywords, radius, limit, language, excludeNames, userLat, userLng } = inputSchema.parse(req.body);

        // Try to determine search center (for bias and distance calc)
        let centerLat = userLat;
        let centerLng = userLng;

        // If no explicit coord, try to parse from location string if it's "lat,lng"
        if (!centerLat && location.includes(',')) {
            const parts = location.split(',');
            if (parts.length === 2) {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    centerLat = lat;
                    centerLng = lng;
                }
            }
        }

        const searchRadiusMeters = parseRadiusMeters(radius);

        // Fetch user history if logged in to exclude recently recommended restaurants
        let historyExcludes: string[] = [];
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split('Bearer ')[1];
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                const userDoc = await admin.firestore().collection('userCollection').doc(decodedToken.uid).get();
                if (userDoc.exists) {
                    const data = userDoc.data();
                    if (data?.recommendedHistory && Array.isArray(data.recommendedHistory)) {
                        // Take the last 50 items to keep prompt size manageable
                        historyExcludes = data.recommendedHistory.slice(-50);
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch history for AI search:', e);
            }
        }

        const finalExcludes = [...new Set([...excludeNames, ...historyExcludes])];


        // Call Genkit Flow
        const rawRestaurants = await searchRestaurantsFlow({
            location,
            keywords,
            radius: radius || "1km",
            limit: Number(limit),
            language: language as any,
            excludeNames: finalExcludes
        });

        // Verification Step: Enhance data with Google Places API
        const verifiedRestaurants = await Promise.all(rawRestaurants.map(async (item) => {
            const query = `${item.name} ${item.address || location}`;

            const centerObj = (centerLat && centerLng) ? { lat: centerLat, lng: centerLng } : undefined;
            const placeData = await searchPlace(query, centerObj, searchRadiusMeters);

            if (placeData) {
                console.log(`✅ Verified: ${item.name} -> ${placeData.formattedAddress}`);

                let distLabel = "verified";
                if (centerLat && centerLng) {
                    const distKm = getDistanceFromLatLonInKm(centerLat, centerLng, placeData.location.lat, placeData.location.lng);
                    distLabel = formatDistance(distKm);
                }

                return {
                    id: placeData.placeId || generateId(),
                    name: placeData.name,
                    address: placeData.formattedAddress,
                    rating: placeData.rating || item.rating || 4.0,
                    priceLevel: formatPriceLevel(item.priceLevel, language as any),
                    tags: Array.isArray(item.tags) ? item.tags.slice(0, 3) : [],
                    description: item.description || "",
                    recommendedDishes: Array.isArray(item.recommendedDishes) ? item.recommendedDishes : [],
                    distance: distLabel,
                    isOpen: placeData.isOpen !== undefined ? placeData.isOpen : (item.isOpen !== false),
                    lat: placeData.location.lat,
                    lng: placeData.location.lng,
                    userRatingCount: placeData.userRatingCount
                };
            } else {
                console.log(`⚠️ Unverified (AI-only): ${item.name}`);

                let distLabel = "ai-estimate";
                if (centerLat && centerLng && item.lat && item.lng) {
                    const distKm = getDistanceFromLatLonInKm(centerLat, centerLng, item.lat, item.lng);
                    distLabel = `${formatDistance(distKm)} (est)`;
                }

                return {
                    id: generateId(),
                    name: item.name || "Unknown",
                    address: item.address || location,
                    rating: typeof item.rating === 'number' ? item.rating : 4.0,
                    priceLevel: formatPriceLevel(item.priceLevel, language as Language),
                    tags: Array.isArray(item.tags) ? item.tags.slice(0, 3) : [],
                    description: item.description || "",
                    recommendedDishes: Array.isArray(item.recommendedDishes) ? item.recommendedDishes : [],
                    distance: distLabel,
                    isOpen: item.isOpen !== false,
                    lat: item.lat || 25.0330,
                    lng: item.lng || 121.5654
                };
            }
        }));

        res.json(verifiedRestaurants);

    } catch (error: any) {
        console.error("AI Search Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

export default router;
