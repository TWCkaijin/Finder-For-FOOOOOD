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
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
