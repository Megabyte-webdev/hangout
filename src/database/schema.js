import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 25 }).notNull().unique(),
  screenshot: varchar("screenshot", { length: 255 }).notNull(),
  screenshot_public_id: varchar("screenshot_public_id", {
    length: 255,
  }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"), // pending | verified | checked_in
});
