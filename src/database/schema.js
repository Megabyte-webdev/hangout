import { pgTable, serial, varchar, boolean } from "drizzle-orm/pg-core";

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 25 }).notNull().unique(), // 14 characters, not null, unique
  screenshot: varchar("screenshot", { length: 255 }).notNull(),
  verified: boolean("verified").default(false),
});
