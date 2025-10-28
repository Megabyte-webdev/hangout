import express from "express";
import cors from "cors";
import multer from "multer";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { submissions } from "./src/database/schema.js";
import { db } from "./src/database/db.js";
import { eq } from "drizzle-orm";
import { upload } from "./src/storage/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Admin middleware placeholder
const adminAuth = (req, res, next) => next();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ----------------- Routes -----------------

// User payment submission
app.post("/submit", upload.single("screenshot"), async (req, res) => {
  try {
    let { name, phone } = req.body;
    const screenshotUrl = req.file?.path; // Cloudinary URL
    const screenshotPublicId = req.file?.filename; // Cloudinary public_id

    if (!name || !phone || !screenshotUrl) {
      return res.status(400).json({
        success: false,
        message: "Please provide your name, phone number, and screenshot.",
      });
    }

    phone = phone.replace(/\s+/g, "").slice(0, 14);

    const existing = await db
      .select()
      .from(submissions)
      .where(eq(submissions.phone, phone))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted with this phone number.",
      });
    }

    const [inserted] = await db
      .insert(submissions)
      .values({
        name,
        phone,
        screenshot: screenshotUrl,
        screenshot_public_id: screenshotPublicId,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Payment submitted successfully.",
      data: inserted,
    });
  } catch (error) {
    console.error("Error submitting payment:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

// Admin: get all submissions
app.get(
  "/submissions",
  adminAuth,
  asyncHandler(async (req, res) => {
    const allSubs = await db.select().from(submissions);
    res
      .status(200)
      .json({
        success: true,
        message: "All submissions retrieved",
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

    const sub = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1);
    if (!sub || sub.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });

    await db
      .update(submissions)
      .set({ verified: true })
      .where(eq(submissions.id, id));
    res
      .status(200)
      .json({ success: true, message: "Payment verified", data: sub[0] });
  })
);

// Admin: delete a submission & screenshot from Cloudinary
app.delete(
  "/submissions/:id",
  adminAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const sub = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1);
    if (!sub || sub.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });

    const submission = sub[0];

    // Delete screenshot from Cloudinary
    if (submission.screenshot_public_id) {
      try {
        await cloudinary.uploader.destroy(submission.screenshot_public_id);
      } catch (err) {
        console.error("Failed to delete screenshot from Cloudinary:", err);
      }
    }

    // Delete from database
    await db.delete(submissions).where(eq(submissions.id, id));

    res
      .status(200)
      .json({
        success: true,
        message: "Submission deleted successfully",
        data: submission,
      });
  })
);

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Server error" });
});

// Serve frontend
app.use(express.static(path.join(__dirname, "client")));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
