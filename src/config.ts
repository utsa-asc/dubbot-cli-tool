import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DUBBOT_API_KEY: z.string().min(1),
  DUBBOT_API_URL: z.string().url().default('https://api.dubbot.com/graphql'),
  DUBBOT_ACCOUNT_ID: z.string().min(1),
  DUBBOT_SITE_IDS: z.string().min(1).transform((val) => val.split(',').map((s) => s.trim()).filter(Boolean)),
  OUTPUT_FILE: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Config validation failed:\n${issues}`);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
