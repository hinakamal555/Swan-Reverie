const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/x-mpeg", "audio/mpeg3", "audio/x-mp3"]);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_BYTES = MAX_AUDIO_BYTES;

function parseCloudinary(url) {
  try {
    const parsed = new URL(url);
    return {
      key: decodeURIComponent(parsed.username),
      secret: decodeURIComponent(parsed.password),
      cloud: parsed.hostname,
    };
  } catch {
    return null;
  }
}

function normalizeMime(type) {
  const value = String(type || "").toLowerCase();
  if (AUDIO_TYPES.has(value) || value.startsWith("audio/")) return "audio/mpeg";
  return value;
}

function isAudio(file) {
  const mime = String(file.mimetype || "").toLowerCase();
  if (AUDIO_TYPES.has(mime) || mime.startsWith("audio/")) return true;
  return /\.mp3$/i.test(file.originalname || "");
}

function isImage(file) {
  return IMAGE_TYPES.has(String(file.mimetype || "").toLowerCase());
}

async function storeUpload(file, ownerId) {
  if (!file) throw new Error("No file uploaded.");

  const audio = isAudio(file);
  const image = isImage(file);
  if (!audio && !image) {
    throw new Error("Only JPEG, PNG, WebP, and MP3 files are allowed.");
  }

  const maxBytes = audio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    throw new Error(audio ? "Music must be 10MB or smaller." : "Images must be 2MB or smaller.");
  }

  const ext = extensionFor(file, audio);
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;

  if (process.env.CLOUDINARY_URL) {
    return uploadCloudinary(file, name);
  }

  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error("Set CLOUDINARY_URL for production uploads, or paste a media URL instead.");
  }

  const dir = path.join(__dirname, "..", "..", "public", "uploads", String(ownerId));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), file.buffer);
  return `/uploads/${ownerId}/${name}`;
}

function extensionFor(file, audio) {
  if (audio) return ".mp3";
  const type = String(file.mimetype || "").toLowerCase();
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  return ".jpg";
}

async function uploadCloudinary(file, filename) {
  const creds = parseCloudinary(process.env.CLOUDINARY_URL);
  if (!creds) throw new Error("CLOUDINARY_URL is invalid.");

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "wedding-invitations";
  const toSign = `folder=${folder}&timestamp=${timestamp}${creds.secret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");
  const blob = new Blob([file.buffer], { type: file.mimetype });
  const body = new FormData();
  body.append("file", blob, filename);
  body.append("api_key", creds.key);
  body.append("timestamp", String(timestamp));
  body.append("signature", signature);
  body.append("folder", folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${creds.cloud}/auto/upload`, {
    method: "POST",
    body,
  });
  const data = await response.json();
  if (!response.ok || !data.secure_url) {
    throw new Error(data.error && data.error.message ? data.error.message : "Cloudinary upload failed.");
  }
  return data.secure_url;
}

module.exports = { storeUpload, MAX_BYTES, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES };
