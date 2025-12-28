import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

export const initializeFirebase = () => {
    if (admin.apps.length === 0) {
        try {
            const serviceAccountPath = path.resolve(__dirname, '../../admin.json');

            if (fs.existsSync(serviceAccountPath)) {
                // Local development with service account file
                const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
                console.log('Firebase Admin initialized with serviceAccountKey.json');
            } else {
                // Production or environment variable based init
                admin.initializeApp();
                console.log('Firebase Admin initialized with default credentials.');
            }
        } catch (error) {
            console.error('Error initializing Firebase Admin:', error);
        }
    }
};
