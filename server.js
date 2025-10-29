import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import multer from "multer";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { submissions } from "./src/database/schema.js";
import { db } from "./src/database/db.js";
import { eq } from "drizzle-orm";
import { cloudinary, upload } from "./src/storage/cloudinary.js";
import cookieParser from "cookie-parser";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "https://studenthangout.vercel.app/"], // adjust to your frontend
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// ✅ Helper: Normalize phone
function normalizePhone(phone) {
  phone = phone.replace(/\s+/g, "");
  if (phone.startsWith("+234")) return phone;
  if (phone.startsWith("234")) return `+${phone}`;
  if (phone.startsWith("0")) return `+234${phone.slice(1)}`;
  return phone;
}

// ✅ Admin auth middleware
function adminAuth(req, res, next) {
  const token =
    req.cookies?.admin_token ||
    (req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token)
    return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: "Invalid token" });
  }
}

// ✅ Admin Login Route
app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res
        .status(400)
        .json({ success: false, message: "Username and password required" });

    if (username !== process.env.ADMIN_USERNAME)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    const isMatch = await bcrypt.compare(password, process.env.ADMIN_PASSWORD);
    if (!isMatch)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: "6h",
    });

    res
      .cookie("admin_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 6 * 60 * 60 * 1000, // 6 hours
      })
      .json({ success: true, message: "Login successful" });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/admin/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.json({ success: true, message: "Logged out successfully" });
});

app.get("/admin/session", (req, res) => {
  try {
    const token = req.cookies?.admin_token;
    if (!token) return res.json({ loggedIn: false });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ loggedIn: true, user: decoded.username });
  } catch {
    res.json({ loggedIn: false });
  }
});

// ✅ User payment submission
app.post("/submit", upload.single("screenshot"), async (req, res) => {
  try {
    let { name, phone } = req.body;
    const screenshotUrl = req.file?.path;
    const screenshotPublicId = req.file?.filename;

    if (!name || !phone || !screenshotUrl) {
      return res.status(400).json({
        success: false,
        message: "Please provide your name, phone number, and screenshot.",
      });
    }

    phone = normalizePhone(phone);

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
        status: "pending",
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Payment submitted successfully.",
      data: inserted,
    });
  } catch (error) {
    console.error("Error submitting payment:", error);
    res.status(500).json({
      success: false,
      message: "Server error while submitting payment.",
      error: error.message,
    });
  }
});

// ✅ Protected Admin Routes
app.get("/submissions", adminAuth, async (req, res) => {
  try {
    const allSubs = await db.select().from(submissions);
    res.status(200).json({
      success: true,
      message: "All submissions retrieved successfully.",
      data: allSubs,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching submissions" });
  }
});

app.post("/verify/:id", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const sub = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1);
    if (sub.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });

    await db
      .update(submissions)
      .set({ status: "verified" })
      .where(eq(submissions.id, id));

    res.status(200).json({
      success: true,
      message: "Submission marked as verified.",
      data: { ...sub[0], status: "verified" },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/checkin/:id", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const sub = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1);
    if (sub.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });

    await db
      .update(submissions)
      .set({ status: "checked_in" })
      .where(eq(submissions.id, id));
    res.status(200).json({
      success: true,
      message: `${sub[0].name} checked in successfully.`,
      data: { ...sub[0], status: "checked_in" },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Optional: uncheck-in route
app.post("/uncheckin/:id", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const sub = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1);

    if (sub.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    await db
      .update(submissions)
      .set({ status: "verified" })
      .where(eq(submissions.id, id));

    res.status(200).json({
      success: true,
      message: `${sub[0].name} unchecked in successfully.`,
      data: { ...sub[0], status: "verified" },
    });
  } catch (error) {
    console.error("Error unchecking submission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while unchecking submission.",
      error: error.message,
    });
  }
});

// ✅ Global fallback for unhandled errors
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({
    success: false,
    message: "Unexpected server error.",
    error: err.message,
  });
});

// ✅ Serve frontend
app.use(express.static(path.join(__dirname, "client")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
