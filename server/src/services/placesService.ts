import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface PlaceResult {
    name: string;
    formattedAddress: string;
    location: {
        lat: number;
        lng: number;
    };
    rating?: number;
    userRatingCount?: number;
    placeId: string;
    isOpen?: boolean;
}

export const searchPlace = async (query: string, center?: { lat: number, lng: number }, radius?: number): Promise<PlaceResult | null> => {
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

        const requestBody: any = {
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

        const response = await fetch(url, {
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
            const errText = await response.text();
            console.error(`Places API Error (${response.status}):`, errText);
            return null;
        }

        const data = await response.json();

        if (data.places && data.places.length > 0) {
            const place = data.places[0];
            return {
                name: place.displayName?.text || query,
                formattedAddress: place.formattedAddress,
                location: {
                    lat: place.location.latitude,
                    lng: place.location.longitude
                },
                rating: place.rating,
                userRatingCount: place.userRatingCount,
                placeId: place.id,
                isOpen: place.currentOpeningHours?.openNow
            };
        }

        return null;
    } catch (error) {
        console.error("Error calling Places API:", error);
        return null;
    }
};
