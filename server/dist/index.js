"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const firebase_1 = require("./config/firebase");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Initialize Firebase
(0, firebase_1.initializeFirebase)();
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const aiRoutes_1 = __importDefault(require("./routes/aiRoutes"));
app.use('/api/user', userRoutes_1.default);
app.use('/api/ai', aiRoutes_1.default);
// Basic route
app.get('/', (req, res) => {
    res.send('Gourmet Finder Server is running');
});
// Start server
// Export the Express app as a Cloud Function
// This "api" export will be the entry point for Firebase Functions
exports.api = (0, https_1.onRequest)({
// Set explicit options if needed, e.g. region, memory, etc.
// cors: true // handled by express middleware
}, app);
// Start server locally only if not running in Cloud Functions
// Start server locally only if not running in Cloud Functions AND not in Emulator
// Firebase Emulator sets process.env.FUNCTIONS_EMULATOR to 'true'
if (!process.env.FUNCTION_TARGET && !process.env.FUNCTIONS_EMULATOR) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}
