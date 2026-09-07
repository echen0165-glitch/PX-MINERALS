import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  WAVE_DEPOSIT_URL: z.string().url(),
  WAVE_API_KEY: z.string().optional(),
  WAVE_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_PROVIDER: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
});

export const env = envSchema.parse(process.env);
