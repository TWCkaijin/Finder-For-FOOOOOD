"use strict";
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
exports.searchPlace = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const searchPlace = (query, center, radius) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // If no key provided, we can't verify.
    if (!API_KEY) {
        return null;
    }
    try {
        // Use Google Places API (New) - Text Search
        // Doc: https://developers.google.com/maps/documentation/places/web-service/text-search
        const url = `https://places.googleapis.com/v1/places:searchText`;
        // We refine the query to be specific, e.g. "Restaurant Name address" or "Restaurant Name near Location"
        // But caller passes constructed query.
        const requestBody = {
            textQuery: query,
            maxResultCount: 1 // We only need the best match
        };
        if (center) {
            requestBody.locationBias = {
                circle: {
                    center: {
                        latitude: center.lat,
                        longitude: center.lng
                    },
                    radius: radius || 1000.0
                }
            };
        }
        const response = yield fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                // Request specific fields to save latency/cost (though Basic fields are usually cheaper)
                // location, displayName, formattedAddress, id are Basic.
                // rating, userRatingCount might be Basic or Advanced depending on SKU.
                // Assuming standard "Pro" or Enterprise usage, let's get what we need.
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.id,places.currentOpeningHours'
            },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errText = yield response.text();
            console.error(`Places API Error (${response.status}):`, errText);
            return null;
        }
        const data = yield response.json();
        if (data.places && data.places.length > 0) {
            const place = data.places[0];
            return {
                name: ((_a = place.displayName) === null || _a === void 0 ? void 0 : _a.text) || query,
                formattedAddress: place.formattedAddress,
                location: {
                    lat: place.location.latitude,
                    lng: place.location.longitude
                },
                rating: place.rating,
                userRatingCount: place.userRatingCount,
                placeId: place.id,
                isOpen: (_b = place.currentOpeningHours) === null || _b === void 0 ? void 0 : _b.openNow
            };
        }
        return null;
    }
    catch (error) {
        console.error("Error calling Places API:", error);
        return null;
    }
});
exports.searchPlace = searchPlace;
