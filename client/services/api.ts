import { auth } from './firebase';

const SERVER_URL = 'http://localhost:5001/api'; // Update if deployed

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
