import multer from "multer";
import { env } from "../config/env.js";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only image files (JPEG, PNG, WEBP, GIF) are allowed"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxFileSize,
    files: 1,
  },
});

export const uploadSingle = upload.single("flyer");

export function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: `File too large. Maximum size is ${Math.floor(env.maxFileSize / 1024 / 1024)}MB.`,
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Only one file is allowed.",
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    // If the error already carries an HTTP status code (e.g., 403 from
    // requireRole or 401 from authenticate), let it propagate to the
    // application error handler so the correct status code is used.
    // Otherwise it is a multer file-filter error and should be 400.
    if (Number.isInteger(err.status) && err.status >= 400 && err.status <= 599) {
      return next(err);
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
}