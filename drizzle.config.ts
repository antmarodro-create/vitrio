import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:vitrio@127.0.0.1:5432/vitrio",
  },
  verbose: true,
  strict: false,
} satisfies Config;
