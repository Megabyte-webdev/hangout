CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(25) NOT NULL,
	"screenshot" varchar(255) NOT NULL,
	"screenshot_public_id" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	CONSTRAINT "submissions_phone_unique" UNIQUE("phone")
);
