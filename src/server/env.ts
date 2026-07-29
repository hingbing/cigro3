import { z } from 'zod';
export const env = z.object({ DATABASE_URL: z.string().url().optional(), DATABASE_URL_TEST: z.string().url().optional() }).parse(process.env);
