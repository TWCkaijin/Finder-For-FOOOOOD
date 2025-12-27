import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeFirebase } from './config/firebase';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

import { requestLogger } from './middleware/loggerMiddleware';
app.use(requestLogger);

// Initialize Firebase
initializeFirebase();

import userRoutes from './routes/userRoutes';
import aiRoutes from './routes/aiRoutes';

app.use('/api/user', userRoutes);
app.use('/api/ai', aiRoutes);

// Basic route
app.get('/', (req, res) => {
    res.send('Gourmet Finder Server is running');
});

// Start server


// Export the Express app as a Cloud Function
// This "api" export will be the entry point for Firebase Functions
export const api = onRequest({
    // Set explicit options if needed, e.g. region, memory, etc.
    // cors: true // handled by express middleware
}, app);

// Start server locally ONLY if LOCAL_DEV is set
// This prevents the server from trying to listen on a port during deployment or in Cloud Functions
if (process.env.LOCAL_DEV === 'true') {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}
