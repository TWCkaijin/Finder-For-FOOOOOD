import * as admin from 'firebase-admin';

export const initializeFirebase = () => {
    if (admin.apps.length === 0) {
        try {
            admin.initializeApp();
            console.log('Firebase Admin initialized.');
        } catch (error) {
            console.error('Error initializing Firebase Admin:', error);
        }
    }
};
