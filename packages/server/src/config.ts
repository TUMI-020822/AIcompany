import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (ai-agency/)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface AppConfig {
  PORT: number;
  DB_PATH: string;
  ENCRYPTION_KEY: string;
  DEEPSEEK_API_KEY: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GOOGLE_AI_API_KEY: string;
  OLLAMA_BASE_URL: string;
}

export const config: AppConfig = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  DB_PATH: process.env.DB_PATH || path.resolve(__dirname, '../data/agency.db'),
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production-32b!',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || '',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
};
