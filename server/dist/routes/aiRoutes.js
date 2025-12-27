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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const admin = __importStar(require("firebase-admin"));
const genkit_1 = require("../genkit");
const zod_1 = require("zod");
const placesService_1 = require("../services/placesService");
const router = express_1.default.Router();
// Helper to generate a unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatPriceLevel = (level, lang) => {
    const map = {
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
const inputSchema = zod_1.z.object({
    location: zod_1.z.string(),
    keywords: zod_1.z.string().optional(),
    radius: zod_1.z.string().optional(),
    limit: zod_1.z.number().optional().default(10),
    language: zod_1.z.string().optional().default('en'),
    excludeNames: zod_1.z.array(zod_1.z.string()).optional().default([]),
    userLat: zod_1.z.number().optional(),
    userLng: zod_1.z.number().optional()
});
function parseRadiusMeters(radiusStr) {
    if (!radiusStr || radiusStr === 'unlimited')
        return 5000; // Default 5km
    if (radiusStr.endsWith('km'))
        return parseFloat(radiusStr) * 1000;
    if (radiusStr.endsWith('m'))
        return parseFloat(radiusStr);
    return 5000;
}
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}
function deg2rad(deg) {
    return deg * (Math.PI / 180);
}
function formatDistance(km) {
    if (km < 1)
        return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
}
// POST /api/ai/search
router.post('/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        let historyExcludes = [];
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split('Bearer ')[1];
            try {
                const decodedToken = yield admin.auth().verifyIdToken(token);
                const userDoc = yield admin.firestore().collection('userCollection').doc(decodedToken.uid).get();
                if (userDoc.exists) {
                    const data = userDoc.data();
                    if ((data === null || data === void 0 ? void 0 : data.recommendedHistory) && Array.isArray(data.recommendedHistory)) {
                        // Take the last 50 items to keep prompt size manageable
                        historyExcludes = data.recommendedHistory.slice(-50);
                    }
                }
            }
            catch (e) {
                console.warn('Failed to fetch history for AI search:', e);
            }
        }
        const finalExcludes = [...new Set([...excludeNames, ...historyExcludes])];
        // Call Genkit Flow
        const rawRestaurants = yield (0, genkit_1.searchRestaurantsFlow)({
            location,
            keywords,
            radius: radius || "1km",
            limit: Number(limit),
            language: language,
            excludeNames: finalExcludes
        });
        // Verification Step: Enhance data with Google Places API
        const verifiedRestaurants = yield Promise.all(rawRestaurants.map((item) => __awaiter(void 0, void 0, void 0, function* () {
            const query = `${item.name} ${item.address || location}`;
            const centerObj = (centerLat && centerLng) ? { lat: centerLat, lng: centerLng } : undefined;
            const placeData = yield (0, placesService_1.searchPlace)(query, centerObj, searchRadiusMeters);
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
                    priceLevel: formatPriceLevel(item.priceLevel, language),
                    tags: Array.isArray(item.tags) ? item.tags.slice(0, 3) : [],
                    description: item.description || "",
                    recommendedDishes: Array.isArray(item.recommendedDishes) ? item.recommendedDishes : [],
                    distance: distLabel,
                    isOpen: placeData.isOpen !== undefined ? placeData.isOpen : (item.isOpen !== false),
                    lat: placeData.location.lat,
                    lng: placeData.location.lng,
                    userRatingCount: placeData.userRatingCount
                };
            }
            else {
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
                    priceLevel: formatPriceLevel(item.priceLevel, language),
                    tags: Array.isArray(item.tags) ? item.tags.slice(0, 3) : [],
                    description: item.description || "",
                    recommendedDishes: Array.isArray(item.recommendedDishes) ? item.recommendedDishes : [],
                    distance: distLabel,
                    isOpen: item.isOpen !== false,
                    lat: item.lat || 25.0330,
                    lng: item.lng || 121.5654
                };
            }
        })));
        res.json(verifiedRestaurants);
    }
    catch (error) {
        console.error("AI Search Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
}));
exports.default = router;
