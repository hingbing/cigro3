import { z } from 'zod';
export const env = z.object({ DATABASE_URL: z.string().url().optional(), DATABASE_URL_TEST: z.string().url().optional(), SESSION_SECRET: z.string().min(32).optional() }).parse(process.env);
