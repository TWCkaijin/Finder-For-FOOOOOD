import * as admin from 'firebase-admin';

export const initializeFirebase = () => {
    try {
        const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (serviceAccountPath) {
            admin.initializeApp();
            console.log('Firebase Admin initialized with credentials file.');
        } else {
            console.warn('No Firebase credentials found. Firebase Admin not fully initialized.');
        }

    } catch (error) {
        console.error('Error initializing Firebase Admin:', error);
    }
};
