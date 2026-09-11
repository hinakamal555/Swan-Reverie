const crypto = require("crypto");

function publicId() {
  return crypto.randomBytes(9).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
}

function shortId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

module.exports = { publicId, shortId };
