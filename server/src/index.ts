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

export const api = onRequest({
    cors: true,
    invoker: 'public', // Allow unauthenticated access (Cloud Run Invoker role for allUsers)
}, app);


if (process.env.LOCAL_DEV === 'true') {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}