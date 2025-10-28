// drizzle.config.ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema.js",
  out: "./drizzle", // migration output folder
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
