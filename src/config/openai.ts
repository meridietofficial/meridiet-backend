import OpenAI from 'openai';
import { env } from './env';

export const openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const OPENAI_PRIMARY_MODEL = 'gpt-6-sol';
export const OPENAI_FALLBACK_MODEL = 'gpt-6-luna';
