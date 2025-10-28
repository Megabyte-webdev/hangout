CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(14) NOT NULL,
	"screenshot" varchar(255) NOT NULL,
	"verified" boolean DEFAULT false,
	CONSTRAINT "submissions_phone_unique" UNIQUE("phone")
);
