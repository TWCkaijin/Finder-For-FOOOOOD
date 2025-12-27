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
// Conditionally apply body parser
// In Cloud Functions Gen 2, req.body might already be parsed by the platform
app.use((req, res, next) => {
    if (req.body) {
        next();
    }
    else {
        express_1.default.json()(req, res, next);
    }
});
const loggerMiddleware_1 = require("./middleware/loggerMiddleware");
app.use(loggerMiddleware_1.requestLogger);
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
exports.api = (0, https_1.onRequest)({
    cors: true,
    invoker: 'public', // Allow unauthenticated access (Cloud Run Invoker role for allUsers)
}, app);
if (process.env.LOCAL_DEV === 'true') {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}
