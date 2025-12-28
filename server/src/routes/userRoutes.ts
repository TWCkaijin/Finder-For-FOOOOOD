import express, { Response } from 'express';
import * as admin from 'firebase-admin';
import { authenticateUser, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = express.Router();

// GET /api/user/preferences
router.get('/preferences', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const uid = req.user!.uid;
        const userDoc = await admin.firestore().collection('userCollection').doc(uid).get();

        if (!userDoc.exists) {
            // Return empty object instead of 404 to avoid errors on first login
            return res.json({});
        }

        res.json(userDoc.data());
    } catch (error) {
        console.error('Error fetching preferences:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/user/preferences
router.post('/preferences', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const uid = req.user!.uid;
        // req.body should be { preferences: { ... } }
        // We want to merge this directly into the doc
        await admin.firestore().collection('userCollection').doc(uid).set(req.body, { merge: true });

        res.json({ message: 'Preferences saved successfully' });
    } catch (error) {
        console.error('Error saving preferences:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/user/sync
// Called on login to ensure user document exists and update profile info
router.post('/sync', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const uid = req.user!.uid;
        const { email, displayName, photoURL } = req.body;

        const userData = {
            email,
            displayName,
            photoURL,
            lastLogin: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Use set with merge to create or update
        await admin.firestore().collection('userCollection').doc(uid).set(userData, { merge: true });

        res.json({ message: 'User synced successfully', uid });
    } catch (error) {
        console.error('Error syncing user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/user/history
// Appends search keywords and recommended restaurant names to user's history
router.post('/history', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const uid = req.user!.uid;
        const { keywords, restaurantNames } = req.body;

        const updateData: any = {};

        if (keywords) {
            // Support both single string or array
            const keywordList = Array.isArray(keywords) ? keywords : [keywords];
            if (keywordList.length > 0) {
                updateData.searchKeywords = admin.firestore.FieldValue.arrayUnion(...keywordList);
            }
        }

        if (restaurantNames && Array.isArray(restaurantNames) && restaurantNames.length > 0) {
            updateData.recommendedHistory = admin.firestore.FieldValue.arrayUnion(...restaurantNames);
        }

        if (Object.keys(updateData).length > 0) {
            await admin.firestore().collection('userCollection').doc(uid).update(updateData);
        }

        res.json({ message: 'History updated successfully' });
    } catch (error) {
        console.error('Error updating history:', error);
        // Using set with merge if doc doesn't exist (though sync should have created it)
        // Fallback to error handling
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/user/history
// Retrieves user's search keywords and recommended restaurant history
router.get('/history', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const uid = req.user!.uid;
        const userDoc = await admin.firestore().collection('userCollection').doc(uid).get();

        if (!userDoc.exists) {
            return res.json({ searchKeywords: [], recommendedHistory: [] });
        }

        const data = userDoc.data();
        const historyData = {
            searchKeywords: data?.searchKeywords || [],
            recommendedHistory: data?.recommendedHistory || []
        };
        console.log(`[HISTORY] Found ${historyData.searchKeywords.length} keywords, ${historyData.recommendedHistory.length} restaurants for ${uid}`);
        res.json(historyData);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Force reload check
export default router;
