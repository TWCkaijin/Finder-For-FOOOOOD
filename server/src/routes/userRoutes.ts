import express, { Response } from 'express';
import * as admin from 'firebase-admin';
import { authenticateUser, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = express.Router();

// GET /api/user/preferences
router.get('/preferences', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const uid = req.user!.uid;
        const userDoc = await admin.firestore().collection('users').doc(uid).get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: 'User preferences not found' });
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
        const preferences = req.body;

        // Merge true allows updating specific fields without overwriting everything
        await admin.firestore().collection('users').doc(uid).set(preferences, { merge: true });

        res.json({ message: 'Preferences saved successfully' });
    } catch (error) {
        console.error('Error saving preferences:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
