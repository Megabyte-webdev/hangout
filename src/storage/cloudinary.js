import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// Multer storage using Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "fyb-payments", // optional folder in Cloudinary
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 800, crop: "limit" }], // optional
  },
});

export const upload = multer({ storage });
export { cloudinary };
