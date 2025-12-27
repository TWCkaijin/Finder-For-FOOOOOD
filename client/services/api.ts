import { auth } from './firebase';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
console.log('🔗 API Service connected to:', SERVER_URL);

const getHeaders = async () => {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
};

export const savePreferences = async (preferences: any) => {
    try {
        const headers = await getHeaders();
        const response = await fetch(`${SERVER_URL}/user/preferences`, {
            method: 'POST',
            headers,
            body: JSON.stringify(preferences),
        });

        if (!response.ok) {
            throw new Error('Failed to save preferences');
        }
        return await response.json();
    } catch (error) {
        console.error('Error in savePreferences:', error);
        throw error;
    }
};

export const getPreferences = async () => {
    try {
        const headers = await getHeaders();
        const response = await fetch(`${SERVER_URL}/user/preferences`, {
            method: 'GET',
            headers,
        });

        if (response.status === 404) {
            return null; // No preferences yet
        }

        if (!response.ok) {
            // If 401, maybe token expired or not logged in, but frontend should handle that state
            throw new Error('Failed to fetch preferences');
        }
        return await response.json();
    } catch (error) {
        console.error('Error in getPreferences:', error);
        throw error;
    }
};

export const syncUser = async (user: any) => {
    try {
        const headers = await getHeaders();
        const response = await fetch(`${SERVER_URL}/user/sync`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to sync user');
        }
        return await response.json();
    } catch (error) {
        console.error('Error in syncUser:', error);
        // Don't throw to prevent blocking the UI
    }
};

export const addToHistory = async (keywords?: string | string[], restaurantNames?: string[]) => {
    try {
        // Only proceed if user is logged in
        if (!auth.currentUser) return;

        const headers = await getHeaders();
        const response = await fetch(`${SERVER_URL}/user/history`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                keywords,
                restaurantNames
            }),
        });

        if (!response.ok) {
            // Silently fail is okay for history tracking
            console.warn('Failed to update history', response.statusText);
        }
    } catch (error) {
        console.error('Error in addToHistory:', error);
    }
};

export const getHistory = async () => {
    try {
        if (!auth.currentUser) return null;
        const headers = await getHeaders();
        const response = await fetch(`${SERVER_URL}/user/history`, {
            method: 'GET',
            headers,
        });

        if (!response.ok) {
            throw new Error('Failed to fetch history');
        }
        return await response.json();
    } catch (error) {
        console.error('Error in getHistory:', error);
        return null;
    }
};
