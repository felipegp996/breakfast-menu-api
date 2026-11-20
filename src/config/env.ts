import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_USERS_URI: z.string().min(1),
  MONGODB_INGREDIENTS_URI: z.string().min(1),
  MONGODB_RECIPES_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  UI_ORIGIN: z.string().url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("UTC"),
  ADMIN_NAME: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  USER_NAME: z.string().optional(),
  USER_EMAIL: z.string().email().optional(),
  USER_PASSWORD: z.string().min(12).optional(),
});

export const env = envSchema.parse(process.env);