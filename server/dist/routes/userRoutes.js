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
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// GET /api/user/preferences
router.get('/preferences', authMiddleware_1.authenticateUser, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const uid = req.user.uid;
        const userDoc = yield admin.firestore().collection('userCollection').doc(uid).get();
        if (!userDoc.exists) {
            // Return empty object instead of 404 to avoid errors on first login
            return res.json({});
        }
        res.json(userDoc.data());
    }
    catch (error) {
        console.error('Error fetching preferences:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// POST /api/user/preferences
router.post('/preferences', authMiddleware_1.authenticateUser, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const uid = req.user.uid;
        const preferences = req.body;
        // Merge true allows updating specific fields without overwriting everything
        yield admin.firestore().collection('userCollection').doc(uid).set({ preferences }, { merge: true });
        res.json({ message: 'Preferences saved successfully' });
    }
    catch (error) {
        console.error('Error saving preferences:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// POST /api/user/sync
// Called on login to ensure user document exists and update profile info
router.post('/sync', authMiddleware_1.authenticateUser, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const uid = req.user.uid;
        const { email, displayName, photoURL } = req.body;
        const userData = {
            email,
            displayName,
            photoURL,
            lastLogin: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        // Use set with merge to create or update
        yield admin.firestore().collection('userCollection').doc(uid).set(userData, { merge: true });
        res.json({ message: 'User synced successfully', uid });
    }
    catch (error) {
        console.error('Error syncing user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// POST /api/user/history
// Appends search keywords and recommended restaurant names to user's history
router.post('/history', authMiddleware_1.authenticateUser, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const uid = req.user.uid;
        const { keywords, restaurantNames } = req.body;
        const updateData = {};
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
            yield admin.firestore().collection('userCollection').doc(uid).update(updateData);
        }
        res.json({ message: 'History updated successfully' });
    }
    catch (error) {
        console.error('Error updating history:', error);
        // Using set with merge if doc doesn't exist (though sync should have created it)
        // Fallback to error handling
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// GET /api/user/history
// Retrieves user's search keywords and recommended restaurant history
router.get('/history', authMiddleware_1.authenticateUser, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const uid = req.user.uid;
        const userDoc = yield admin.firestore().collection('userCollection').doc(uid).get();
        if (!userDoc.exists) {
            return res.json({ searchKeywords: [], recommendedHistory: [] });
        }
        const data = userDoc.data();
        const historyData = {
            searchKeywords: (data === null || data === void 0 ? void 0 : data.searchKeywords) || [],
            recommendedHistory: (data === null || data === void 0 ? void 0 : data.recommendedHistory) || []
        };
        console.log(`[HISTORY] Found ${historyData.searchKeywords.length} keywords, ${historyData.recommendedHistory.length} restaurants for ${uid}`);
        res.json(historyData);
    }
    catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// Force reload check
exports.default = router;
