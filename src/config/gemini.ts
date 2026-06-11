import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './env';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const config = {
  responseMimeType: 'application/json',
  temperature: 0.4,
};

export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-3.1-flash-lite',
  generationConfig: config,
});

export const geminiFallbackModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
  generationConfig: config,
});
