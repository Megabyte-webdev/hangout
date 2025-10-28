import { pgTable, serial, varchar, boolean } from "drizzle-orm/pg-core";

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 25 }).notNull().unique(), // 14 characters, not null, unique
  screenshot: varchar("screenshot", { length: 255 }).notNull(),
  screenshot_public_id: varchar("screenshot_public_id", {
    length: 255,
  }).notNull(), // Cloudinary public_id
  verified: boolean("verified").default(false),
});
