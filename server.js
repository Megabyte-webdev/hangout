import express from "express";
import cors from "cors";
import multer from "multer";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { submissions } from "./src/database/schema.js";
import { db } from "./src/database/db.js";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure uploads folder exists
const uploadsDir = join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Async handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Admin middleware placeholder
const adminAuth = (req, res, next) => next();

// ----------------- Helper -----------------
const findStudentByEmail = async (phone) => {
  const student = await db
    .select()
    .from(submissions)
    .where(eq(submissions.phone, phone))
    .limit(1);
  return student[0];
};

// ----------------- Routes -----------------

// User payment submission
app.post("/submit", upload.single("screenshot"), async (req, res) => {
  try {
    let { name, phone } = req.body;
    const screenshot = req.file?.filename;

    if (!name || !phone || !screenshot) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide your name, phone number, and payment screenshot.",
      });
    }

    // Remove spaces but keep '+' and truncate to max 14 characters
    phone = phone.replace(/\s+/g, "").slice(0, 14);

    // Check if phone already exists
    const existing = await db
      .select()
      .from(submissions)
      .where(submissions.phone.eq(phone))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "You have already submitted your payment with this phone number.",
      });
    }

    // Insert submission
    const [inserted] = await db
      .insert(submissions)
      .values({ name, phone, screenshot })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Your payment has been successfully submitted.",
      data: inserted,
    });
  } catch (error) {
    console.error("Error submitting payment:", error);
    return res.status(500).json({
      success: false,
      message: "A server error occurred while submitting your payment.",
      error: error.message,
    });
  }
});

// Admin: get all submissions
app.get(
  "/submissions",
  adminAuth,
  asyncHandler(async (req, res) => {
    const allSubs = await db.select().from(submissions);
    res.status(200).json({
      success: true,
      message: "All payment submissions retrieved successfully.",
      data: allSubs,
    });
  })
);

// Admin: verify a payment
app.post(
  "/verify/:id",
  adminAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    // Get the first matching submission
    const sub = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1);

    if (!sub) {
      return res
        .status(404)
        .json({ success: false, message: "Payment submission not found." });
    }

    await db
      .update(submissions)
      .set({ verified: true })
      .where(eq(submissions.id, id));

    res.status(200).json({
      success: true,
      message: "Payment has been verified successfully.",
      data: sub,
    });
  })
);

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "An error occurred while processing your request.",
  });
});

// Serve frontend
app.use(express.static(path.join(__dirname, "client")));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
