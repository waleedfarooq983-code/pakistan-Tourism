import dns from 'node:dns/promises';
try { dns.setServers(['1.1.1.1', '8.8.8.8']); } catch {}
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Tour from '../models/Tour.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });

        const tours = await Tour.find({ isActive: true }).select('title price region duration');
        const tourContext = tours.map(t => `- ${t.title} (${t.region}): PKR ${t.price}, Duration: ${t.duration || 'N/A'}`).join('\n');

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-3.5-flash-lite',
            systemInstruction: "You are a travel assistant for Discover Pakistan. Answer the user's question using ONLY the provided tour data. Keep answers brief."
        });

        const prompt = `Available Tours:\n${tourContext}\n\nUser Question: ${message}`;
        const result = await model.generateContent(prompt);
        res.json({ reply: result.response.text() });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to process chat' });
    }
});

export default router;
